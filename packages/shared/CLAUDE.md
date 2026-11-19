# packages/shared: @freshcast/shared

Zod request schemas, response types and constants, imported by browser forms, the Legacy API and the API.

- Browser code imports this package, so it imports only `zod` and its own modules; its lint config enforces that.
- Response types cover both contracts: the Legacy API's `{ data }` envelope, and Problem Details, `Page` and `PROBLEM_CODES` for the API (ADR-023).
