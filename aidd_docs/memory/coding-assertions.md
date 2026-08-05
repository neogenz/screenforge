# Coding Assertions

## Before commit

| Order | Command | Checks |
| ----- | ------- | ------ |
| 1 | `pnpm test` | Unit tests, application/tooling TypeScript, and ESLint. |

## Before push

| Order | Command | Checks |
| ----- | ------- | ------ |
| 1 | `pnpm run test:release` | Fast gate, production build, Chromium E2E, and contrast audit. |
