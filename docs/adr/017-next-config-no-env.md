# ADR 017: No Runtime Env in `next.config`

**Status:** Accepted
**Date:** 2026-05-03

## Context

AWS Amplify Hosting executes Next.js in two distinct contexts:

1. The **build container**, where `next build` runs.
2. The **SSR Lambda**, where requests are served at runtime (route handlers, server components, server actions).

Variables set in **Amplify Console → Environment variables** are injected into the build container's `process.env` but are **not** automatically propagated to the SSR Lambda. So `process.env.X` works during `next build` and silently becomes `undefined` at request time. AWS engineering acknowledged this as a bug in `aws-amplify/amplify-hosting#1987` (June 2021); the issue was eventually closed without an in-thread "fixed in" announcement, with the resolution being "use the patterns AWS now documents." See AWS Amplify Hosting docs: [Making environment variables accessible to server-side runtimes](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-environment-variables.html).

To unblock SSR access to env vars, this app's `next.config.ts` listed every server var — including secrets (`DATABASE_URL`, `AUTH_SECRET`, `RESEND_API_KEY`, `CRON_SECRET`, `ANTHROPIC_API_KEY`) and non-secrets (`APP_AWS_REGION`, `S3_RECEIPTS_BUCKET`, `SES_FROM_EMAIL`, `AUTH_URL`) — under the `env` config option.

The `env` field in `next.config` is a **build-time string substitution** (webpack `DefinePlugin`). The official Next.js docs are explicit:

> "environment variables specified in this way will **always** be included in the JavaScript bundle, prefixing the environment variable name with `NEXT_PUBLIC_` only has an effect when specifying them through the environment or .env files."
> — `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/env.md`

Every `process.env.X` reference in any module reachable from a client entry was therefore inlined as a literal in the browser bundle. None of the server-only lib modules (`src/lib/{prisma,email,ses,claude,s3,aws-config,env}.ts`) carried `'server-only'` markers, so the only thing preventing a wide-open leak was bundler tree-shaking — fragile, and one careless `import` away from shipping every credential.

The supported alternative ([Next.js: How to use environment variables](https://nextjs.org/docs/app/guides/environment-variables); [AWS Builder Center: How to add server-side environment variables in Next.js on AWS Amplify using `amplify.yml`](https://builder.aws.com/content/35HqLJQjJ2bXcPdG2SSCXRGVf8A/how-to-add-server-side-environment-variables-in-nextjs-on-aws-amplify-using-amplifyyml)) is to write Amplify Console env vars into `.env.production` from `amplify.yml` immediately before `next build`, where Next.js's native `.env` loader picks them up. Server-only vars stay server-side; only `NEXT_PUBLIC_*` cross to the client bundle, per Next.js's standard `NEXT_PUBLIC_` semantics.

## Decision

1. The `env` key in `next.config.ts` is **not used** for any variable, secret or non-secret. The `env` block is removed entirely.
2. Runtime configuration — secrets and non-secrets alike — is supplied via Amplify Console environment variables, which `amplify.yml` writes into `.env.production` immediately before `next build`. Next.js loads them into `process.env` natively, with the standard server-only / `NEXT_PUBLIC_` boundary.
3. Server-only modules that read secret env vars (`src/lib/{prisma,env,email,ses,claude,s3,aws-config}.ts`) import `'server-only'` to fail the build at the boundary if a client component ever transitively imports them.
4. `NEXT_PUBLIC_*` continues to behave as documented by Next.js: `.env*` and process-env values prefixed with `NEXT_PUBLIC_` are inlined into the client bundle. The codebase currently has exactly one such variable (`NEXT_PUBLIC_SENTRY_DSN`, intentionally public), and that name remains correct.
5. True secrets remain candidates for migration to AWS Secrets Manager with runtime SDK fetch in **Phase 33.1.1** of the implementation plan; that path eliminates the residual plaintext-in-build-artifact risk that `.env.production` still has.

## Rationale

- Security outweighs convenience: the client bundle must not contain credentials. The `env` field is incompatible with that requirement because it inlines into bundles regardless of `NEXT_PUBLIC_` semantics.
- A single mechanism (Amplify Console → `amplify.yml` → `.env.production`) is simpler and less error-prone than splitting "secrets in console" / "non-secrets in `next.config`". It removes the temptation for a future contributor to "just add this one secret" to `next.config.ts`.
- `'server-only'` markers turn an implicit, bundler-dependent guarantee into an explicit, build-time check, and pair naturally with the env removal: removing `env` reduces *current* leakage, `'server-only'` prevents *future* leakage.
- Solution 2b (runtime Secrets Manager fetch) is the correct long-term home for true secrets but is a meaningful refactor; deferring to Phase 33.1.1 keeps this change small and safe.

## Consequences

- **Rotation required.** Every secret that was listed in `next.config.ts` `env` must be treated as compromised and rotated, since prior production builds may have shipped them in client chunks. At minimum: `AUTH_SECRET` (rotation invalidates all current sessions, by design), the Neon DB password (in `DATABASE_URL`), `CRON_SECRET`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`. Sentry source maps for affected releases should be purged, since they may carry the inlined values too.
- **Amplify Console is the source of truth** for every env var on every branch (`production` and any preview branches). `amplify.yml` only forwards what the Console provides; a missing var becomes `undefined` on the SSR Lambda.
- **`amplify.yml` build output is plaintext.** `.env.production` ends up inside the build artifact. Anyone with `amplify get-app`-level access to the deployment can read non-`NEXT_PUBLIC_` values. This is acceptable for the current threat model and significantly better than a public client bundle, but it is the gap that Phase 33.1.1 closes for true secrets.
- **Future SSR env gaps** — a new var that "doesn't show up" on the Lambda — are fixed by adding the var to the `amplify.yml` `.env.production` step, never by re-introducing entries to `next.config.ts` `env`.
- **`NEXT_PUBLIC_*` continues to work normally** through Next.js's native `.env` loading. No special handling needed beyond grepping for the prefix in `amplify.yml`.
- **Local development is unchanged.** `.env.local` is still the source of truth for `npm run dev`.
- **Test runner impact.** `import 'server-only'` throws at import time outside a Next.js bundler context, so any unit test that transitively imports a `'server-only'`-marked module will need the test runner to alias `server-only` to a no-op stub. This is a one-line `vitest.config.ts` change in the implementation PR.

## Related considerations (not required by this decision)

- **`AUTH_URL` fallback.** Three auth routes currently fall back to `"http://localhost:3000"` if `process.env.AUTH_URL` is missing (`src/app/api/auth/{signup,forgot-password,send-verification}/route.ts`). If Amplify ever fails to surface `AUTH_URL` to SSR — exactly the failure mode this ADR prevents — users in production would silently receive password-reset and email-verification links pointing at `http://localhost:3000`. Out of scope for this ADR, but worth deciding separately whether to keep the forgiving fallback or convert to a fatal `requireEnv("AUTH_URL")`.
- **Sentry DSN listing in `env`.** `NEXT_PUBLIC_SENTRY_DSN` was redundantly listed in `next.config.ts` `env`; Next.js's native `.env` loading already inlines `NEXT_PUBLIC_*`. Removing the redundant line has no functional effect on the public DSN.

## References

- Next.js docs (in `node_modules`): `01-app/03-api-reference/05-config/01-next-config-js/env.md` — the warning that `env` always inlines into the bundle.
- Next.js docs (in `node_modules`): `01-app/02-guides/environment-variables.md` — the supported `.env*` loading mechanism, including `NEXT_PUBLIC_` semantics and runtime env access via dynamic rendering.
- AWS Amplify Hosting docs: [Making environment variables accessible to server-side runtimes](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-environment-variables.html).
- AWS Builder Center: [How to add server-side environment variables in Next.js on AWS Amplify using `amplify.yml`](https://builder.aws.com/content/35HqLJQjJ2bXcPdG2SSCXRGVf8A/how-to-add-server-side-environment-variables-in-nextjs-on-aws-amplify-using-amplifyyml).
- AWS Amplify Hosting build specification: [`amplify.yml` reference](https://docs.aws.amazon.com/amplify/latest/userguide/yml-specification-syntax.html).
- AWS Amplify Gen 2: [Secrets and environment vars](https://docs.amplify.aws/react/deploy-and-host/fullstack-branching/secrets-and-vars/) — explicit warning that env-var values are rendered in plaintext to build artifacts.
- GitHub: [`aws-amplify/amplify-hosting#1987`](https://github.com/aws-amplify/amplify-hosting/issues/1987) — the originating bug report on Next.js SSR env vars not propagating to the Lambda.
- Implementation Plan §33.1.1 — long-term migration of secrets to AWS Secrets Manager.
