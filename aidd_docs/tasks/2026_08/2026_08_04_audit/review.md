# Review: audit architecture et modernisation

- **Verdict**: approve
- **Diff**: `4a02d6d...working-tree`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_04
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Toolchain reproductible et release gate CI

- [x] Une rupture de type dans l’outillage fait échouer le typecheck — `tsconfig.tools.json:16`
- [x] Le lint distingue les APIs navigateur et Node — `eslint.config.js:28-50`, `scripts/layout-measure.mjs:8-48`
- [x] Push et pull request exécutent la release gate et publient les diagnostics E2E — `.github/workflows/quality.yml:3-30`

### Phase 2 — E2E déterministes

- [x] Les attentes E2E observent des résultats fonctionnels sans `waitForTimeout` — `e2e/helpers.ts:67-147`
- [x] La coalescence couvre deux entrées sans attente réelle — `e2e/command-palette.spec.ts:31-68`
- [x] Les scénarios de transformation et d’historique attendent leur convergence — `e2e/canvas-transforms.spec.ts:194-443`

### Phase 3 — Dépendances et chargement initial

- [x] Les versions auditées sont verrouillées sans nouvelle dépendance majeure — `package.json:26-65`, `pnpm-lock.yaml:1`
- [x] Les tests couvrent les interactions Fabric et l’export pixel-exact — `e2e/canvas-transforms.spec.ts:1`, `e2e/export.spec.ts:1`
- [x] JSZip est chargé dynamiquement aux seules frontières ZIP — `src/lib/project-file.ts:179`, `src/lib/project-file.ts:275`, `src/lib/zip.ts:9`

### Phase 4 — Modèle projet et validation

- [x] Archive et IndexedDB passent par le même contrat projet strict — `src/lib/project-validation.ts:132`, `src/lib/storage.ts:227`, `src/lib/project-file.ts:250`
- [x] La migration précède la validation et refuse les graphes corrompus — `src/lib/project-validation.ts:174`, `src/lib/storage.ts:99-130`
- [x] Le type `Layer` exclut `background` et la forme ne porte qu’un remplissage — `src/types/index.ts:93-103`

### Phase 5 — Import image et bezel bornés

- [x] L’import image borne les octets avant lecture et les pixels avant enregistrement — `src/lib/image.ts:61-75`
- [x] Les points d’import réutilisent la même validation sans mutation avant succès — `src/lib/layer-factories.ts:57-78`, `src/components/device-picker/DevicePicker.tsx:65-96`
- [x] L’analyse bezel borne les pixels avant le flood-fill — `src/lib/device-bezel.ts:60-72`, `src/lib/device-bezel.ts:167-194`

### Phase 6 — Source de vérité Zustand

- [x] L’écran actif appartient uniquement au store projet — `src/stores/project.store.ts:56`, `src/stores/project.store.ts:98`
- [x] Panneaux, raccourcis et canvas dérivent leurs calques du projet — `src/components/canvas/CanvasEditor.tsx:14`, `src/hooks/use-canvas.ts:147`
- [x] Transfert et historique passent par les actions de domaine partagées — `src/lib/layer-transfer.ts:28`, `src/stores/canvas.store.ts:182-190`
- [x] Le test de store interdit les copies de l’écran actif et des calques — `src/stores/__tests__/canvas.store.test.ts:1`

### Phase 7 — Frontières de modules et chargement des polices

- [x] Les modules domaine déplacés ne dépendent plus des composants ou hooks — `src/lib/layer-actions.ts:1`, `src/lib/layer-transfer.ts:1`
- [x] Une coupure Google Fonts autorise un vrai second chargement — `src/lib/fonts.ts:108-159`, `src/lib/__tests__/fonts.test.ts:34-64`
- [x] Les appels UI pointent vers les modules domaine sans changer les contrats — `src/components/layers-panel/LayerItem.tsx:1`, `src/components/toolbar/TopBar.tsx:1`

### Phase 8 — Décomposition du moteur Fabric

- [x] Les miniatures sont annulables au démontage et hors historique — `src/lib/canvas/install-thumbnails.ts:1`, `src/hooks/use-canvas.ts:178`
- [x] Interactions, sélection et transfert sont centralisés dans un installateur nettoyable — `src/lib/canvas/install-interactions.ts:60-350`
- [x] Pan, zoom, resize et recentrage partagent le même installateur viewport — `src/lib/canvas/install-viewport.ts:1-232`
- [x] Les installateurs rendent leurs nettoyages et l’export reste un `StaticCanvas` séparé — `src/hooks/use-canvas.ts:178`, `src/lib/export.ts:124`

### Phase 9 — Résilience de démarrage et lazy-loading

- [x] Un échec IndexedDB crée un projet mémoire sans démarrer l’autosave — `src/App.tsx:43-75`
- [x] Les dialogues lazy affichent un fallback annoncé — `src/App.tsx:172-187`
- [x] Les E2E couvrent stockage indisponible, réseau retardé et chemin nominal — `e2e/runtime-resilience.spec.ts:1-120`

## Findings

None.

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 100% (29/29) |
| Files checked | `package.json`, `pnpm-lock.yaml`, `eslint.config.js`, `tsconfig.tools.json`, `.github/workflows/quality.yml`, `e2e/**`, `src/App.tsx`, `src/lib/**`, `src/stores/**`, `src/hooks/**`, `src/components/**` |
| Unchecked     | none |
| Unplanned     | none |
