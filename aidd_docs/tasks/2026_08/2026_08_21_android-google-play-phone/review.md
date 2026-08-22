# Review: Android Google Play téléphone

- **Verdict**: approve
- **Diff**: `origin/main@1cd46bb2...codex/android-google-play-phone`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_22
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Contrat de cible et migration

- [x] Les profils Apple et Google Play résolvent leurs planches, sorties et plafonds exacts. — `packages/project-format/src/dimensions.ts:44`, `apps/web/src/lib/__tests__/project-validation.test.ts:60`
- [x] Les projets et releases sans cible migrent vers Apple, tandis qu'un neuvième écran Android invalide le projet. — `packages/project-format/src/project-validation.ts:380`, `apps/web/src/lib/__tests__/project-validation.test.ts:73`
- [x] La création et la persistance conservent cible et globals Android; le format projet sérialise puis remigre le graphe complet et garde les archives Apple lisibles. — `apps/web/src/lib/__tests__/storage.test.ts:75`, `apps/web/src/lib/project-file.ts:170`, `apps/web/src/lib/project-file.ts:251`

### Phase 2 — Géométrie de planche target-aware

- [x] Clip, sélection, alignement et transfert utilisent la planche du profil actif pour Android. — `apps/web/src/lib/canvas/canvas-sync.ts:85`, `apps/web/src/stores/__tests__/canvas.store.test.ts:72`, `apps/web/src/lib/__tests__/offboard.test.ts:96`
- [x] Le round-trip canvas → store → sync conserve les coordonnées Android et les scénarios Apple historiques restent verts. — `apps/web/e2e/canvas-transforms.spec.ts:112`
- [x] Les vignettes Android respectent le ratio 9:16 et le réordonnancement utilise le pas calculé depuis la planche. — `apps/web/e2e/screens-bar.spec.ts:28`, `apps/web/src/components/screens-bar/ScreensBar.tsx:285`

### Phase 3 — Setup, cadres et gabarits Android

- [x] Le renderer existant produit le cadre Android, sa capture, son poinçon et ses couleurs noire et argent. — `apps/web/src/assets/device-frames/__tests__/device-frame-svg.test.ts:46`
- [x] Le setup sauvegarde le projet courant, crée la cible Google Play puis la retrouve après rechargement. — `apps/web/src/lib/storage.ts:581`, `apps/web/e2e/android-project.spec.ts:4`
- [x] Toolbar, globals, propriétés et palette filtrent les appareils; la publication Apple est absente et défensivement refusée. — `apps/web/e2e/android-project.spec.ts:24`, `apps/web/e2e/asc-publish.spec.ts:166`, `apps/web/src/components/publish-dialog/PublishDialog.tsx:66`
- [x] Cinq gabarits compatibles par cible restent contenus dans la planche active et utilisent le modèle Android attendu. — `apps/web/src/assets/templates/__tests__/templates.test.ts:6`

### Phase 4 — Campagnes, localisation et MCP

- [x] Le builder local compose au plus huit visuels contenus dans 540×960 avec le modèle Android. — `apps/web/src/lib/__tests__/archetypes.test.ts:271`
- [x] Le dialogue Android affiche Google Play, le plafond huit et un aperçu au vrai ratio. — `apps/web/e2e/ai-campaign.spec.ts:62`
- [x] L'état MCP expose cible et planche; un appareil iPhone est refusé sans mutation partielle dans un projet Android. — `apps/web/src/lib/__tests__/ai-builder.test.ts:619`, `apps/web/src/lib/__tests__/ai-builder.test.ts:665`

### Phase 5 — Export et releases Google Play

- [x] Les exports Apple et Android produisent des PNG RGB opaques aux dimensions exactes. — `apps/web/e2e/export.spec.ts:18`, `apps/web/e2e/export.spec.ts:33`
- [x] Le ZIP Android utilise le suffixe Google Play et `phone/NN_nom.png`; l'UI distingue le minimum deux et la recommandation quatre. — `apps/web/src/hooks/use-export.ts:100`, `apps/web/src/hooks/use-export.ts:124`, `apps/web/src/components/export-dialog/ExportDialog.tsx:180`
- [x] Une release Android conserve sa cible, ses chemins et ses SHA; le parcours Apple reste inaccessible. — `apps/web/e2e/release.spec.ts:77`, `apps/web/e2e/asc-publish.spec.ts:166`
- [x] Le validateur accepte les deux profils et refuse dimensions, alpha, poids, doublon et neuvième PNG Android. — `scripts/validate-export.test.mjs:32`, `scripts/validate-export.test.mjs:40`, `scripts/validate-export.test.mjs:46`, `scripts/validate-export.test.mjs:57`

### Phase 6 — Documentation et présentation multi-store

- [x] PRD, AGENTS et mémoire documentent les deux cibles, dimensions et exclusions Android v1. — `PRD.md:364`, `AGENTS.md:272`, `aidd_docs/memory/architecture.md:35`
- [x] Les landings FR et EN présentent les deux dossiers sans promettre publication Google ni grand écran Android. — `apps/web/src/lib/__tests__/landing-copy.test.ts:33`, `apps/web/e2e/landing.spec.ts:6`
- [x] Les audits de copie, build/prérendu, captures et gate de release couvrent les deux contrats et passent. — `package.json:38`, `scripts/visual-probe.mjs:58`, `apps/web/e2e/export.spec.ts:18`

## Findings

None.

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 100.0% (20/20) |
| Files checked | `packages/project-format/src/dimensions.ts`, `packages/project-format/src/project-validation.ts`, `apps/web/src/lib/storage.ts`, `apps/web/src/lib/project-file.ts`, `apps/web/src/lib/canvas/`, `apps/web/src/stores/canvas.store.ts`, `apps/web/src/assets/device-frames/`, `apps/web/src/assets/templates/`, `apps/web/src/lib/ai/`, `apps/bridge/src/`, `apps/mcp/src/`, `apps/web/src/hooks/use-export.ts`, `apps/web/src/lib/export.ts`, `apps/web/src/lib/release.ts`, `scripts/validate-export.mjs`, UI, tests, E2E, plans et documentation modifiés |
| Unchecked     | none |
| Unplanned     | none |
