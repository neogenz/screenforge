---
status: done
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Instruction: finition oa-design — états, squelettes, toasts, copy, micro-détails

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
apps/web
├── index.html                               ✏️ squelette de boot redessiné pixel-matched sur le chrome final (barre haute h-9 + marge 12, filmstrip 184, HUD) ; mêmes --boot-* ; React le remplace sans saut
├── src
│   ├── stores/toast.store.ts                ✏️ sonner : classes coss `toast` + `animate-toast-success-odd/even` / `animate-toast-error-odd/even` alternées par compteur ; closeButton coss icon-xs ; durée 3500 inchangée ; titre = verbe au passé (« Exporté », « Enregistré »)
│   ├── components
│   │   ├── patterns
│   │   │   ├── notice-strip.tsx             ✅ condition qui tient, inline au-dessus de ce qu'elle explique : Alert coss, une affirmation en foreground, une phrase en muted, une action secondary ; role=status ; pas de bouton fermer
│   │   │   ├── empty-stage.tsx              ✅ stage sans écran : Empty coss centré sur le stage, « Commencez par vos captures », action primaire « Importer des captures » + secondaire « Partir d'un modèle » (le premier geste part des captures : règle existante)
│   │   │   └── save-status.tsx              ✅ StatusChip animé : « Enregistré » (point success), « Enregistrement… » (Spinner 12 px), « Hors ligne » (warning) ; animate-mark au changement
│   │   ├── canvas/CanvasEditor.tsx          ✏️ EmptyStage quand project.screens.length === 0 ; cadre de sélection et poignées inchangés (ink/halo deux tons)
│   │   ├── toolbar/TopBar.tsx               ✏️ SaveStatus ; NoticeStrip sous la barre pour stockage indisponible / quota Cloud / pont arrêté (remplace l'alerte persistante actuelle)
│   │   ├── layers-panel/LayerItem.tsx       ✏️ micro : le glyphe de visibilité bascule avec animate-mark ; le drag-over montre une barre marker (comme le filmstrip)
│   │   ├── screens-bar/ScreenThumbnail.tsx  ✏️ micro : Skeleton coss dans la tuile tant que thumbnail est absent (au lieu d'un rectangle vide) ; oa-arrive quand il arrive
│   │   ├── properties-panel/*               ✏️ micro : un champ qui clampe affiche un instant la borne (FieldDescription 1 s) ; les Slider montrent la valeur en tooltip coss pendant le drag
│   │   └── text-editor/FontPicker.tsx       ✏️ micro : une police non chargée montre un Skeleton sur son aperçu puis oa-arrive
│   ├── lib/copy.ts                          ✅ les phrases d'état et d'erreur de l'éditeur en un seul module (cause + issue, pas d'excuse, pas de point d'exclamation) ; les dialogues et toasts y lisent
│   └── hooks/use-keyboard.ts                ✏️ aucun changement fonctionnel ; le « ? » ouvre le ShortcutsOverlay pattern
└── e2e
    ├── motion.spec.ts                       ✏️ + toast succès pulse (scale keyframe présent), erreur shake ; + oa-arrive sur un thumbnail
    └── empty-state.spec.ts                  ✅ stage vide → Empty, importer des captures crée N écrans, les Empty des panneaux
```

## User Journey

```mermaid
flowchart TD
  A[Ouvrir un projet neuf] --> B[Stage : Empty « Commencez par vos captures »]
  B --> C[Importer 3 captures → 3 écrans, tuiles en Skeleton puis arrivent par focus]
  C --> D[Modifier un texte → chip « Enregistrement… » puis « Enregistré » (animate-mark)]
  D --> E[Couper le réseau Cloud → NoticeStrip sous la barre, tient tant que l'état dure]
  E --> F[Exporter → toast « Exporté » qui pulse ; échec → toast qui secoue, cause + issue]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    IndexedDB vidée, projet neuf sans écran => éditeur prêt: 5: browser
  section Happy path
    lire le stage => Empty coss role=status "Commencez par vos captures", bouton "Importer des captures": 5: browser
    importer 3 PNG => 3 tuiles, chacune passe par Skeleton puis montre son aperçu: 5: browser
    modifier un texte => chip "Enregistrement…" puis "Enregistré" sous 2 s: 5: browser
    exporter => toast "Exporté", animation scale présente ; reduced motion => aucune: 5: browser
  section Edge case - stockage indisponible
    IndexedDB forcée en échec => NoticeStrip "Vos modifications ne seront pas conservées…" sous la barre, pas de toast, pas de bouton fermer: 1: browser
  section Edge case - erreur d'export
    forcer un échec de rendu => toast erreur secoue, texte nomme la cause et l'issue, pas de "Oops": 1: browser
```

## Wireframe

```txt
┌──────────────────────────────────────────────────────────────────┐
│ [Toolbar ………………………………  (1)● Enregistré ……………… [Exporter]]         │
│ (2)┌ ⚠ Le stockage local est indisponible. ───── [Réessayer] ┐    │
│    │   Vos modifications restent en mémoire jusqu'à la        │    │
│    │   fermeture de l'onglet.                                 │    │
│    └──────────────────────────────────────────────────────────┘    │
│                                                                    │
│                    (3)┌──────── Empty ────────┐                    │
│                       │       [icône]         │                    │
│                       │ Commencez par vos     │                    │
│                       │ captures              │                    │
│                       │ Déposez des PNG du    │                    │
│                       │ simulateur, un écran  │                    │
│                       │ par capture.          │                    │
│                       │ [Importer des captures]│                   │
│                       │  Partir d'un modèle   │                    │
│                       └───────────────────────┘                    │
│                                                                    │
│ (4) ┌──┐ ┌──┐                         (5)┌ ✓ Exporté · 3 fichiers ┐│
│     │░░│ │░░│  (skeleton)                └─────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

1. Chip d'état de sauvegarde : point + mot, jamais un texte nu.
2. NoticeStrip : une affirmation, une phrase, une action ; vit avec la condition.
3. Empty coss sur le stage : une invitation, deux actions, la primaire part des captures.
4. Tuiles en Skeleton pixel-matched avant l'aperçu.
5. Toast sonner habillé coss, qui pulse au succès.

## Tasks to do

### `1)` États qui tiennent, états vides

> Une condition s'affiche là où elle s'explique et disparaît avec elle ; un vide invite.

1. `notice-strip.tsx` : `Alert` coss (`AlertTitle` en foreground, `AlertDescription` en muted, action `Button secondary sm`), `role=status`, pas de fermeture ; consommé par `TopBar` pour : stockage indisponible (remplace l'alerte persistante de `runtime-resilience`), quota Cloud atteint, pont assistant arrêté pendant une campagne.
2. `empty-stage.tsx` : `Empty` coss centré (`EmptyMedia` icône Images, `EmptyTitle`, `EmptyDescription`, `EmptyContent` avec deux boutons) ; déclenche l'`input file` existant ; « Partir d'un modèle » ouvre `TemplatePicker`.
3. Panneaux : les `Empty` de la phase 4 reçoivent leur copy depuis `lib/copy.ts`.

### `2)` Squelettes et arrivée

> Le chrome ne attend jamais ; seules les données arrivent, par netteté.

1. `index.html` : redessiner le squelette de boot sur la géométrie finale (`lib/stage.ts` : barre 36 + 12, filmstrip 184, HUD 134) ; rien ne saute à l'hydratation (mesure : position du bouton Exporter avant/après < 1 px).
2. `ScreenThumbnail.tsx` : `Skeleton` coss aux dimensions exactes de la tuile tant que `screen.thumbnail` est absent ; `oa-arrive` sur l'`<img>` quand il arrive (une fois, classe posée à l'arrivée).
3. `FontPicker.tsx` : aperçu en Skeleton tant que `document.fonts.check` est faux.
4. `LazyDialogFallback` (phase 5) déjà pixel-matched : vérifier que la hauteur du Header squelette = hauteur du Header réel.

### `3)` Toasts, statut, micro-interactions

> Deux signatures physiques, une chip animée, des détails qui répondent.

1. `toast.store.ts` : classes coss `toast` ; compteur pair/impair par type pour alterner `animate-toast-success-odd/even` et `-error-*` (même toast répété rejoue) ; `closeButton` en `Button icon-xs ghost` ; copy depuis `lib/copy.ts`.
2. `save-status.tsx` : trois états, `animate-mark` à chaque changement, `aria-live=polite` ; remplace le libellé texte de `TopBar`.
3. Micro : visibilité de calque (`animate-mark` sur le glyphe) ; drag-over de calque (barre `marker`) ; Slider coss avec valeur en tooltip pendant le drag (`data-dragging`) ; UnitField qui clampe montre la borne 1 s en `FieldDescription` ; bouton pressé `active:scale-[0.98]` (coss `data-pressed`, déjà là : ne pas doubler).
4. `lib/copy.ts` : recenser toutes les phrases d'état/erreur de l'éditeur (toasts, Alert, Empty, AsyncPanel) ; forme « cause. issue. » ; pas d'excuse, pas de « ! », pas de « Oops » ; verbes de bouton au présent (« Exporter 3 écrans »), toasts au participe (« Exporté »).

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `empty-state.spec.ts` : stage vide → `Empty` `role=status`, importer 3 PNG → 3 écrans ; `runtime-resilience.spec.ts` : la NoticeStrip remplace l'alerte persistante, sans bouton fermer, et reste tant que l'IDB est en échec. |
| 2 | `boot-shell.spec.ts` : position du bouton Exporter identique avant/après hydratation (< 1 px) ; une tuile sans thumbnail rend un `Skeleton` de 53 × 116 ; `motion.spec.ts` : `oa-arrive` présent une fois par thumbnail et absent sous reduced motion. |
| 3 | `motion.spec.ts` : toast succès porte une animation `scale`, toast erreur une `translate`, deux toasts identiques consécutifs rejouent (classes odd/even alternées) ; `grep -rn "Oops\|!\"" src/lib/copy.ts` vide ; `semantics.spec.ts` : la chip de statut porte `aria-live`. |
