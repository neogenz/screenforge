# VCS

## Setup

- Main branch: `main`
- Platform: GitHub (`neogenz/screenforge`)
- CI: `.github/workflows/quality.yml` runs independent secret, quality, build, test, and release-readiness jobs on pushes and pull requests.
- Releases: Release Please maintains the changelog and release pull request through a repository-scoped GitHub App. A canonical `v*` tag created from `main` is the only production-deployment trigger.
- Ticketing: none recorded in the repository; work records live under `aidd_docs/tasks/`.

## Branches

- Feature branches merged into `main`; the current repository history uses `codex/<short-description>` for Codex work.

## Commits

- Convention: Conventional Commits.
- Observed formats: `feat:`, `fix(scope):`, `refactor:`, `test:`, and `docs:` followed by a concise imperative description.
- Pull-request titles follow Conventional Commits because squash merge makes the title the commit on `main`; release tags are never created manually.
- Public-repository rulesets require reviewed, strictly green pull requests on `main` and protect `v*` tags from manual creation, update, or deletion.
- Keep implementation and its sanitized AIDD task/review records aligned; only commit or push when the user has authorized the implementation or publication workflow.
