---
status: done
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Instruction: chrome — barre haute, îlots, filmstrip, HUD, menus contextuels

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
apps/web/src
├── components
│   ├── patterns
│   │   ├── island.tsx                    ✅ la surface flottante : Card coss (bg-popover, border, shadow-lg/5, corner-shape: squircle en progressive enhancement), padding = --spacing(1) comme CardPanel ; prop `flush` pour les drawers (en-tête à bord perdu)
│   │   ├── drawer-island.tsx             ✅ Island + en-tête (h2 panel-title, bouton fermer icon-xs) + ScrollArea coss scrollFade ; largeur depuis lib/stage.ts (drawerWidth) ; aside aria-labelledby
│   │   └── status-chip.tsx               ✅ Badge coss + point d'état (copie mandat-tan : tone brand/success/warning/neutral) pour « Enregistré », « Cloud », « À synchroniser », MCP
│   ├── toolbar
│   │   ├── TopBar.tsx                    ✏️ Toolbar coss (ToolbarGroup outils / ToolbarSeparator / ToolbarGroup projet / ToolbarGroup actions) ; le CTA Exporter = Button default ; overflow en Menu coss sous TOP_BAR_COMPACT_WIDTH (useMediaQuery, inchangé) ; statuts en StatusChip
│   │   └── ZoomHud.tsx                   ✏️ Island + ToggleGroup coss (−, valeur tabular, +, « Ajuster ») ; Kbd coss pour les raccourcis du tooltip
│   ├── layers-panel/LayersDrawer.tsx     ✏️ DrawerIsland ; useDeferredUnmount conservé (220 ms = --duration-slow) ; data-starting-style pour l'entrée
│   ├── properties-panel/PropertiesDrawer.tsx ✏️ idem, côté droit
│   ├── screens-bar
│   │   ├── ScreensBar.tsx                ✏️ logique DnD, picked, THUMBNAIL_SLOT inchangés ; le bouton « + » = Button coss icon ; barre d'insertion en bg-marker (inchangé)
│   │   └── ScreenThumbnail.tsx           ✏️ la tuile reste un <button> natif (cible du drag) stylée coss (rounded-md, border, focus-visible:ring) ; badge de rang = Badge coss variant outline / marker-fill si courant ; Input coss pour le renommage ; ContextMenu coss
│   ├── canvas
│   │   ├── SelectionToolbar.tsx          ✏️ Toolbar coss dans une Island compacte près de la sélection ; UnitField pour X/Y ; SwatchButton pattern ; Popover coss
│   │   └── CanvasEditor.tsx              ✏️ ContextMenu coss (même items que layer-menu.tsx)
│   └── project-switcher/ProjectSwitcher.tsx ✏️ Popover coss + Input coss (filtre) + liste ScrollArea ; section courante = Card coss ; StatusChip pour la disponibilité
├── lib/stage.ts                          ✏️ TOP_BAR_HEIGHT 50 → 52 si la Toolbar coss h-9 + padding island l'impose (mesurer ; sinon inchangé) ; ISLAND_MARGIN 12 inchangé
└── App.tsx                               ✏️ header/aside/main inchangés en sémantique ; plus de classes .island
```

## User Journey

```mermaid
flowchart TD
  A[Éditeur ouvert] --> B[Barre haute : outils | projet + statut | Exporter]
  B --> C[⌘⇧P → drawer Propriétés glisse depuis la droite, en-tête à bord perdu]
  C --> D[Clic sur une tuile du filmstrip → badge citron, tuile qui se lève]
  D --> E[Clic droit → ContextMenu coss : Dupliquer / Renommer / Supprimer 3 écrans]
  E --> F[Zoom HUD : − 100 % + · Ajuster]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    projet de 3 écrans, un calque texte, fenêtre 1600×1000 => éditeur prêt: 5: browser
  section Happy path
    lire le header => role=banner, Toolbar coss, bouton "Exporter" visible et variant default: 5: browser
    ⌘⇧P => aside[name=Propriétés] visible, entrée < 300 ms, en-tête h2: 5: browser
    ⌘⇧P => le drawer sort, puis est démonté après 220 ms: 5: browser
    clic tuile 2 => aria-current sur la tuile 2, badge marker, la 1 revient au repos: 5: browser
    clic droit tuile 2 => [role=menu] coss avec "Supprimer" ; Escape ferme: 5: browser
  section Edge case - largeur 900
    viewport 900 => ⌘⇧L puis ⌘⇧P => un seul drawer ouvert, Exporter toujours visible: 1: browser
  section Edge case - largeur 600
    viewport 600 => les outils sont dans le Menu de débordement, le filmstrip ancré à gauche reste cliquable: 1: browser
```

## Wireframe

```txt
┌──────────────────────────────────────────────────────────────────────────────┐
│ (1) ┌ Toolbar ────────────────────────────────────────────────────────────┐   │
│     │ [T][▭][★][img][📱] │ Projet ▾ · (2)●Enregistré │ ⌘K  ⋯  [Exporter] │   │
│     └─────────────────────────────────────────────────────────────────────┘   │
│ (3)┌ Calques ──── ×┐                                        ┌ Propriétés ─ ×┐(4)│
│    │ ▸ filtre      │          ┌──────────────┐              │ Texte          │  │
│    │ ≡ Titre       │          │              │              │  Police ▾      │  │
│    │ ≡ iPhone 16   │          │  artboard 2  │              │  Taille [48]px │  │
│    │ ≡ Fond        │          │   (courant)  │              │ ─────────────  │  │
│    └───────────────┘          │              │              │ Transformation │  │
│                               └──────────────┘              │  X [120]px ⇆   │  │
│                      (5)┌────── SelectionToolbar ──────┐    │  Y [ 88]px     │  │
│                         │ X[120] Y[88] ■ ▾  ⋯          │    └────────────────┘  │
│                         └──────────────────────────────┘                        │
│ (6)   ┌1┐ ┌2┐ ┌3┐ ┌+┐                                        (7)┌ − 100% + ⊡ ┐ │
│       │▫│ │▪│ │▫│                                               └────────────┘ │
│       └─┘ └─┘ └─┘                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

1. Barre haute : Toolbar coss en trois groupes (création, projet + statut, actions) ; Exporter seul en `default`.
2. Statut : StatusChip (point + mot), remplace les libellés texte nus.
3. Drawer Calques : Island `flush`, en-tête à bord perdu, liste dans ScrollArea à fondu.
4. Drawer Propriétés : même coque ; sections = bandes hairline (phase 4).
5. Barre de sélection : Island compacte, Toolbar coss, visible quand le drawer Propriétés est fermé.
6. Filmstrip : tuiles-boutons, badge de rang au-dessus, la courante se lève ; pas de surface propre.
7. HUD de zoom : Island, ToggleGroup coss.

## Tasks to do

### `1)` Le pattern `Island` et `DrawerIsland`

> Une seule coque flottante, composée de Card coss, qui remplace `.island`/`.island-flush`.

1. `island.tsx` : `Card` coss (`bg-popover border shadow-lg/5 rounded-2xl`) + `style={{ cornerShape: 'squircle' }}` via une classe utilitaire `@utility squircle { corner-shape: squircle }` dans `stage.css` ; `p-1` (le `--island-padding` dérivé disparaît : coss est dessiné pour `--spacing(1)` entre frame et contrôle).
2. `drawer-island.tsx` : `<aside aria-labelledby>` + en-tête (`h2` `text-base font-medium`, bouton fermer `Button size="icon-xs" variant="ghost"`) + `ScrollArea scrollFade` ; entrée/sortie par `data-open` + `transition-ui` (translate 8 px + opacité), `useDeferredUnmount(260)` aligné sur `--duration-slow`.
3. Largeur et position depuis `lib/stage.ts` (`drawerWidth`, `ISLAND_MARGIN`, `STAGE_TOP_INSET`) ; rien d'inline.

### `2)` Barre haute sur Toolbar coss

> Trois groupes pesés : outils, projet, actions ; un seul bouton plein.

1. `TopBar.tsx` : `Toolbar` + `ToolbarGroup` × 3 + `ToolbarSeparator` ; outils en `ToolbarButton render={<Button size="icon" variant="ghost" />}` avec Tooltip coss (libellé + Kbd) ; Exporter en `Button` `default`.
2. Débordement : `Menu` coss sous `TOP_BAR_COMPACT_WIDTH` (items secondaires), puis les outils rejoignent le menu sous `TOP_BAR_TOOLS_WIDTH` ; l'entrée iPhone pliée garde le modèle du projet (règle existante).
3. Statuts (sauvegarde, Cloud, MCP) en `StatusChip` ; `McpStatusDot` devient le point du chip.
4. `ProjectSwitcher` : Popover coss, section courante en Card, catalogue filtré dans ScrollArea, disponibilité en StatusChip (`Cet appareil` / `Cloud` / `À synchroniser`, libellés inchangés).

### `3)` Filmstrip, HUD, barre de sélection, menus contextuels

> La logique mesurée ne bouge pas ; seule la peau devient coss.

1. `ScreenThumbnail.tsx` : garder le `<button>` natif (drag natif + tuile-bouton), classes coss (`rounded-md border bg-card focus-visible:ring-2 ring-ring`), badge `Badge` coss (`variant="outline"` au repos, `marker-fill` courant), lift et ombre `--shadow-handle` inchangés ; renommage en `Input` coss `size` compact ; ContextMenu coss.
2. `ScreensBar.tsx` : bouton « + » en `Button size="icon-sm" variant="outline"` ; DnD, `picked`, slot, barre d'insertion inchangés.
3. `ZoomHud.tsx` : Island + `ToggleGroup` coss ; valeur en `tabular-nums`.
4. `SelectionToolbar.tsx` : Island compacte + Toolbar coss ; `UnitField` pour X/Y ; `SwatchButton` pattern ; apparaît/disparaît par `animate-enter-quick`.
5. `CanvasEditor.tsx` : ContextMenu coss, items partagés avec `layer-menu.tsx`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `grep -rn "island" src --include=*.tsx --include=*.css` ne renvoie que `patterns/island.tsx` et ses consommateurs ; un drawer fermé est démonté (`dialogs-a11y.spec.ts`) ; l'entrée dure < 300 ms (`motion.spec.ts`). |
| 2 | `responsive-chrome.spec.ts` vert (Exporter visible à 560 px, un seul drawer à 876 px, statuts qui ne chevauchent pas les outils) ; `semantics.spec.ts` : `banner` présent, curseur `pointer` sur tous les `ToolbarButton`. |
| 3 | `screens-bar.spec.ts` vert (sélection multiple ⌘/⇧, réordonnancement, renommage, menu de portée « Supprimer 3 écrans ») ; `canvas-viewport.spec.ts` vert (zoom HUD) ; `pnpm run probe:visual` produit quatre captures sans chrome teinté. |
