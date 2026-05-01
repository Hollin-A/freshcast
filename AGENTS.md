<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Workflow and Documentation Rules

- Before making changes, suggest branching from `main`:
  - `feat/{short-description}`
  - `fix/{short-description}`
  - `docs/{short-description}`
- Use conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `style:`, `test:`) with short imperative subjects.
- Keep docs in sync when behavior changes:
  - `docs/PRD.md` for scope/requirements changes
  - `docs/TDD.md` for architecture/runtime/service changes
  - `docs/API.md` for endpoint/contract changes
  - `docs/IMPLEMENTATION_PLAN.md` for phase/task status changes
  - `docs/adr/` for significant architecture decisions (next sequential ADR)
  - `README.md` for top-level setup/feature/stack changes
  - `CHANGELOG.md` for user-visible shipped changes
