# ADR 018: Secrets in AWS Secrets Manager (Hybrid Resolver)

**Status:** Accepted
**Date:** 2026-05-04

## Context

ADR-017 closed the bundle-leak surface for environment variables by removing the `next.config.ts` `env` block and routing values through Amplify Console → `amplify.yml` → `.env.production`. That mechanism stops secrets from being inlined into the client JavaScript bundle, but it has a documented residual risk: `.env.production` ends up plaintext inside the build artifact, readable by anyone with `amplify get-app`-level access. Amplify Gen 2 docs are explicit on this point — env-var values render in plaintext to build artifacts.

For genuinely sensitive credentials (vendor API keys, shared secrets), an at-rest plaintext copy in the build artifact is unwanted. The remedy described in `node_modules/next/dist/docs/.../environment-variables.md` and the AWS Builder Center guide is to read true secrets from AWS Secrets Manager at runtime via the SDK, never letting them touch the build artifact.

This ADR records the decision to migrate three of the app's secrets to Secrets Manager, the resolver pattern that makes it backward-compatible, and the framework-imposed carve-outs for the remaining two.

## Decision

1. **Three secrets migrate to AWS Secrets Manager**, fetched at runtime via the AWS SDK from server-only code:
   - `ANTHROPIC_API_KEY` → `freshcast/anthropic-api-key`
   - `RESEND_API_KEY` → `freshcast/resend-api-key`
   - `CRON_SECRET` → `freshcast/cron-secret`

   All three live in region `ap-southeast-2` to match the rest of the AWS footprint and the default in `src/lib/aws-config.ts`.

2. **A hybrid resolver in `src/lib/secrets.ts`** mediates every read. Resolution order:
   1. `process.env[envName]` — when set, returned immediately. Used for local development (via `.env.local`), preview branches that don't need SM, and as a manual override or rollback during an SM outage.
   2. AWS Secrets Manager at the configured ID — fetched once per warm Lambda container and memoized at the module level for the rest of the container's lifetime.

   On SM error the resolver returns `null` so callers can degrade gracefully (matches the existing graceful-degradation pattern in `claude.ts` and `email.ts`).

3. **`'server-only'` boundary preserved.** `secrets.ts` carries `import "server-only"` and is itself only imported by other server-only modules (`claude.ts`, `email.ts`, server API routes). Tests use the existing vitest alias for `server-only`.

4. **Two secrets remain in `process.env` / `.env.production` by design**, due to framework constraints that make runtime SM resolution impractical:
   - `DATABASE_URL` — Prisma's `PrismaPg` adapter requires the connection string at synchronous client construction; module-load `await` on SM would add cold-start latency to every Lambda spin-up and complicate the Prisma singleton pattern.
   - `AUTH_SECRET` — Auth.js (`next-auth` v5) reads `process.env.AUTH_SECRET` during package initialization, before any application code runs. There is no clean async hook to inject a value fetched from SM.

   Both carve-outs accept the residual plaintext-in-build-artifact risk for these two values and rely on rotation discipline (Amplify Console → redeploy) when they need to change.

5. **IAM is least-privilege.** The Amplify SSR Lambda execution role has an inline policy granting `secretsmanager:GetSecretValue` on exactly the three secret ARNs above (with the `-*` suffix that SM appends). It does **not** receive the AWS-managed read-all SM policy.

6. **Phase 33.1.1 of the implementation plan is closed by this ADR.** The acceptance criteria are tightened to reflect the actual scope (three secrets migrated, two carve-outs documented).

## Rationale

- **Zero exposure for the migrated secrets.** Once the env-var entries for `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, and `CRON_SECRET` are removed from the Amplify Console, those values exist only in SM. They are never written to `.env.production`, never inlined into any bundle, and never visible from `amplify get-app`.
- **No regression for local development.** The hybrid resolver's env-first lookup means `npm run dev` continues to work from `.env.local` with no AWS calls and no SM credentials needed.
- **No regression on cold-start performance.** SM is hit once per warm Lambda container per secret, then cached. Cold start adds ~50–150ms total for the first request that touches each secret; subsequent requests in the same container pay nothing.
- **Cost is negligible.** Three secrets × $0.40/month + a few hundred GetSecretValue calls per warm-up × $0.05 per 10k calls. Under one US dollar per month.
- **Rotation story is well-defined.** A secret rotated in SM takes effect on the next deploy (which spawns new Lambdas). This matches the operational model the team already understands for env-var rotation. A rotation that needs to take effect mid-container can be forced by an Amplify redeploy.
- **Framework-constrained carve-outs are honoured.** Forcing `DATABASE_URL` or `AUTH_SECRET` through SM would require either top-level `await` at module load (Prisma) or a synthetic env-var injection hook (Auth.js) — both viable but with operational sharp edges that outweigh the marginal security benefit at this scale.

## Consequences

- **Operator pre-work was required and is complete.** The three SM secrets have been created, and the SSR Lambda role has the inline IAM policy attached.
- **Rollout is risk-free at deploy time.** Amplify Console env vars for the three migrated secrets remain set during the cutover; the hybrid resolver returns the env value first, so the SM path is not exercised on day one. The SM path becomes load-bearing only when the Amplify Console env vars are subsequently removed.
- **Recommended cutover sequence.** After this PR ships:
  1. Confirm app behaviour is unchanged (env-first path still active).
  2. Remove `ANTHROPIC_API_KEY` from the Amplify Console; remove the corresponding line from `amplify.yml`'s server-only regex; redeploy. Verify chat still works (now exercising the SM path). Rollback path: re-add the env var and redeploy.
  3. Repeat for `RESEND_API_KEY` (verify password-reset email).
  4. Repeat for `CRON_SECRET` (manually trigger the weekly-summary endpoint with `Authorization: Bearer <value>` and confirm 200, not 401).
- **Rollback path is preserved by design.** If SM goes down, the IAM policy gets accidentally detached, or any other SM-path failure occurs in production, setting the env var back in Amplify Console (and re-adding it to `amplify.yml`) restores service immediately on the next deploy. The hybrid resolver guarantees env always wins.
- **Caching has a knowable failure mode.** Forever-per-warm-container caching means a rotated SM value does not take effect until the container recycles. For practical purposes this is the same as env-var rotation behaviour. If a future scenario demands mid-container rotation (e.g. emergency credential revocation), an Amplify redeploy is the operational lever.
- **Build artifact is now genuinely cleaner for these three values.** `amplify.yml` will no longer write them to `.env.production` after the cutover above; `amplify get-app` will no longer surface them.
- **Tests need no per-test setup.** The hybrid resolver returns the env value when set, so any test that imports a migrated module (claude, email, or the cron route) just needs the relevant env var in its environment, which is the same situation as before this change.

## Carve-outs and follow-ups

- `DATABASE_URL` and `AUTH_SECRET` continue to live in `.env.production`. A future ADR should be opened only if a credible threat model emerges that justifies the framework-fighting required to migrate them.
- The Phase 33.1.2 / 33.1.3 work (Bedrock alternative AI provider, Amazon Translate) is independent of this ADR.

## References

- ADR-017 — `next.config` env removal and the `.env.production` mechanism that this ADR builds on.
- AWS Amplify Hosting docs: [Making environment variables accessible to server-side runtimes](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-environment-variables.html).
- AWS Amplify Gen 2 docs: [Secrets and environment vars](https://docs.amplify.aws/react/deploy-and-host/fullstack-branching/secrets-and-vars/) — explicit warning that env-var values render plaintext in build artifacts.
- AWS Secrets Manager docs: [GetSecretValue API reference](https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html).
- Implementation Plan §33.1.1 — closed by this ADR.
