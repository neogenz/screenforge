# Codebase Audit: dependencies
Les choix de stack et les licences directes sont sains, mais le lockfile du 4 août contient des correctifs de sécurité déjà disponibles.

- **Date**: 2026-08-04
- **Scope**: dépendances directes/transitives, CVE, versions, licences et lockfile pnpm
- **Health**: good
- **Findings**: 0 critical, 3 warning, 0 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
|---|---|---|---|---|---|
| 🟡 | dependencies | `package.json:66` | Vite 8.0.3 est concerné par cinq avis high/moderate, dont lecture arbitraire via WebSocket et contournements `server.fs.deny`. Le script actuel écoute en loopback par défaut, ce qui réduit l’exposition, mais ne corrige pas le poste développeur si `--host` est utilisé. | Mettre Vite au minimum à 8.0.16, idéalement au patch courant compatible, puis exécuter la release gate. | S |
| 🟡 | dependencies | `package.json:39` | Fabric 7.2.0 est concerné par GHSA-w22m-hvvm-xmwx, corrigé en 7.4.0. Le chemin vulnérable sérialise des gradients vers SVG et n’est pas appelé par ScreenForge, mais la version reste en défaut et le renderer utilise une API privée à revalider. | Passer à Fabric 7.4.0, puis lancer unit, E2E, export pixel-exact et probe visuel. | S |
| 🟡 | dependencies | `pnpm-lock.yaml:143` | Le lockfile contient aussi 16 avis high/moderate/low dans l’outillage transitif (`postcss`, `ws`, `brace-expansion`, `js-yaml`, `@babel/core`). Les chemins observés passent par Vite, Vitest/jsdom, ESLint et typescript-eslint, pas par le bundle applicatif. | Rafraîchir les patchs du lockfile après les deux mises à niveau directes et relancer `pnpm audit`; n’utiliser des overrides ciblés que si le résolveur ne prend pas les versions corrigées. | S |

## Top actions

1. Résoudre les findings dependencies #1–2 avec `aidd-dev:02-implement` : mettre à jour Vite vers ≥8.0.16 et Fabric vers ≥7.4.0.
2. Résoudre le finding dependencies #3 avec `aidd-dev:02-implement` : rafraîchir le lockfile, puis exiger un `pnpm audit` sans high dans la gate de dépendances.
3. Ne pas migrer JSZip, Zustand, Tailwind ou React sans besoin mesuré : ils sont utilisés, maintenus et adaptés.

## Coverage

- **Scanned**: dependencies — `pnpm audit --json` (397 packages, 0 critical, 13 high, 8 moderate, 1 low avant correction), `pnpm outdated`, usages des dépendances directes, lockfile, versions installées et licences directes (MIT/ISC/Apache-2.0 ; JSZip en MIT ou GPL-3.0+).
- **Skipped**: inventaire de licences transitives complet — `pnpm licenses list` ne pouvait pas lire l’index du store local ; aucun paquet git/URL non verrouillé n’a été trouvé.
