# Review: Bezels iPhone officiels importés localement

- **Verdict**: approve
- **Diff**: `1a71a53b692b90e76acf268910601800c6b531cb...c298d0e67b460e2553019e23d67b76f8a74a6cca`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_03
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Contrat local et preuve de faisabilité

- [x] Le PNG synthétique restitue sa géométrie exacte et les trois cas invalides sont refusés sans réseau, snapshot ni attente temporelle — `e2e/device-bezel-fixture.ts:11`, `e2e/device-bezel-analysis.spec.ts:55`, `e2e/device-bezel-analysis.spec.ts:82`
- [x] Le calque sérialisé ne porte qu’un identifiant d’asset et des métadonnées compactes, sans payload `data:image` — `src/types/index.ts:57`, `src/components/device-picker/DevicePicker.tsx:93`, `e2e/device-bezel-analysis.spec.ts:67`
- [x] L’ouverture centrale fermée est distinguée du fond extérieur, l’ouverture reliée au bord est refusée et les limites fichier/IHDR sont rejetées avant décodage ou allocation du buffer de pixels — `src/lib/device-bezel.ts:58`, `src/lib/device-bezel.ts:85`, `src/lib/device-bezel.ts:166`, `e2e/device-bezel-analysis.spec.ts:94`, `e2e/device-bezel-analysis.spec.ts:123`
- [x] Les projets anciens et les métadonnées invalides retombent sur le cadre généré sans perdre la capture, tandis qu’un bezel valide force le portrait — `src/lib/storage.ts:57`, `src/lib/storage.ts:127`, `e2e/device-bezel-analysis.spec.ts:130`
- [x] Le PRD décrit le fallback généré et l’import local sans ajouter d’artwork Apple au diff — `PRD.md:62`, `PRD.md:140`, `PRD.md:336`

### Phase 2 — Intégration éditeur, persistance et export

- [x] Les nouveaux parcours bezel utilisent des PNG générés en mémoire, des sélecteurs accessibles et des attentes d’état sans `waitForTimeout` — `e2e/device-bezel-fixture.ts:11`, `e2e/device-bezel-import.spec.ts:45`, `e2e/export.spec.ts:35`, `e2e/helpers.ts:62`, `e2e/helpers.ts:80`
- [x] L’import valide, l’erreur accessible sans mutation, la déduplication et le retrait sont couverts par l’UI publique — `src/components/device-picker/DevicePicker.tsx:81`, `src/components/device-picker/DevicePicker.tsx:231`, `e2e/device-bezel-import.spec.ts:166`
- [x] La capture est composée sous l’overlay, la clé de ressource porte les deux assets et un asset absent retombe sur le renderer généré — `src/components/canvas/canvas-utils.ts:331`, `src/components/canvas/canvas-utils.ts:393`, `e2e/device-bezel-import.spec.ts:224`, `e2e/device-bezel-import.spec.ts:229`, `e2e/export.spec.ts:65`
- [x] Le ratio naturel et les contraintes de rotation, opacité, ombre et poignée Maj sont appliqués au mode officiel sans supprimer les réglages du mode généré — `src/components/properties-panel/TransformSection.tsx:36`, `src/components/canvas/canvas-utils.ts:80`, `src/components/canvas/canvas-utils.ts:478`, `e2e/device-bezel-import.spec.ts:191`
- [x] Bezel et capture survivent au statut enregistré et au rechargement, puis le ZIP reste RGB opaque en 1320×2868 avec les pixels attendus — `e2e/device-bezel-import.spec.ts:215`, `e2e/export.spec.ts:15`, `e2e/export.spec.ts:35`
- [x] Le scénario optionnel utilise deux chemins locaux hors dépôt et couvre import, autosave, reload et export — `e2e/device-bezel-import.spec.ts:297`, `e2e/device-bezel-import.spec.ts:306`, `e2e/device-bezel-import.spec.ts:335`
- [x] Sur le Product Bezel réel, capture, artwork et export ne portent chacun qu’une composante Dynamic Island 2D, avec des boîtes alignées sur les deux axes — `e2e/device-bezel-import.spec.ts:80`, `e2e/device-bezel-import.spec.ts:318`, `e2e/device-bezel-import.spec.ts:351`

### Phase 3 — Corrections de revue avant livraison

- [x] L’IHDR hostile est rejeté avant décodage, les octets lus sont réutilisés et le flood-fill n’emploie plus de tableau JavaScript par pixel; le pixel alpha 17 réel est distingué du marqueur interne — `src/lib/device-bezel.ts:58`, `src/lib/device-bezel.ts:76`, `src/lib/device-bezel.ts:90`, `src/lib/device-bezel.ts:99`, `e2e/device-bezel-analysis.spec.ts:71`, `e2e/device-bezel-analysis.spec.ts:123`
- [x] Les déclencheurs sont désactivés pendant l’analyse contrôlée et une seconde tentative ne lance pas de lecture concurrente ni n’écrase le premier résultat — `src/components/ui/segmented.tsx:17`, `src/components/device-picker/DevicePicker.tsx:81`, `src/components/device-picker/DevicePicker.tsx:162`, `e2e/device-bezel-import.spec.ts:261`
- [x] Les parcours bezel n’emploient ni attente temporelle ni choix positionnel et partagent une seule extraction ZIP sans perdre les assertions de chemin App Store — `e2e/helpers.ts:62`, `e2e/helpers.ts:80`, `e2e/helpers.ts:94`, `e2e/export.spec.ts:21`, `e2e/device-bezel-import.spec.ts:339`
- [x] Le contrat réel compare la région supérieure 2D de la capture, du bezel et de l’export pour établir un Dynamic Island unique et aligné — `e2e/device-bezel-import.spec.ts:80`, `e2e/device-bezel-import.spec.ts:325`, `e2e/device-bezel-import.spec.ts:357`
- [x] Le SVG transitoire lit la couleur d’écran vide depuis la source de contenu centralisée — `src/lib/content-defaults.ts:35`, `src/components/canvas/canvas-utils.ts:20`, `src/components/canvas/canvas-utils.ts:352`

## Findings

None.

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 100% (17/17) |
| Files checked | `PRD.md`, `plan.md`, `phase-1.md`, `phase-2.md`, `phase-3.md`, `e2e/device-bezel-analysis.spec.ts`, `e2e/device-bezel-fixture.ts`, `e2e/device-bezel-import.spec.ts`, `e2e/export.spec.ts`, `e2e/helpers.ts`, `src/components/canvas/SelectionToolbar.tsx`, `src/components/canvas/canvas-utils.ts`, `src/components/device-picker/DevicePicker.tsx`, `src/components/properties-panel/TransformSection.tsx`, `src/components/ui/segmented.tsx`, `src/lib/content-defaults.ts`, `src/lib/device-bezel.ts`, `src/lib/storage.ts`, `src/types/index.ts` |
| Unchecked     | none |
| Unplanned     | none |
