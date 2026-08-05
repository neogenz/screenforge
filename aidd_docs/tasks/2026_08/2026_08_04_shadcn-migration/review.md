# Review: Migration totale vers shadcn/ui

- **Verdict**: changes-requested
- **Diff**: `13b384a0bbd79e63770b5a255b1d1aab2687476a...863c02c8ee8b054131d147a64176d3665ba1a237`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_04
- **Findings**: 0 critical, 9 warning, 0 minor

## Phases

### Phase 1 — Fondations shadcn + composants simples

- [x] `components.json` existe et configure shadcn sans remplacer le thème CSS-first — `components.json:1`, `components.json:6`, `components.json:15`, `src/index.css:168`
- [ ] L’identité visuelle dark/light et le contraste ≥ 4.5:1 sont préservés — aucun résultat de probe visuel ni d’audit contraste n’est présent dans le diff
- [ ] Les usages de Button/IconButton/Input/Textarea compilent et les suites demandées passent — les wrappers compatibles sont présents, mais aucun résultat de `pnpm test` ou `pnpm test:e2e` ne l’établit dans le diff

### Phase 2 — Contrôles de formulaire

- [x] Les libellés « Opacité » et « Activer l’ombre de l’appareil » restent portés par des contrôles pilotables — `src/components/ui/slider.tsx:36`, `src/components/ui/slider.tsx:50`, `src/components/ui/switch.tsx:13`, `src/components/ui/switch.tsx:16`
- [x] « Source du cadre » reste un groupe de boutons avec navigation Radix — `src/components/ui/segmented.tsx:29`, `src/components/ui/segmented.tsx:31`, `src/components/ui/toggle-group.tsx:7`, `src/components/ui/toggle-group.tsx:20`
- [x] « Modèle d’appareil » ouvre une liste et applique le modèle choisi — `src/components/device-picker/DevicePicker.tsx:238`, `src/components/device-picker/DevicePicker.tsx:258`, `src/components/device-picker/DevicePicker.tsx:266`, `src/components/ui/dropdown.tsx:82`

### Phase 3 — Overlays, menus et dialogs

- [ ] « Raccourcis clavier » s’ouvre, piège le focus et se ferme avec Échap, mais ne restaure pas le focus — aucun `Dialog.Trigger` ni `onCloseAutoFocus` ne fournit de cible de retour dans `src/components/ui/dialog.tsx:38`
- [x] Le menu « Fichier du projet » expose « Télécharger une copie » et restaure explicitement le focus — `src/components/ui/dropdown.tsx:62`, `src/components/ui/dropdown.tsx:68`, `src/components/ui/dropdown.tsx:82`, `e2e/project-file.spec.ts:268`
- [x] Le menu contextuel est ancré aux coordonnées du curseur, bouclé au clavier et fermé par Radix hors interaction — `src/components/ui/ContextMenu.tsx:37`, `src/components/ui/ContextMenu.tsx:46`, `src/components/ui/ContextMenu.tsx:53`, `src/components/ui/ContextMenu.tsx:70`

### Phase 4 — Toast, palette ⌘K et spécifiques

- [ ] Les succès sont exposés en `status`, mais « Archive projet invalide. » est rendu en `alert` — `src/stores/toast.store.ts:10`
- [x] ⌘K expose un dialog cmdk avec options exécutables et la couverture de coalescence reste présente — `src/components/ui/command-palette.tsx:33`, `src/components/ui/command-palette.tsx:63`, `e2e/command-palette.spec.ts:5`, `e2e/command-palette.spec.ts:32`
- [ ] Le comportement de scrub est conservé dans le composant, mais aucun scénario E2E ne scrube les champs et aucun résultat de `pnpm run test:release` n’est présent — `src/components/ui/number-field.tsx:61`, `e2e/canvas-transforms.spec.ts:42`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 warning | functional | 1 | `src/index.css:168` | Le critère d’identité dark/light et de contraste reste non vérifié dans le diff. | Exécuter et consigner `pnpm run probe:visual` puis `pnpm run audit:contrast`; corriger les tokens si une régression apparaît. |
| 🟡 warning | functional | 1 | `src/components/ui/button.tsx:49` | Le diff ne démontre pas que les appels existants compilent ni que `pnpm test` et `pnpm test:e2e` passent. | Exécuter les deux gates et corriger tout contrat de wrapper ou scénario en échec. |
| 🟡 warning | code | 1 | `src/lib/utils.ts:7` | Chaque entrée d’un même `classGroups` est mutuellement exclusive : `sf-surface` et `sf-type` font donc supprimer des classes indépendantes comme `field-label` + `tabular`, au lieu de seulement éviter une déduplication erronée. | Supprimer cette extension inutile ou donner un groupe distinct à chaque classe réellement composable, avec un petit test de `cn()`. |
| 🟡 warning | conform | 1–3 | `src/components/ui/button.tsx:3` | Les dix wrappers importent depuis le barrel `radix-ui`, qui tire aussi les primitives inutilisées dans le lockfile, contrairement à la règle projet « import directly from modules, avoid barrel files ». | Dépendre et importer directement les paquets `@radix-ui/react-*` effectivement utilisés. |
| 🟡 warning | functional | 3 | `src/components/ui/dialog.tsx:38` | Radix empêche son retour de focus par défaut puis tente de focaliser son `triggerRef`; ce wrapper ne monte aucun `Dialog.Trigger`, donc Échap/fermeture laisse le focus sans cible. | Capturer l’élément actif à l’ouverture et le restaurer dans `onCloseAutoFocus`, ou intégrer un vrai Trigger; ajouter l’assertion E2E de retour de focus. |
| 🟡 warning | code | 3 | `src/components/ui/ContextMenu.tsx:73` | L’ancien item stoppait la propagation du clic; le nouvel item portalisé ne le fait plus, donc le clic remonte jusqu’à `LayerItem` (`onClick`) après dupliquer/supprimer et remplace la sélection produite par l’action, voire resélectionne un id supprimé. | Stopper la propagation du clic sur le contenu/item et faire vérifier `selectedLayerIds` par le scénario E2E du menu de calque. |
| 🟡 warning | code | 3 | `src/components/ui/dropdown.tsx:33` | `getBoundingClientRect()` est lu pendant le render puis figé sur un faux Trigger; un scroll/resize sans rerender détache le menu de son ancre et la lecture force aussi un layout synchrone. | Faire du bouton externe le vrai Trigger Radix, ou synchroniser le proxy depuis un layout effect avec les événements de scroll/resize. |
| 🟡 warning | functional | 4 | `src/stores/toast.store.ts:10` | Le contrat demande `getByRole('status')` pour « Archive projet invalide. », mais tous les toasts d’erreur sont désormais `role="alert"`. | Conserver `status` pour ce contrat, ou modifier explicitement le plan et le test si le passage à `alert` est voulu. |
| 🟡 warning | functional | 4 | `e2e/canvas-transforms.spec.ts:42` | Les tests existants saisissent les valeurs mais ne couvrent pas le scrub demandé, et le diff ne fournit aucun résultat du gate `test:release`. | Ajouter un unique scénario de drag sur NumberField avec assertion store/canvas stable, puis exécuter `pnpm run test:release`. |

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 58% (7/12) |
| Files checked | `components.json`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `src/index.css`, `src/App.tsx`, `src/components/ui/*`, `src/components/canvas/CanvasEditor.tsx`, `src/components/layers-panel/LayerItem.tsx`, `src/lib/layer-menu.tsx`, `src/lib/utils.ts`, `src/stores/toast.store.ts`, `src/lib/__tests__/storage.test.ts`, `e2e/device-bezel-import.spec.ts`, `e2e/project-file.spec.ts`, `e2e/layers-panel.spec.ts`, `e2e/command-palette.spec.ts`, `e2e/canvas-transforms.spec.ts`, `aidd_docs/tasks/2026_08/2026_08_04_shadcn-migration/plan.md`, `aidd_docs/tasks/2026_08/2026_08_04_shadcn-migration/phase-1.md`, `aidd_docs/tasks/2026_08/2026_08_04_shadcn-migration/phase-2.md`, `aidd_docs/tasks/2026_08/2026_08_04_shadcn-migration/phase-3.md`, `aidd_docs/tasks/2026_08/2026_08_04_shadcn-migration/phase-4.md` |
| Unchecked     | Identité dark/light et contraste — fix; compilation + suites Phase 1 — fix; retour de focus Dialog — fix; rôle `status` des erreurs — fix; scrub + gate release — fix |
| Unplanned     | none |
