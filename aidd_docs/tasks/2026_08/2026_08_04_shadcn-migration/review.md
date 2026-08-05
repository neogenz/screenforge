# Review: Migration shadcn / PR #2

- **Verdict**: changes-requested
- **Diff**: `13b384a...79884ac`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_05
- **Findings**: 0 critical, 4 warning, 3 minor

## Phases

### Phase 1 — Fondations shadcn + composants simples

- [x] `components.json` configure shadcn sans régénérer le thème CSS-first — `components.json:1`, `src/index.css:1`
- [ ] L’UI dark/light reste visuellement identique avec un contraste ≥ 4.5:1 — identité visuelle volontairement remplacée par le plan UI refresh ; le contraste reste dans la release gate (`aidd_docs/tasks/2026_08/2026_08_05_ui-refresh/plan.md:2`, `.github/workflows/quality.yml:23`)
- [x] Les contrats Button/IconButton/Input/Textarea compilent et la release gate passe — `src/components/ui/button.tsx:40`, `.github/workflows/quality.yml:23`

### Phase 2 — Contrôles de formulaire

- [x] Les contrôles « Opacité » et « Activer l’ombre de l’appareil » restent pilotables — `src/components/properties-panel/TransformSection.tsx:172`, `src/components/device-picker/DevicePicker.tsx:353`
- [x] « Source du cadre » expose des boutons Radix actionnables avec navigation clavier native — `src/components/device-picker/DevicePicker.tsx:152`, `src/components/ui/toggle-group.tsx:7`
- [x] « Modèle d’appareil » ouvre la liste et applique le modèle choisi — `src/components/device-picker/DevicePicker.tsx:237`, `e2e/device-bezel-import.spec.ts:187`

### Phase 3 — Overlays, menus et dialogs

- [x] Le dialogue des raccourcis piège le focus, ferme sur Échap et le restitue — `src/components/ui/dialog.tsx:57`, `e2e/layers-panel.spec.ts:184`
- [x] Le menu Projet télécharge une copie portable — `src/components/toolbar/TopBar.tsx:220`, `e2e/project-file.spec.ts:303`
- [x] Le clic droit canvas ouvre un menu positionné, navigable et refermable — `src/components/canvas/CanvasEditor.tsx:18`, `src/components/ui/ContextMenu.tsx:46`

### Phase 4 — Toast, palette ⌘K et spécifiques

- [ ] Les trois messages sont exposés en `status` — contrat volontairement remplacé : les erreurs sont désormais des `alert`, les succès/informations restent des `status` (`aidd_docs/tasks/2026_08/2026_08_04_shadcn-fixes-iphone-layouts/plan.md:34`, `e2e/project-file.spec.ts:447`)
- [x] ⌘K exécute une commande et une rafale de nudges forme une seule étape d’undo — `e2e/command-palette.spec.ts:5`, `e2e/command-palette.spec.ts:34`
- [x] Position X, Largeur et Rotation committent sans dérive après relâchement — `e2e/canvas-transforms.spec.ts:85`, `.github/workflows/quality.yml:23`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 warning | code | 3 | `src/components/toolbar/TopBar.tsx:211` | « Renommer le projet » focalise le champ pendant `onSelect`, puis la fermeture Radix applique son auto-focus par défaut et rend le focus au trigger. Le menu se ferme donc sans laisser le champ prêt à saisir ; le test actuel ne couvre que le retour de focus sur Échap. | Différer `focus()`/`select()` jusqu’après la fermeture du menu, puis ajouter un test clavier ciblé sur l’action de renommage. |
| 🟡 warning | code | - | `src/lib/storage.ts:165` | Le chargement accepte un projet dont un `assetId` référencé n’existe plus dans la table IDB. `loadLatestProject()` le réécrit comme valide, puis le canvas échoue sur « asset manquant » au lieu de revenir au dernier projet sain. | Vérifier que chaque id de `collectAssetIds(project)` existe dans `assets`, lever `InvalidProjectRecordError` sinon, et couvrir le fallback avec un test de stockage. |
| 🟢 minor | conform | 1 | `src/components/toolbar/TopBar.tsx:596` | L’action ⌘K reste un `<button>` stylé à la main dans le code feature, malgré la règle « primitives first » et l’`IconButton` déjà disponible. Elle duplique taille, états hover/focus et bordure. | La rendre avec `IconButton` et conserver `<Kbd>` comme enfant. |
| 🟢 minor | code | - | `scripts/export-probe.mjs:12` | `git diff --check` échoue sur sept lignes avec espaces finaux dans `export-probe.mjs`, `layout-measure.mjs` et `scale-audit.mjs`. | Supprimer les espaces finaux signalés par `git diff --check`. |
| 🟡 warning | rot | - | `scripts/scale-audit.mjs:69` | La garde ne mesure que la vue principale peuplée ; elle n’ouvre aucune modale et ne produit aucun toast. Elle reste donc verte malgré `fontSize: '12.5px'` dans `src/App.tsx:167` et `text-xl` dans `src/components/export-dialog/ExportDialog.tsx:150`, alors que le plan impose 11/12/14 px et `text-lg` pour l’export. | Ramener ces deux valeurs sur les tokens prévus et faire agréger par l’audit au moins la vue principale, une modale et un toast. |
| 🟢 minor | rot | - | `src/lib/stage.ts:13` | `TOP_BAR_HEIGHT` documente 6 px de retrait et vaut 50, mais `--island-padding` vaut désormais 9 px : la barre rend 56 px. Les insets et drawers ne gardent plus que 6 px sous la barre au lieu de la marge de 12 px. | Aligner la constante/commentaire sur 56 et faire comparer l’inset au bord rendu de la barre dans le test de viewport. |
| 🟡 warning | fit | - | `aidd_docs/tasks/2026_08/2026_08_05_screenforge-saas/plan.md:1` | La PR UI embarque 678 lignes de roadmap SaaS (Supabase, Hono, Stripe) sans lien avec le contrat shadcn ni avec le code livré. Ce lot augmente le périmètre de review et brouille l’historique de la migration. | Sortir le dossier `2026_08_05_screenforge-saas` dans une PR documentaire dédiée. |

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 83% (10/12) |
| Files checked | `.github/workflows/quality.yml`, `components.json`, `package.json`, `src/App.tsx`, `src/index.css`, `src/components/ui/*`, `src/components/toolbar/TopBar.tsx`, `src/components/device-picker/DevicePicker.tsx`, `src/components/canvas/CanvasEditor.tsx`, `src/components/export-dialog/ExportDialog.tsx`, `src/hooks/use-canvas.ts`, `src/hooks/use-keyboard.ts`, `src/lib/canvas/*`, `src/lib/assets.ts`, `src/lib/project-file.ts`, `src/lib/project-validation.ts`, `src/lib/stage.ts`, `src/lib/storage.ts`, `src/stores/*`, `scripts/*`, `e2e/*`, plans et mémoire AIDD concernés |
| Unchecked     | Phase 1 — identité visuelle inchangée — not-applicable ; Phase 4 — erreurs exposées en `status` — not-applicable |
| Unplanned     | Refactor d’audit/stockage/canvas, correctifs responsive et iPhone, fermeture des échelles, UI refresh et roadmap SaaS au-delà du plan de migration initial |
