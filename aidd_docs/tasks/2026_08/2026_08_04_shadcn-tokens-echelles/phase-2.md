---
status: pending
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Instruction: Échelles métriques fermées

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── src
│   ├── index.css                                   ✏️ --text-2xs ajouté, body 13.5 → 14, classes de titre sur l'échelle
│   └── components
│       ├── ui
│       │   ├── button.tsx                          ✏️ 30/34/40 → 32/36/40, text-[12.5px] → text-sm
│       │   ├── icon-button.tsx                     ✏️ size sm/md alignés sur size-8/size-9
│       │   ├── input.tsx                           ✏️ h-8 conservé, text-[12.5px] → text-sm
│       │   ├── textarea.tsx                        ✏️ échelle de type
│       │   ├── number-field.tsx                    ✏️ échelle de type
│       │   ├── select.tsx                          ✏️ h-8, items h-7 → h-8, échelle de type
│       │   ├── dropdown.tsx                        ✏️ items sur h-8, échelle de type
│       │   ├── ContextMenu.tsx                     ✏️ idem dropdown
│       │   ├── toggle-group.tsx                    ✏️ items h-8, rayon intérieur dérivé
│       │   ├── slider.tsx                          ✏️ hauteur de zone tactile
│       │   ├── kbd.tsx                             ✏️ text-[10px] → text-2xs
│       │   ├── command-palette.tsx                 ✏️ échelle de type
│       │   └── shortcuts-overlay.tsx               ✏️ échelle de type
│       ├── canvas/SelectionToolbar.tsx             ✏️ hauteur hors grille
│       ├── text-editor/FontPicker.tsx              ✏️ hauteur hors grille
│       ├── device-picker/DevicePicker.tsx          ✏️ échelle de type
│       ├── export-dialog/ExportDialog.tsx          ✏️ échelle de type, rounded-[2px]
│       ├── layers-panel/LayerItem.tsx              ✏️ échelle de type
│       ├── properties-panel/PropertiesPanel.tsx    ✏️ échelle de type
│       ├── screens-bar/ScreenThumbnail.tsx         ✏️ échelle de type
│       ├── screens-bar/ScreensBar.tsx              ✏️ échelle de type
│       ├── template-picker/TemplatePicker.tsx      ✏️ échelle de type
│       ├── toolbar/TopBar.tsx                      ✏️ échelle de type, rounded-[3px]
│       ├── toolbar/ZoomHud.tsx                     ✏️ échelle de type
│       ├── color-picker/**                         ✏️ rounded-[4px]
│       └── gradient-editor/**                      ✏️ rounded-[8px]
├── scripts
│   └── scale-audit.mjs                             ✅ garde exécutable : compte les valeurs distinctes rendues
└── package.json                                    ✏️ script audit:scale, ajouté à test:release
```

## Wireframe

```
┌──────────────────────────────────────────────────┐
│ (1) Titre de panneau            text-sm/semibold  │
├──────────────────────────────────────────────────┤
│ (2) Titre de section            text-sm/semibold  │
│                                                   │
│  (3) Micro-libellé              text-2xs          │
│  ┌────────────────┐ ┌────────────────┐            │
│  │ (4) Champ  h-8 │ │ (4) Champ  h-8 │            │
│  └────────────────┘ └────────────────┘            │
│                                                   │
│  (3) Micro-libellé              text-2xs          │
│  ┌──────────────────────────────────┐             │
│  │ (5) Groupe segmenté         h-8  │             │
│  └──────────────────────────────────┘             │
│                                                   │
│  ┌──────────────────────────────────┐             │
│  │ (6) Bouton de section       h-8  │             │
│  └──────────────────────────────────┘             │
└──────────────────────────────────────────────────┘
```

1. Titre de panneau : le seul niveau au-dessus des sections, différencié par le poids et non par la taille.
2. Titre de section : même taille que le corps, poids semi-gras, marque l'entrée d'un groupe.
3. Micro-libellé : le seul usage de `text-2xs`, réservé aux étiquettes de champ.
4. Champ : hauteur unique de panneau, `h-8`. Les champs numériques gardent leur préfixe inline.
5. Groupe segmenté : la même hauteur que les champs, rayon intérieur dérivé du rayon du groupe.
6. Bouton de section : la même hauteur que les champs, pas de troisième hauteur intermédiaire.

## Tasks to do

### `1)` Fermer l'échelle typographique à trois tailles

> Six tailles rendues dans une bande de 5px deviennent trois tailles séparées.

1. Ajouter un unique token dans `@theme` : `--text-2xs: 11px`. Les deux autres tailles sont celles de Tailwind, `text-xs` (12px) et `text-sm` (14px). Ne rien redéfinir d'autre.
2. Porter le `body` de `13.5px` à `14px` : une taille entière évite les line-box fractionnaires, et elle coïncide avec `text-sm`.
3. Remplacer chaque taille littérale par la classe correspondante : `10px` et `10.5px` et `11px` et `11.5px` → `text-2xs` ; `12px` et `12.5px` et `13px` → `text-xs` ; `13.5px` et `14px` → `text-sm`. Les tailles isolées `15px` et `22px` des titres et de l'export deviennent `text-sm font-semibold` et `text-lg`.
4. Réécrire `.panel-title`, `.section-title` et `.field-label` sur ces trois tailles : la hiérarchie passe par le poids et la couleur, plus par des écarts d'un pixel.
5. Vérifier que la densité reste acceptable dans le panneau Propriétés : le passage de 12.5 à 14px sur le corps élargit les libellés. Ajuster la largeur du drawer si un libellé se tronque.

### `2)` Fermer l'échelle de hauteurs à celles de shadcn

> Cinq hauteurs rendues deviennent deux, prises sans invention dans le jeu amont.

1. Supprimer les hauteurs inventées de `button.tsx` : `h-[30px]` / `h-[34px]` / `h-[40px]` deviennent `h-8` / `h-9` / `h-10`, les tailles shadcn.
2. Poser `sm` (32px) comme taille par défaut de tout contrôle de panneau, et `md` (36px) pour la barre du haut et les pieds de modale. Aucun contrôle ne prend de troisième hauteur.
3. Aligner `icon-button.tsx` sur `size-8` / `size-9`.
4. Porter les items de menu de `select.tsx`, `dropdown.tsx` et `ContextMenu.tsx` de `h-7` à `h-8`.
5. Corriger les deux hauteurs hors grille restantes dans `canvas/SelectionToolbar.tsx` et `text-editor/FontPicker.tsx`.

### `3)` Ramener les rayons orphelins sur la chaîne

> Le rayon ne prend plus que les quatre valeurs dérivées de `--radius`.

1. Remplacer `rounded-[2px]`, `rounded-[3px]`, `rounded-[4px]` et `rounded-[8px]` par `rounded-sm` ou `rounded-md` selon le conteneur.
2. Vérifier que les contrôles portent `rounded-md` (8), les îlots et modales `rounded-xl` (14), et les éléments internes `rounded-sm` (6).

### `4)` Poser la garde exécutable

> Une échelle non vérifiée dérive : la fermer par un script, comme le contraste.

1. Écrire `scripts/scale-audit.mjs` sur le modèle de `scripts/visual-probe.mjs` : lancer l'app sous Playwright, peupler un écran, puis relever dans le DOM les valeurs distinctes de `font-size`, de hauteur des contrôles interactifs et de `border-radius`.
2. Faire échouer le script au-delà des seuils : plus de 3 tailles de police, plus de 2 hauteurs de contrôle hors éléments de canvas, plus de 4 rayons non nuls.
3. Faire afficher au script les valeurs relevées et les éléments fautifs, pas seulement le verdict.
4. Ajouter `audit:scale` aux scripts `package.json` et le chaîner dans `test:release`, à côté de `audit:contrast`.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                     |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Une inspection du DOM de l'app peuplée ne relève que trois tailles de police : 11, 12 et 14 px, plus la taille de titre de modale.       |
| 1    | Aucun libellé du panneau Propriétés n'est tronqué ni ne passe à la ligne après l'agrandissement du corps.                                |
| 2    | Les contrôles interactifs ne rendent que deux hauteurs, 32 et 36 px ; ni 30 ni 34 n'apparaissent.                                        |
| 2    | Un bouton posé à côté d'un champ dans le même panneau aligne ses arêtes haute et basse sur celles du champ.                              |
| 3    | Le DOM ne rend que les rayons 6, 8, 14 et plein ; aucune valeur isolée de 2, 3, 4 ou 9 px ne subsiste.                                   |
| 4    | `pnpm run audit:scale` passe sur l'état corrigé, et échoue en nommant l'élément fautif si l'on réintroduit une taille de police hors échelle. |
| 4    | `pnpm run test:release` enchaîne la nouvelle garde sans intervention manuelle.                                                            |
