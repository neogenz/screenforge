# Review: Hauteur automatique des boutons coss (PR #28)

- **Verdict**: approve
- **Diff**: `origin/main...refactor/coss-conformance`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_23
- **Findings**: 0 critical, 1 warning, 3 minor

## Phases

### Phase 1 — Décoincer les boutons qui doivent grandir

- [x] Sélecteur ouvert en fenêtre large : la boîte de chaque ligne contient nom, cible et pastille, sans recouvrir sa voisine — `ProjectSwitcher.tsx:361` (`h-auto sm:h-auto`), garde posée en 1600px avant la réduction, `project-file.spec.ts:652`
- [x] Onglets de campagne, lignes d'export, entrées de release, boutons Destination, CTA de migration tiennent dans leur boîte — les sept sites portent `h-auto sm:h-auto` : `CampaignDialog`, `ExportDialog`, `PublishDialog`, `ProjectSwitcher` ×2, `MigrateProjectsDialog`, `ScreenshotFraming`
- [x] Outil « Ajouter un appareil » : aucun glyphe hors de la boîte au survol — `TopBar.tsx:1050` (`className="size-2.5"` au lieu de `size={9}`), couvert par `semantics.spec.ts:65`
- [x] `lint`, `typecheck`, `audit:ui` passent ; aucun fichier de `components/ui/` au diff — vérifié, 0 fichier `ui/` modifié

### Phase 2 — Interdire le retour du défaut, et l'écrire

- [x] Le helper renvoie une liste vide sur l'application corrigée, et nomme le bouton dès qu'un contenu sort de sa boîte — `helpers.ts:550`
- [x] Les quatre scénarios passent ; rétabli l'état d'avant correctif, la suite échoue en nommant les boutons — **re-vérifié en retirant `sm:h-auto`** : `project-file` échoue en nommant « Ouvrir « Projet Bêta » » et « Ouvrir « Projet Alpha très long… » ». Les chiffres cités par le critère sont périmés (voir finding 🟢).
- [x] `CLAUDE.md` et `aidd_docs/memory/design.md` énoncent la règle `h-auto sm:h-auto` et nomment la garde

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 | conform | - | `CLAUDE.md:227` | L'invariant écrit — « 0 icône non dimensionnée », « 366 des 400 icônes rendues n'ont pas changé de taille » — a été mesuré sur le seul DOM par défaut. Les états conditionnels et ceux derrière l'authentification n'y étaient pas rendus, et quatre icônes y régressaient (corrigées depuis, voir ci-dessous). Le chiffre reste vrai de ce qui a été mesuré, pas de l'application. | Reformuler la portée : dire que la mesure couvre le DOM par défaut, et que `expectNoRawIcon` tient le reste. |
| 🟢 | code | - | `scripts/ui-source-audit.mjs:252` | Le balayage lit tout le contenu du fichier, là où la version précédente se limitait aux attributs `className` : un nom de jeton cité dans un commentaire fait échouer l'audit. Le sens de l'erreur est le bon (bruyant plutôt que muet), mais le message désignera une ligne qui ne peint rien. | Restreindre au contexte `className`, ou nommer la ligne fautive. |
| 🟢 | code | - | `scripts/ui-source-audit.mjs:216` | La liste de préfixes de `--color-` omet `divide`, `caret`, `accent`, `decoration` et `placeholder` : une couleur propre à la vitrine employée par l'un d'eux passe sans bruit. | Compléter la liste, ou la dériver des espaces de noms Tailwind. |
| 🟢 | rot | 2 | `phase-2.md:41` | Le critère cite des mesures périmées (« boîte 286×43, débord 8 ») : la ligne a été redessinée depuis et la garde rapporte un débord de 3. Le critère reste vrai sur le fond, ses chiffres non. | Remplacer les valeurs par « nomme le bouton et son débord ». |

### Corrigés pendant la revue

| Sev | Kind | Location | Issue | Correctif |
| --- | ---- | -------- | ----- | --------- |
| 🔴 | code | `LayerItem.tsx:315` | `EyeOff` et `Lock` avaient perdu `size={10}` sans recevoir de classe. Aucune règle `svg` n'existe hors des primitives coss (vérifié : ni `index.css` ni `design-system/` n'en déclarent), et ni la ligne ni le conteneur des badges n'en est une : **mesuré 24×24** dans une ligne de 32. Le même fichier le reconnaissait déjà — `LayerTypeIcon` (:39) et `GripVertical` (:239) avaient reçu `size-4` pour cette raison. | `size-3` sur les deux ; **re-mesuré 12×12**, et 24×24 dès qu'on retire la classe. |
| 🔴 | code | `setup-flow.tsx:66` | `Check` et `AlertCircle` dans un `<span>` nu de `size-4` sans règle `svg` : 24px dans une pastille de 16. | `size-2.5`. |
| 🟡 | code | `AccountDialog.tsx:212` | `Check` dans un `<div className="flex items-center gap-2">` nu, à côté d'un texte de 14px. | `size-3.5`. |
| 🟡 | code | `ExportDialog.tsx:355` | `FileCheck2` dans une ligne de 12px, sans taille. | `size-3.5`. |
| 🟡 | rot | `helpers.ts:583` | `expectNoClippedControl` ne balaie que `[data-slot="button"]` : la classe de défaut ci-dessus tombait hors de sa portée par construction. | `expectNoRawIcon` ajouté (`helpers.ts:628`) — échoue sur tout `svg` rendu 24×24 sans `size-6`, la signature exacte du repli Lucide. Appelé aux quatre mêmes points. Auto-testé : passe sur l'application, échoue sur une icône brute injectée. |

## Verification

| Metric        | Value                                                                                                                                                                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified      | 100% (7/7)                                                                                                                                                                                                                                                                                   |
| Files checked | `ProjectSwitcher.tsx`, `TopBar.tsx`, `LayerItem.tsx`, `setup-flow.tsx`, `AccountDialog.tsx`, `ExportDialog.tsx`, `action-menu.tsx`, `confirm-action.tsx`, `helpers.ts`, `project-file.spec.ts`, `semantics.spec.ts`, `export.spec.ts`, `ai-campaign.spec.ts`, `ui-source-audit.mjs`, `CLAUDE.md`, `design.md` |
| Unchecked     | none                                                                                                                                                                                                                                                                                         |
| Unplanned     | Retrait des 159 props `size={N}` et des 39 `border-border` morts, huit pieds de dialogue en `ghost`, fermeture de `ConfirmAction` par `AlertDialogClose`, refonte de la liste « Autres projets », garde de jetons de la vitrine à la place de la garde de classes mortes, dernier `space-y-*` en `flex gap`. Aucun ne trace à un critère : le plan les excluait (phase-1, tâche 4.3 : « arbitrage à part, signalé et non exécuté ici »), ils ont été demandés après coup sans que le plan soit rouvert — et c'est par là que les quatre régressions sont passées. |
