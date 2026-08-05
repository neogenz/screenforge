# Codebase Audit: ScreenForge complet
ScreenForge est une base saine et moderne, sans faille critique ni refonte nécessaire ; 12 avertissements localisés doivent être traités avant de considérer l’architecture durablement stabilisée.

- **Date**: 2026-08-04
- **Scope**: code quality, architecture, sécurité, dépendances, performance, tests et UI
- **Health**: good
- **Findings**: 0 critical, 12 warning, 5 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
|---|---|---|---|---|---|
| 🟡 | dependencies | `package.json:66` | Vite 8.0.3 porte cinq avis high/moderate corrigés à partir de 8.0.16. | Mettre Vite à jour, puis exécuter la release gate. | S |
| 🟡 | dependencies | `package.json:39` | Fabric 7.2.0 porte GHSA-w22m-hvvm-xmwx, corrigé en 7.4.0 ; le chemin vulnérable n’est pas utilisé ici. | Passer à 7.4.0 et revalider rendu/export/API privée des contrôles. | S |
| 🟡 | dependencies | `pnpm-lock.yaml:143` | Seize avis supplémentaires restent dans l’outillage transitif Vite/Vitest/ESLint. | Rafraîchir les patchs du lockfile et relancer `pnpm audit`. | S |
| 🟡 | code-quality | `src/lib/storage.ts:109` | La normalisation IndexedDB force des objets partiels en `Layer`, contrairement au validateur strict mais dupliqué de l’archive. | Partager un validateur/normaliseur de domaine unique, sans nouvelle dépendance. | M |
| 🟡 | architecture | `src/stores/canvas.store.ts:21` | Les calques et l’écran actif sont dupliqués entre project et canvas stores et synchronisés manuellement. | Garder le projet dans un seul store et seulement la sélection/interaction dans canvas. | M |
| 🟡 | architecture | `src/hooks/use-canvas.ts:56` | Un hook de 814 lignes orchestre huit responsabilités Fabric distinctes. | Extraire trois installateurs plats avec cleanup, sans nouvelle couche d’abstraction. | M |
| 🟡 | security | `src/lib/image.ts:3` | Les images ordinaires et SVG ne sont bornés ni en octets ni en pixels. | Centraliser des limites dans le helper partagé d’import. | M |
| 🟡 | performance | `src/lib/device-bezel.ts:85` | Le flood-fill synchrone accepte 40 MP et peut bloquer le thread UI. | Abaisser le plafond ; worker seulement si des bezels réels l’exigent. | M |
| 🟡 | tests | `tsconfig.app.json:23` | E2E, scripts et configs ne sont pas couverts par le typecheck. | Ajouter un `tsconfig.tools.json` à la gate. | S |
| 🟡 | tests | `e2e/canvas-transforms.spec.ts:28` | Quarante-huit délais Playwright fixes rendent la suite plus lente et dépendante de la machine. | Les remplacer par assertions web-first/`expect.poll`, en commençant par les helpers. | M |
| 🟡 | code-quality | `src/hooks/use-fonts.ts:151` | Un échec Google Fonts est mémorisé comme promesse définitive et ne peut pas être retenté. | Évincer le cache sur `fallback`. | S |
| 🟡 | ui | `src/App.tsx:44` | Un échec IndexedDB au démarrage ne produit aucun état utilisateur ni projet de repli. | Basculer en mémoire et afficher une erreur persistante. | S |
| 🟢 | code-quality | `src/types/index.ts:3` | Le modèle autorise un type `background` impossible et un champ gradient de forme orphelin. | Nettoyer ces deux branches après migration. | S |
| 🟢 | architecture | `src/stores/canvas.store.ts:11` | Des modules domaine/lib importent des utilitaires rangés sous composants/hooks. | Replacer seulement les modules purs partagés sous `lib/`. | M |
| 🟢 | performance | `src/components/toolbar/TopBar.tsx:32` | JSZip est chargé au démarrage pour des actions rares ; le JS initial atteint environ 299 kB gzip. | Import dynamique de JSZip dans les opérations ZIP. | S |
| 🟢 | tests | `package.json:20` | La release gate complète existe mais n’est pas automatisée par CI. | Ajouter un workflow seulement si le dépôt distant sert à collaborer/livrer. | S |
| 🟢 | ui | `src/App.tsx:161` | Les dialogues lazy suspendent sur un fallback nul. | Afficher un indicateur commun ou précharger au focus. | S |

## Top actions

1. **Dependencies #1–3 — `aidd-dev:02-implement`** : Vite ≥8.0.16, Fabric ≥7.4.0, lockfile transitif, puis `pnpm test:release` et `pnpm audit`.
2. **Code-quality #1 — `aidd-dev:07-refactor` + `aidd-dev:06-test`** : extraire le validateur strict existant, l’appliquer aussi à IndexedDB et couvrir un projet partiel/corrompu.
3. **Architecture #1–2 — `aidd-dev:07-refactor`** : supprimer progressivement le miroir `layers/activeScreenId`, puis découper `useCanvas` en trois installateurs plats. Cela suit le principe React d’éviter l’état dupliqué : [Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure).
4. **Tests #1–2 — `aidd-dev:06-test`** : typechecker l’outillage et remplacer les waits fixes, conformément aux [bonnes pratiques Playwright](https://playwright.dev/docs/best-practices).
5. **Security #1 + performance #1 — `aidd-dev:02-implement`** : limites communes pour images/SVG et plafond bezel plus réaliste.
6. **Code-quality #2 + ui #1–2 — `aidd-dev:08-debug`, `aidd-dev:02-implement`, `impeccable`** : retry des polices, repli mémoire IndexedDB et feedback des dialogues lazy.
7. **Constat de stack — aucune migration** : React 19, Zustand 5, Fabric 7, Tailwind 4 CSS-first, IndexedDB/idb, Radix et Vite 8 restent cohérents. Le système de tokens suit [Tailwind theme variables](https://tailwindcss.com/docs/theme), Fabric les imports de son [guide v7](https://fabricjs.com/docs/upgrading/upgrading-to-fabric-70/), et le lint pourra évoluer vers [typescript-eslint type-checked](https://typescript-eslint.io/getting-started/typed-linting/) après couverture de l’outillage.

## Coverage

- **Scanned**: code-quality, architecture, security, dependencies, performance, tests, ui — 14 827 lignes source, mémoire AIDD, modèle/persistance/assets, stores, cycle Fabric, export pixel-exact, composants/styles, 397 packages, licences directes, build/sourcemaps, 46 unit tests, 57 E2E, contraste et probes dark/light/1024 px. Gates exécutées : `pnpm test`, `pnpm build`, `pnpm test:e2e`, `pnpm audit:contrast`, `pnpm audit`, `pnpm outdated`, `pnpm probe:visual`.
- **Skipped**: profil production longue durée, couverture instrumentée, audit axe/lecteur d’écran, WebKit/Firefox, test bezel Apple réel et licences transitives complètes. Sources courantes vérifiées : [React state](https://react.dev/learn/choosing-the-state-structure), [Zustand](https://zustand.docs.pmnd.rs/reference/apis/create-store), [Tailwind v4](https://tailwindcss.com/docs/theme), [Playwright](https://playwright.dev/docs/best-practices), [Vite releases](https://vite.dev/releases) et [avis Vite WebSocket](https://github.com/advisories/GHSA-p9ff-h696-f583).
