# apps/web: the App and the Legacy API

## Next.js 16

This is Next.js 16, and its APIs, conventions and file layout differ from your training data (for example, `proxy.ts` replaces middleware). Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/` and follow its deprecation notices.

## Conventions

- Env lives in `apps/web/.env`; `src/lib/env.ts` validates it.
- Modules in `src/lib` that reach the database, AWS, Claude or secrets import `server-only`.
- Legacy API routes return the `{ data }` / `{ error }` envelope through `ok()` and `errorResponse()` in `src/lib/api-helpers.ts`, and scope every query to the Business from `getBusinessId()` (ADR-008).
- User-facing strings live in `src/messages/en.json` (next-intl).
- Colours come from the semantic tokens in `src/app/globals.css`, so both Appearances render.
- Keep the post-build `scripts/materialize-next-aliases.mjs` step; Amplify needs it ([Architecture §11.3](../../docs/ARCHITECTURE.md#113-aws-amplify-production)).

## Tests

Write component tests, stories and journeys as described in [docs/TESTING.md](../../docs/TESTING.md).
