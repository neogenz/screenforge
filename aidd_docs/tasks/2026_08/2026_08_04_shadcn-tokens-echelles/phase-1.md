---
status: done
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Instruction: Contrat de tokens shadcn

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── src
│   ├── index.css                                   ✏️ rampe réécrite sur les noms shadcn, accent citron renommé, pont @theme inline supprimé
│   ├── components
│   │   ├── ui
│   │   │   ├── button.tsx                          ✏️ raised/raised-hover → secondary/accent
│   │   │   ├── icon-button.tsx                     ✏️ idem + data-[active] sur accent
│   │   │   ├── input.tsx                           ✏️ field-surface sur muted + border-input
│   │   │   ├── textarea.tsx                        ✏️ idem input
│   │   │   ├── number-field.tsx                    ✏️ déjà sur muted/input/ring, aligner le reste
│   │   │   ├── select.tsx                          ✏️ bg-panel → bg-popover, raised-hover → accent
│   │   │   ├── dropdown.tsx                        ✏️ idem select
│   │   │   ├── ContextMenu.tsx                     ✏️ idem select
│   │   │   ├── popover.tsx                         ✏️ bg-panel → bg-popover
│   │   │   ├── dialog.tsx                          ✏️ bg-scrim → bg-black/50
│   │   │   ├── command-palette.tsx                 ✏️ surfaces + survol
│   │   │   ├── toggle-group.tsx                    ✏️ bg-inset → bg-muted, data-[state=on] sur secondary
│   │   │   ├── switch.tsx                          ✏️ bg-inset → bg-muted, border-strong → border-input
│   │   │   ├── slider.tsx                          ✏️ piste sur muted, poignée sur foreground
│   │   │   ├── swatch-button.tsx                   ✏️ bordures sur border/input
│   │   │   ├── kbd.tsx                             ✏️ bg-raised → bg-secondary
│   │   │   ├── field.tsx                           ✏️ field-label sur muted-foreground
│   │   │   ├── label.tsx                           ✏️ idem field
│   │   │   ├── segmented.tsx                       ✏️ hérite de toggle-group, vérifier
│   │   │   ├── angle-control.tsx                   ✏️ surfaces
│   │   │   └── shortcuts-overlay.tsx               ✏️ surfaces
│   │   ├── layers-panel/LayerItem.tsx              ✏️ accent-mark → marker-soft (ligne sélectionnée)
│   │   ├── screens-bar/ScreenThumbnail.tsx         ✏️ accent-fill → marker-fill (écran courant)
│   │   ├── background-editor/**                    ✏️ renommage mécanique des surfaces
│   │   ├── color-picker/**                         ✏️ idem
│   │   ├── device-picker/**                        ✏️ idem
│   │   ├── export-dialog/**                        ✏️ idem
│   │   ├── globals-editor/**                       ✏️ idem
│   │   ├── gradient-editor/**                      ✏️ idem
│   │   ├── properties-panel/**                     ✏️ idem
│   │   ├── screens-bar/ScreensBar.tsx              ✏️ idem
│   │   ├── template-picker/**                      ✏️ idem
│   │   ├── text-editor/**                          ✏️ idem
│   │   ├── toolbar/**                              ✏️ idem
│   │   └── canvas/**                               ✏️ idem
│   └── lib
│       └── canvas-utils.ts                         ✏️ cadre de sélection figé : vérifier qu'aucun token renommé n'y est lu
└── scripts
    └── contrast-audit.mjs                          ✏️ lit les noms de tokens, mettre à jour la liste des paires
```

## Tasks to do

### `1)` Réécrire la rampe sur les noms shadcn

> `src/index.css` n'expose plus que des noms shadcn, plus 13 ajouts produit.

1. Remplacer le bloc `@theme` par la table de correspondance ci-dessous, en gardant les valeurs OKLCH actuelles (aucune couleur ne change à cette étape, seuls les noms bougent).

   | Aujourd'hui | Devient | Nature |
   | --- | --- | --- |
   | `--color-stage` | `--color-stage` | ajout conservé |
   | `--color-background` | `--color-background` | shadcn |
   | `--color-panel` | `--color-card` **et** `--color-popover` | shadcn |
   | `--color-inset` | `--color-muted` | shadcn |
   | `--color-raised` | `--color-secondary` | shadcn |
   | `--color-raised-hover` | `--color-accent` | shadcn, rôle survol neutre |
   | `--color-raised-active` | supprimé | `secondary` + `active:brightness-110` |
   | `--color-foreground` | `--color-foreground` | shadcn |
   | `--color-foreground-muted` | `--color-muted-foreground` | shadcn |
   | `--color-faint` | supprimé | fusionné dans `muted-foreground` |
   | `--color-border` | `--color-border` | shadcn |
   | `--color-border-strong` | `--color-input` | shadcn, bordure de champ |
   | `--color-accent` (citron) | `--color-marker` | ajout renommé |
   | `--color-accent-hover/ink/soft/line` | `--color-marker-hover/ink/soft/line` | ajouts renommés |
   | `--color-danger` | `--color-destructive` | shadcn |
   | `--color-danger-soft` | supprimé | `destructive/14` en classe |
   | `--color-success` / `--color-warning` | inchangés | ajouts conservés |
   | `--color-selection` / `-soft` | supprimés | `foreground` et `foreground/14` |
   | `--color-artboard-ring` / `-active` / `-shadow` | inchangés | ajouts conservés |
   | `--color-scrim` | supprimé | `bg-black/50` sur l'overlay |
   | `--shadow-island` / `-menu` / `-modal` | `--shadow-md` / `-lg` / `-xl` | namespace shadcn |
   | `--shadow-inset` / `--hairline-top` | inchangés | ajouts conservés |
   | `--radius-xs..xl` (5 valeurs) | `--radius: 0.625rem` + chaîne dérivée | shadcn |
   | `--z-*` (6) | inchangés | ajouts conservés |

2. Poser `--radius: 0.625rem` et la chaîne dérivée shadcn. Vérifier que les valeurs calculées sortent bien en entiers : `sm 6 / md 8 / lg 10 / xl 14`.
3. Ajouter `--color-ring: var(--color-marker-line)` pour que les utilitaires `ring-*` de shadcn portent le même citron que le focus.
4. Supprimer intégralement le bloc `@theme inline` (lignes 163-184) : les noms coïncident désormais, le pont n'a plus d'objet.
5. Reporter la même correspondance dans le bloc `.light`.
6. Renommer les utilitaires `@utility accent-fill` → `marker-fill` et `@utility accent-mark` → `marker-soft`.

### `2)` Propager le renommage dans les composants

> Aucune classe ne référence plus un token supprimé.

1. Renommage mécanique sur `src/`, dans l'ordre du plus spécifique au plus générique pour éviter les collisions de préfixe : `raised-hover` → `accent`, `raised-active` → `secondary`, `border-strong` → `input`, `foreground-muted` → `muted-foreground`, `faint` → `muted-foreground`, `raised` → `secondary`, `inset` → `muted`, `panel` → `card`, `accent-` → `marker-`, `danger` → `destructive`.
2. Traiter à part les surfaces de menus : `bg-card` sur un `Select`/`Dropdown`/`Popover`/`ContextMenu` doit devenir `bg-popover`, pas `bg-card`.
3. Traiter à part `dialog.tsx` : `bg-scrim` → `bg-black/50`.
4. Corriger les classes composées de `index.css` qui portaient les anciens noms : `.island`, `.surface-inner`, `.surface-modal`, `.field-surface`, `.field-label`, `.panel-title`, `.section-title`, `[cmdk-group-heading]`.
5. Vérifier qu'aucune occurrence des noms supprimés ne subsiste dans `src/` ni dans `scripts/`.

### `3)` Remettre les gardes au vert

> Les deux gardes existantes lisent les nouveaux noms et passent.

1. Mettre à jour la liste des paires ink/surface de `scripts/contrast-audit.mjs` sur les nouveaux noms.
2. Exécuter `pnpm run audit:contrast` et vérifier que le pire cas reste ≥ 4.5:1 dans les deux thèmes.
3. Exécuter `pnpm test` puis `pnpm run test:e2e`.
4. Exécuter `pnpm run probe:visual` et comparer les captures dark/light × vide/peuplé à l'état d'avant : à cette phase, seuls les rayons doivent avoir bougé (9 → 8 sur les contrôles, 14 → 14 sur les îlots).

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `src/index.css` ne contient plus de bloc `@theme inline`, et les seuls tokens hors nomenclature shadcn sont `stage`, `marker*`, `success`, `warning`, `artboard-*`, `shadow-inset`, `hairline-top` et les six `z-*`. |
| 1    | Un composant shadcn stock posé dans l'app affiche un survol gris neutre, pas citron.                                                             |
| 2    | L'application se charge sans couleur manquante : aucune surface ne rend en transparent ni en noir par défaut, en dark comme en light.            |
| 2    | La ligne de calque sélectionnée et la vignette d'écran courant portent toujours la marque citron.                                                |
| 3    | `pnpm run audit:contrast` annonce un pire cas ≥ 4.5:1 sur les deux thèmes.                                                                       |
| 3    | Les suites unitaires et e2e passent, et les captures `probe:visual` ne montrent d'autre écart que les rayons de contrôle passés de 9 à 8 px.     |
