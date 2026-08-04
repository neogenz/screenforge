---
status: done
---

# Instruction: Outillage typé et CI

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── .github/workflows/quality.yml                 ✅ release gate sur push et pull request
├── package.json                                  ✏️ typecheck complet et types Node explicites
├── tsconfig.tools.json                           ✅ contrat TypeScript E2E, configs et scripts
├── eslint.config.js                              ✏️ environnements navigateur, Playwright et Node séparés
├── e2e/*.ts                                      ✏️ corrections de typage minimales révélées par la nouvelle gate
├── scripts/*.mjs                                 ✏️ annotations JSDoc minimales pour checkJs
└── aidd_docs/memory/
    ├── coding-assertions.md                      ✏️ nouvelle gate locale
    ├── testing.md                                ✏️ périmètre TypeScript documenté
    └── vcs.md                                    ✏️ CI GitHub documentée
```

## Tasks to do

### `1)` Couvrir tout l’outillage par TypeScript

> Faire échouer la gate sur une dérive des contrats E2E, des configs ou des scripts.

1. Ajouter `@types/node` en dépendance de développement directe.
2. Créer `tsconfig.tools.json` avec `e2e`, les configs et `scripts/*.mjs`, `allowJs` et `checkJs`.
3. Composer `pnpm typecheck` avec les configs application et outils, sans modifier le build navigateur.
4. Corriger uniquement les erreurs réellement remontées, notamment le contrat de `window.__sfStores`.

### `2)` Aligner ESLint sur les runtimes

> Ne plus appliquer les globals navigateur aux scripts Node et configs.

1. Garder les règles React sur `src/**/*.{ts,tsx}`.
2. Appliquer les globals Node aux configs/scripts et ceux de Playwright aux E2E.
3. Conserver les mêmes règles de fond ; ne pas introduire une migration de lint indépendante.

### `3)` Automatiser la release gate

> Exécuter la commande déjà maintenue par le projet sur GitHub.

1. Ajouter un workflow unique avec Node, pnpm et cache du store.
2. Installer Chromium puis exécuter `pnpm test:release` sur push et pull request.
3. Publier les traces Playwright uniquement en cas d’échec.
4. Mettre à jour la mémoire de projet.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Une rupture de type dans `e2e/helpers.ts`, une config ou un script fait échouer `pnpm typecheck`; l’application et l’outillage valides passent ensemble. |
| 2 | `pnpm lint` distingue correctement les APIs navigateur et Node sans désactiver globalement une règle. |
| 3 | Chaque push ou pull request GitHub exécute la même release gate que localement et conserve une trace exploitable lorsqu’un E2E échoue. |
