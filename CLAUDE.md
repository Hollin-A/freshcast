# Freshcast

Freshcast helps Vendors log sales and forecast tomorrow's prep. Use the words in [GLOSSARY.md](GLOSSARY.md). Package-specific conventions load from each package's own `CLAUDE.md`.

## Workflow

- **Change code or the repo only on an explicit go-ahead** such as "go", "do it", "implement" or "yes, proceed". Treat questions and planning ("can we…?", "should we…?", "what do you think about…?", "give me a plan") as read-only discussion, and ask when unsure.
- Before changing anything, suggest a branch from `main`: `feat/`, `fix/`, `refactor/`, `chore/`, `docs/`, or `ui/` for frontend presentation-only work (limited by a scope guard to `.github/ui-paths`, see [CONTRIBUTING](CONTRIBUTING.md#ui-only-branches)).
- Use conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `style:`, `test:`) with short imperative subjects.
- Write PR bodies with the `mattpocock-skills:pr` skill; a hook and the `pr-body` check enforce its template.
- Update docs in the same change as the behaviour they describe, using the [documentation sync table](CONTRIBUTING.md#documentation-sync-requirements) to find the file.

## Turborepo

Turborepo's config and CLI differ between versions and may not match your training data. Before changing `turbo.json` or Turborepo commands, read `docs/README.md` in the installed `turbo` package (`node -p "require.resolve('turbo/package.json')"`) and the pages it points to.

## Agent skills

- **Issue tracker:** GitHub Issues for `Hollin-A/freshcast`, through the `gh` CLI. See `docs/agents/issue-tracker.md`.
- **Triage labels:** the default five roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) alongside the `area:*` / `type:*` labels. See `docs/agents/triage-labels.md`.
- **Domain docs:** single context, with `GLOSSARY.md` at the root and system-wide ADRs in `docs/adr/`. See `docs/agents/domain.md`.
