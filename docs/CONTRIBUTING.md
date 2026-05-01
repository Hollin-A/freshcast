# Contributing to Freshcast

Thanks for contributing. This guide keeps changes reviewable and docs consistent.

## Branching

Create a branch from `main` before starting:

```bash
git checkout main
git pull
git checkout -b feat/short-description
```

Branch naming:

- `feat/{short-description}` for features
- `fix/{short-description}` for bug fixes
- `docs/{short-description}` for docs-only changes

Use kebab-case and keep branch names short.

## Commit style

Freshcast uses conventional commits:

- `feat: ...`
- `fix: ...`
- `docs: ...`
- `refactor: ...`
- `chore: ...`
- `style: ...`
- `test: ...`

Rules:

- Lowercase subject line
- Imperative mood (for example: "add parser fallback")
- Keep subject under 72 characters
- Group related work into one logical commit

## Pull requests

PRs should be small and focused. Include:

- What changed
- Why it changed
- How you verified it
- Any follow-up work

Recommended checklist:

- [ ] `npm run lint`
- [ ] `npm run typecheck` (or equivalent type check command)
- [ ] `npm test`
- [ ] Manual smoke test for affected user flow

## Documentation sync requirements

When code changes behavior, update matching docs in the same PR.

| File | Update when |
|---|---|
| `README.md` | Entrypoint-level feature list, setup, stack, or links change |
| `docs/PRD.md` | Product scope, requirements, or non-goals change |
| `docs/TDD.md` | Architecture, services, data model, or runtime flow changes |
| `docs/API.md` | API routes, request/response contracts, or auth requirements change |
| `docs/IMPLEMENTATION_PLAN.md` | Phase/task completion status changes |
| `docs/adr/` | A significant architectural decision is made |
| `CHANGELOG.md` | User-visible shipped behavior changes |

ADR rule:

- Add a new ADR with the next sequential number for significant decisions
- Mark old ADRs as superseded when replaced

## Next.js 16 note

This project uses Next.js 16 with breaking changes versus earlier versions.
If your change touches routing, middleware/proxy, rendering, or config conventions, verify against current Next.js 16 docs in the installed package docs.

## Merge flow

After PR approval:

```bash
git checkout main
git pull
git merge <your-branch>
```

