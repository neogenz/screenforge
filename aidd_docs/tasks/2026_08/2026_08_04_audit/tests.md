# Codebase Audit: tests
La couverture fonctionnelle du risque produit est excellente et toute la suite passe ; l’outillage E2E n’est toutefois pas typé par la gate et dépend trop de délais fixes.

- **Date**: 2026-08-04
- **Scope**: Vitest, Playwright, export, lint/typecheck et release gate
- **Health**: good
- **Findings**: 0 critical, 2 warning, 1 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
|---|---|---|---|---|---|
| 🟡 | tests | `tsconfig.app.json:23` | Le typecheck n’inclut que `src`. `e2e/`, `playwright.config.ts` et les scripts peuvent donc dériver de leurs contrats TypeScript sans que `pnpm test` échoue ; l’interface manuelle `window.__sfStores` a déjà montré cette faiblesse. | Ajouter un `tsconfig.tools.json` minimal pour E2E/config et l’appeler depuis `typecheck`. Étendre ensuite ESLint à ces fichiers avec les globals Node/Playwright adaptés. | S |
| 🟡 | tests | `e2e/canvas-transforms.spec.ts:28` | Les E2E contiennent 48 `waitForTimeout`, dont 24 dans les transforms. La suite passe mais dure 2,2 min sur un worker et lie sa fiabilité à la vitesse de la machine ; Playwright réserve ces délais au debug. | Remplacer progressivement par `expect.poll`, assertions web-first ou un helper qui attend l’état canvas/store précis. Commencer par `helpers.ts` pour supprimer plusieurs waits d’un coup. | M |
| 🟢 | tests | `package.json:20` | `test:release` compose bien toutes les gates, mais aucun workflow CI n’est présent. La qualité dépend donc de l’exécution manuelle avant push/merge. | Si le dépôt distant est utilisé pour collaborer ou livrer, ajouter un workflow unique Node/pnpm qui exécute `pnpm test:release`; sinon conserver la gate locale sans ajouter de CI spéculative. | S |

## Top actions

1. Résoudre le finding tests #1 avec `aidd-dev:06-test` : typechecker E2E, configs et scripts dans la gate existante.
2. Résoudre le finding tests #2 avec `aidd-dev:06-test` : remplacer les waits fixes par les contrats store/canvas déjà exposés.
3. Résoudre le finding tests #3 avec `aidd-dev:02-implement` uniquement si le dépôt a une CI distante : automatiser `test:release`.

## Coverage

- **Scanned**: tests — 46 tests unitaires passants, 56 E2E passants, 1 test matériel explicitement ignoré, build/typecheck/lint, export pixel-exact, contraste et organisation de la suite.
- **Skipped**: aucun outil de coverage configuré, donc inspection statique des gaps seulement ; WebKit/Firefox et bezel Apple réel sans `APPLE_BEZEL_PATH`/`APPLE_SCREENSHOT_PATH`.
