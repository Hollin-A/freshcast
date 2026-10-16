# ADR-022: App on `app.freshcast.site`, Landing Site at the Root Domain

## Status
Accepted. Builds on [ADR-020](020-dedicated-nestjs-backend.md) D2 (direct API domain with `.freshcast.site` cookies).

## Date
2026-10-16

## Context

The App is served at the root domain `freshcast.site`, and ADR-020 moves the API to `api.freshcast.site` in Stage 6. Freshcast needs a public Landing site that explains the product, and the Landing site needs an address.

Moving the App to a new host has costs that a path change does not:
- **Installed PWAs are bound to their origin.** Users who installed the App from `freshcast.site` must reinstall it from the new host.
- **The Auth.js session cookie is host-only.** Every user is signed out once.
- **Email links are built from `AUTH_URL`.** Verification and password-reset links already sent point at the old host.

Stage 6 already signs every user out, because the API takes over identity and Auth.js is removed.

## Decision

1. **The Landing site takes the root domain** (`freshcast.site`, with `www` redirecting to it). **The App moves to `app.freshcast.site`.**
2. **The Landing site is a separate static app** (`apps/landing`, Next.js static export) deployed as its own Amplify app. Brand tokens and assets shared with the App live in `packages/brand`.
3. **The App moves in the same cutover as Stage 6**, so users sign in again once rather than twice. The cutover is a migration-track issue that #47 depends on.
4. **Old App paths on the root domain redirect** to the same path on `app.freshcast.site`, including `/reset-password` and `/verify` so links in emails already sent keep working.
5. Until the cutover, the Landing site is reviewed on an Amplify preview URL.

## Rationale

- Marketing at the root and the product on `app.` is the common convention, and keeps marketing deploys, SEO and caching separate from the App.
- `app.freshcast.site` and `api.freshcast.site` are same-site, so the `.freshcast.site` cookie model in ADR-020 D2 is unchanged.
- A separate static app means a broken App deploy cannot take the Landing site down, and the Landing site does not run on the App's SSR runtime.
- Batching the move with Stage 6 limits the disruption for existing users to a single sign-out.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Keep the App at the root, Landing site on `www.` or `get.` | Unconventional; the root is where visitors land |
| One Next.js app serving both hosts, split in `src/proxy.ts` | Couples marketing to App deploys and puts host routing in the file Stage 6 rewrites |
| Hosted site builder (Framer, Webflow) | Brand drifts from the App; no review, tests or shared tokens |
| Separate repository | Sharing the Brand needs a published package or copied files; two CI setups |

## Consequences

- `amplify.yml` moves to the multi-app (`applications:`) format. Because of #65 and #67, this change is tested on a preview branch before production.
- Amplify manages DNS records for `freshcast.site`, `www` and `app.` in the existing Route 53 zone; CDK keeps owning `api.` (ADR-021).
- `AUTH_URL` changes to `https://app.freshcast.site` at the cutover.
- Users with an installed App reinstall it from the new host. The cutover should be announced to existing users.
