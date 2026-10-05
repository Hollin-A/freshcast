// Vitest stub for the `server-only` package.
//
// The real `server-only` module throws on import to enforce the
// server-component boundary at build time. Vitest runs in plain Node and
// is not a Next.js bundler context, so it would always trip that guard
// and break every test that transitively imports a server-only module.
//
// Aliasing `server-only` to this empty module in vitest.config.ts lets the
// tests run while keeping the real safeguard in place for production
// builds (Next.js still rejects any client-side import of guarded modules).
//
// See docs/adr/017-next-config-no-env.md.
export {};
