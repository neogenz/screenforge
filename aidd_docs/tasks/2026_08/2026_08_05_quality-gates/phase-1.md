---
status: done
---

# Instruction: Prettier + lint-staged wiring

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── .prettierrc            ✅ Prettier options (minimal, matches existing style)
├── .prettierignore        ✅ dist, test-results, playwright-report, pnpm-lock, aidd_docs, specs
├── eslint.config.js       ✏️ append eslint-config-prettier last, to disable conflicting rules
├── package.json           ✏️ add `format` / `format:check` scripts + `lint-staged` key
└── src/, e2e/, scripts/   ✏️ one-time `prettier --write` pass (no logic change)
```

## Tasks to do

### `1)` Prettier config files

> Pin formatting rules so every contributor formats identically.

1. Create `.prettierrc`: `{ "semi": false, "singleQuote": true, "trailingComma": "all", "printWidth": 100 }` — mirrors the existing code style in `eslint.config.js` and `src/`.
2. Create `.prettierignore`: `dist`, `test-results`, `playwright-report`, `pnpm-lock.yaml`, `.pnpm-store`, `aidd_docs`, `specs`, `*.tsbuildinfo`.

### `2)` Wire Prettier into ESLint

> Let ESLint own code-quality rules, Prettier own formatting — zero overlap.

1. In `eslint.config.js`, import `eslint-config-prettier` and append it as the last element of `tseslint.config(...)`.
2. Run `pnpm lint` — must exit 0.

### `3)` Scripts + lint-staged config

> Make formatting and staged-file checks one command each.

1. Add to `package.json` scripts: `"format": "prettier --write ."` and `"format:check": "prettier --check ."`.
2. Add a `lint-staged` key in `package.json`:
   - `"*.{ts,tsx,js,mjs}"`: `["prettier --write", "eslint --fix"]`
   - `"*.{css,md,json,html}"`: `["prettier --write"]`

### `4)` One-time format pass

> Reformat the whole repo once so future diffs stay clean.

1. Run `pnpm format`.
2. Run `pnpm lint` and `pnpm typecheck` — both must exit 0.
3. Commit as `style: apply prettier formatting across the codebase` (isolated commit, no logic change).

## Test acceptance criteria

| Task | Acceptance criteria                                                              |
| ---- | -------------------------------------------------------------------------------- |
| 1    | `pnpm exec prettier --check .prettierrc` succeeds; ignore list excludes build artifacts and docs folders |
| 2    | `pnpm lint` exits 0 with eslint-config-prettier active                            |
| 3    | Editing a staged `.ts` file then running `pnpm exec lint-staged` reformats and lints only that file |
| 4    | After the format pass, `pnpm format:check` exits 0 and `pnpm test:unit` still passes |
