# Coding Assertions

## Before commit

| Order | Command | Checks |
| ----- | ------- | ------ |
| 1 | `pnpm run setup:gitleaks` | Install the pinned official detector once per clone. |
| 2 | `pnpm test` | Unit tests, publication audit, application/tooling TypeScript, and ESLint. |

## Before push

| Order | Command | Checks |
| ----- | ------- | ------ |
| 1 | `node_modules/.bin/gitleaks git --redact=100 --no-banner` | Full-history secret scan. |
| 2 | `pnpm run test:release` | Format, publication, unit, type, lint, one production build, strict Cloud Chromium E2E and audits — contrast, scale, `audit:ui` (every `components/ui/` file still matches the `@coss` registry it was installed from), and landing. |
