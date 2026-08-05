# VCS

## Setup

- Main branch: `main`
- Platform: GitHub (`neogenz/screenforge`)
- CI: `.github/workflows/quality.yml` runs the full release gate on pushes and pull requests.
- Ticketing: none recorded in the repository; work records live under `aidd_docs/tasks/`.

## Branches

- Feature branches merged into `main`; the current repository history uses `codex/<short-description>` for Codex work.

## Commits

- Convention: Conventional Commits.
- Observed formats: `feat:`, `fix(scope):`, `refactor:`, `test:`, and `docs:` followed by a concise imperative description.
- Keep implementation and its AIDD task/review records aligned; do not commit or push unless explicitly requested.
