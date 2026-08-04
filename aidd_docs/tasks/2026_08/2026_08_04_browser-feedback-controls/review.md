# Review: Browser feedback controls

- **Verdict**: changes-requested
- **Diff**: `17f2d3c...working-tree`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_04
- **Findings**: 0 critical, 3 warning, 1 minor

## Phases

### Phase 1 — Browser feedback controls

- [x] Copier et coller les réglages d’écran sans remplacer les calques, avec annulation — `src/components/screens-bar/ScreensBar.tsx:54`
- [x] Remplacer l’angle du dégradé par un slider lisible et quatre angles principaux — `src/components/ui/angle-control.tsx:37`
- [x] Répartir les onglets de type d’arrière-plan sur toute la largeur utile — `src/components/background-editor/BackgroundEditor.tsx:124`
- [x] Remplacer la rotation par un slider soigné et quatre angles principaux — `src/components/properties-panel/TransformSection.tsx:162`
- [x] Exposer et charger précisément la graisse Poppins 900 — `src/hooks/use-fonts.ts:65`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 warning | conform | 1 | `src/components/properties-panel/BackgroundSection.tsx:16` | Une clé unique coalesce toutes les mutations d’arrière-plan pendant 1,2 s : couleur, type, angle, stops et préréglage deviennent une seule étape d’annulation, contrairement à la règle projet « une clé par propriété ou geste continu ». | Faire remonter une clé propre à l’action depuis `BackgroundEditor`/`GradientEditor`, ou ne coalescer que les changements continus du slider et des couleurs. |
| 🟡 warning | code | 1 | `src/components/ui/angle-control.tsx:51` | Chaque instance expose le même groupe accessible `Angles principaux`; un calque texte avec dégradé affiche simultanément la rotation et l’angle du dégradé, donc deux groupes impossibles à distinguer pour un lecteur d’écran ou un sélecteur par rôle. | Dériver le libellé du groupe depuis `ariaLabel`, par exemple `${ariaLabel} — angles principaux`. |
| 🟡 warning | code | 1 | `src/hooks/use-fonts.ts:124` | La nouvelle vérification de graisse exacte fait confiance à une clé multi-graisses enregistrée dès qu’au moins une face a chargé; une réponse partielle peut donc marquer une graisse absente comme chargée et empêcher la requête correcte au canvas ou à l’export. | Enregistrer les graisses réellement retournées, ou considérer la requête groupée en échec dès qu’une face demandée est absente. |
| 🟢 minor | rot | 1 | `e2e/helpers.ts:55` | Le contrat TypeScript de `window.__sfStores` ne déclare ni `background` ni `updateScreenBackground`, alors que le nouveau test les utilise; Playwright transpile sans vérifier ces types, ce qui masque la dérive. | Étendre le type debug minimal avec `Background` et `updateScreenBackground`, ou préparer l’état du test via un helper typé. |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 100% (5/5)                                        |
| Files checked | `e2e/canvas-editing.spec.ts`, `e2e/canvas-transforms.spec.ts`, `e2e/helpers.ts`, `e2e/smoke.spec.ts`, `src/components/background-editor/BackgroundEditor.tsx`, `src/components/canvas/canvas-sync.ts`, `src/components/globals-editor/GlobalsEditor.tsx`, `src/components/gradient-editor/GradientEditor.tsx`, `src/components/properties-panel/BackgroundSection.tsx`, `src/components/properties-panel/TransformSection.tsx`, `src/components/screens-bar/ScreenThumbnail.tsx`, `src/components/screens-bar/ScreensBar.tsx`, `src/components/text-editor/TextEditor.tsx`, `src/components/ui/angle-control.tsx`, `src/components/ui/slider.tsx`, `src/hooks/use-fonts.ts`, `src/hooks/use-keyboard.ts`, `src/lib/export.ts`, `src/stores/canvas.store.ts` |
| Unchecked     | none                                              |
| Unplanned     | none                                              |
