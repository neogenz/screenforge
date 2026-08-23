# VCS

## Setup

- Main branch: `main`
- Platform: GitHub (`neogenz/screenforge`)
- CI, environments and the release pipeline: `deployment.md`. Only what the convention asks of an author is repeated here.
- Ticketing: GitHub Issues inbound, work records under `aidd_docs/tasks/` — see `backlog.md`.

## Branches

- Feature branches merged into `main`, named `<agent>/<short-description>` after the agent that opened them (`codex/`, `claude/`).
- `preprod` is a protected long-lived promotion branch. Update it only through
  a merge-commit pull request from `main`; its tree must equal the current
  `main` tree before Convex can deploy. Vercel owns the stable branch Preview,
  while Quality owns the gated Convex preproduction deployment.

## Commits

- Convention: Conventional Commits.
- Observed formats: `feat:`, `fix(scope):`, `refactor:`, `test:`, `chore:`, `ci:` and `docs:` followed by a concise imperative description. Subjects are written in French or English; the repository has never enforced one, and neither should a change.
- Pull-request titles follow Conventional Commits because squash merge makes the title the commit on `main`; release tags are never created manually.
- Rulesets require reviewed, strictly green pull requests on `main`, and reserve `v*` tag creation to the Release GitHub App. Never create, move or delete a tag by hand.
- Keep implementation and its sanitized AIDD task/review records aligned; only commit or push when the user has authorized the implementation or publication workflow.
