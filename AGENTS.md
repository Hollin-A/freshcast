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
- Keep docs in sync when behavior changes. See the documentation-sync table in [`CONTRIBUTING.md`](./CONTRIBUTING.md#documentation-sync-requirements) for which file to update; the canonical homes are `README.md` (entrypoint), `docs/ARCHITECTURE.md` (architecture/services/data model), `docs/API.md` (endpoint contracts), `docs/adr/` (decisions), and `CHANGELOG.md` (shipped changes).

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
