---
objective: "Every commit is locally gated by Prettier + ESLint on staged files, validated by commitlint (conventional, English), and every push passes typecheck."
status: implemented
---

# Plan: Git quality gates (commitlint, Husky, lint-staged, Prettier)

## Overview

| Field      | Value                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| **Goal**   | Add local Git quality gates: Prettier formatting, lint-staged, commitlint, Husky hooks                 |
| **Source** | User request in session — add the important quality gates; commits in English from now on              |

Constraints stated by the source:

- Commit messages must be conventional and written in English going forward.
- Pre-push hook runs typecheck only (not unit tests, not E2E).
- No commitlint job in GitHub CI — local enforcement only.
- Prettier adopted alongside ESLint, wired without rule conflicts.

Existing state (verified in repo):

- ESLint 9 flat config (`eslint.config.js`), `tsc` typecheck, Vitest, Playwright, contrast/scale audits already exist and run in CI (`quality.yml`).
- Dev dependencies already installed this session: `prettier`, `eslint-config-prettier`, `@commitlint/cli`, `@commitlint/config-conventional`, `husky`, `lint-staged`. No config files created yet.
- Git history already follows conventional-commit prefixes (`feat(scope):`, `fix(scope):`, `docs:`), in French.

## Phases

| #   | Phase                              | File                         |
| --- | ---------------------------------- | ---------------------------- |
| 1   | Prettier + lint-staged wiring      | [`phase-1.md`](./phase-1.md) |
| 2   | Commitlint + Husky hooks           | [`phase-2.md`](./phase-2.md) |

## Resources

| Source                                                | Verified                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------- |
| https://commitlint.js.org/reference/rules.html        | Rule names for conventional config (`subject-case`, `type-enum`)    |
| https://typicode.github.io/husky/get-started.html     | Husky v9 hook layout (`.husky/<hook>` plain files, `prepare` script) |
| https://github.com/lint-staged/lint-staged            | Config via `lint-staged` key in package.json                        |
| https://github.com/prettier/eslint-config-prettier    | Disables formatting rules; must be last in flat config extends      |

## Decisions

| Decision                                  | Why                                                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| Local-only gates, CI untouched            | User explicitly rejected commitlint in CI; CI already runs the full release gate       |
| One dedicated `style:` format commit      | Prettier's first pass touches most files; isolating it keeps feature diffs reviewable  |
| No language enforcement in commitlint     | commitlint cannot detect French vs English; English convention is social, not technical |
