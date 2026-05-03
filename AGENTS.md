<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Workflow and Documentation Rules

- **Only make code or repo changes when explicitly asked.** Treat planning and discussion turns as read-only. Phrases like "can we…?", "should we…?", "what do you think about…?", "give me a plan", or "any insights?" are invitations to discuss, not approval to implement. Wait for an explicit go-ahead such as "go", "do it", "implement", "make the change", or "yes, proceed" before editing files, creating branches, running migrations, or making commits. When in doubt, ask first.
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
