---
inclusion: always
---

# Version Tracking & Documentation Maintenance

## Git Branching

When making code changes, always advise the user on branching:

- **Before starting work**, suggest creating a branch from `main`
- **Branch naming convention** (matches existing repo patterns):
  - `feat/{short-description}` — new features or enhancements (e.g., `feat/csv-import`, `feat/phase-21-voice-input`)
  - `fix/{short-description}` — bug fixes (e.g., `fix/parser-unit-handling`, `fix/dashboard-empty-state`)
  - `docs/{short-description}` — documentation-only changes (e.g., `docs/documentation-update`)
- Use kebab-case, keep it concise and descriptive
- Suggest the branch name explicitly: `git checkout -b feat/your-branch-name`

## Commit Messages

Follow conventional commits (matches existing repo style):

- `feat: description` — new feature
- `fix: description` — bug fix
- `docs: description` — documentation changes
- `refactor: description` — code restructuring without behavior change
- `chore: description` — tooling, config, dependencies
- `style: description` — formatting, whitespace, no logic change
- `test: description` — adding or updating tests

Rules:
- Lowercase, no period at the end
- Imperative mood ("add", not "added" or "adds")
- Keep the subject line under 72 characters
- After completing a logical unit of work, suggest a commit with the message
- Group related changes into a single commit when possible

## Documentation Maintenance

The following docs MUST be kept in sync when code changes affect them:

| File | Update When |
|------|-------------|
| `docs/PRD.md` | Features added/removed, requirements changed, scope changes |
| `docs/TDD.md` | Architecture changes, new services, data model changes, API contract changes |
| `docs/API.md` | Any API route added, modified, or removed |
| `docs/IMPLEMENTATION_PLAN.md` | Tasks completed, new phases added, status changes |
| `docs/adr/` | Significant architectural decisions made (create new ADR with next sequential number) |
| `README.md` | Major feature additions, tech stack changes, setup instructions changed |

Rules:
- After completing code changes, check if any of the above docs need updating
- When updating `docs/IMPLEMENTATION_PLAN.md`, mark completed tasks/phases appropriately
- When a new ADR is needed, follow the existing format in `docs/adr/` with the next number (currently up to 016)
- Documentation updates can be included in the same commit as code changes (use `feat:` or `fix:` prefix) or as a separate `docs:` commit if the update is standalone

## Workflow Reminders

At key moments, remind the user:
1. **Before starting**: "You should branch off main: `git checkout -b feat/branch-name`"
2. **After a logical chunk of work**: "Good point to commit: `git add -A && git commit -m 'feat: description'`"
3. **After all changes are done**: "Ready to merge: `git checkout main && git merge feat/branch-name`"
4. **If docs were affected**: Call out which docs were updated and why
