# Backlog

## Supports

| Support | Authority for | Role |
| --- | --- | --- |
| `aidd_docs/tasks/` | Specs, plans, phases, reviews | The working record of a scoped piece of work, versioned with the code that implements it |
| GitHub Issues | Bug reports, feature requests | The inbound channel for the public repository |
| GitHub Pull Requests | The unit that lands | Squash-merged; its title becomes the commit on `main` |

## Structure

- There is no epic or story hierarchy. A unit of work is one dated directory under `aidd_docs/tasks/{YYYY_MM}/{YYYY_MM_DD}_{slug}/`, and the phase files inside it are the only decomposition.
- Almost every directory holds a `plan.md` and at least one `phase-N.md`; about half also carry a `review.md`, and a few a `brainstorm.md`, `verification.md` or `assert.md`. The shape follows the work rather than a fixed template.
- The date in the directory name is when the work opened, not when it closed. Directories are never renamed or removed once merged: the archive is how a decision is traced back.

## Representation

| Artifact | Support | Native representation |
| --- | --- | --- |
| Task record | `aidd_docs/tasks/` | A dated directory of Markdown |
| Bug | GitHub Issues | `bug_report.yml`, titled `[Bug]: `, labelled `bug`, with an Area dropdown |
| Feature | GitHub Issues | `feature_request.yml`, titled `[Feature]: `, labelled `enhancement` |
| Vulnerability | GitHub Security Advisories | Private report — never a public issue, per `ISSUE_TEMPLATE/config.yml` |

## Workflow

- State is not tracked in a field. A task directory that exists is work that was scoped; the pull request that references it is what says whether it landed.
- Issues carry only the labels their template applies. No board, no sprint, no status column.

## Planning

- Priority, estimation and iteration: none recorded. The project has one maintainer and no cadence to encode.
- Milestone: the release, cut by Release Please from conventional commits. See `vcs.md` and `deployment.md`.

## Relations

- Task record to code: the commit and pull request that implement a directory reference it. Keep implementation and its sanitized task record aligned in the same change.
- Everything under `aidd_docs/` is published as-is and scanned by Gitleaks and `pnpm run audit:publication` with no path exception. Raw evidence — tokens, environment values, unredacted CLI output, signed URLs — stays in `.private/`, which Git ignores. The versioned record keeps only a redacted result.
