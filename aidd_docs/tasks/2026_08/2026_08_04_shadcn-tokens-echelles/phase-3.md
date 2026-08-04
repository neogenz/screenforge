---
status: pending
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Instruction: Rythme vertical et géométrie d'îlot

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── src
│   ├── index.css                                       ✏️ .island porte son padding, rayon intérieur dérivé en calc()
│   └── components
│       ├── properties-panel
│       │   ├── PropertiesDrawer.tsx                     ✏️ conteneur défilant : masque de bas, padding d'îlot
│       │   ├── PropertiesPanel.tsx                      ✏️ trois écarts au lieu de sept
│       │   ├── TransformSection.tsx                     ✏️ rythme de section
│       │   ├── DeviceSection.tsx                        ✏️ rythme de section
│       │   ├── TextSection.tsx                          ✏️ rythme de section
│       │   ├── ShapeSection.tsx                         ✏️ rythme de section
│       │   ├── ImageSection.tsx                         ✏️ rythme de section
│       │   ├── BackgroundSection.tsx                    ✏️ rythme de section
│       │   └── ShadowEditor.tsx                         ✏️ rythme de section
│       ├── layers-panel/LayersDrawer.tsx                ✏️ conteneur défilant : masque de bas, padding d'îlot
│       ├── layers-panel/LayersPanel.tsx                 ✏️ padding d'îlot retiré du contenu
│       ├── screens-bar/ScreensBar.tsx                   ✏️ padding d'îlot unifié
│       ├── toolbar/TopBar.tsx                           ✏️ padding d'îlot unifié
│       ├── toolbar/ZoomHud.tsx                          ✏️ padding d'îlot unifié
│       ├── background-editor/BackgroundEditor.tsx       ✏️ rythme de section
│       ├── export-dialog/ExportDialog.tsx               ✏️ inset de modale aligné sur l'échelle
│       ├── globals-editor/GlobalsEditor.tsx             ✏️ idem
│       └── template-picker/TemplatePicker.tsx           ✏️ idem
└── scripts
    └── scale-audit.mjs                                  ✏️ relève aussi les écarts verticaux distincts par panneau
```

## Wireframe

```
┌──────────────────────────────────────────────────┐
│ (1) En-tête de drawer                             │
├──────────────────────────────────────────────────┤
│                                                   │
│ (2) Titre de section                              │
│   ┌─────────────┐ ┌─────────────┐                 │
│   │ Champ       │ │ Champ       │   ← 8 px        │
│   └─────────────┘ └─────────────┘                 │
│   ┌─────────────┐ ┌─────────────┐                 │
│   │ Champ       │ │ Champ       │                 │
│   └─────────────┘ └─────────────┘                 │
│                                     ← 16 px       │
│   Micro-libellé                                   │
│   ┌───────────────────────────────┐               │
│   │ Contrôle                      │               │
│   └───────────────────────────────┘               │
│                                     ← 24 px       │
│ (2) Titre de section                              │
│   ...                                             │
│ (3) ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└──────────────────────────────────────────────────┘
```

1. En-tête de drawer : titre et actions, séparé du contenu par un filet, hauteur fixe.
2. Titre de section : ouvre un groupe. Trois écarts seulement dans tout le drawer, 8 entre champs d'un même groupe, 16 entre groupes, 24 avant une nouvelle section.
3. Bas du drawer : dégradé de masque signalant qu'il reste du contenu, au lieu de la coupe nette actuelle.

## Tasks to do

### `1)` Fermer le rythme vertical à trois écarts

> Sept écarts distincts dans un seul panneau deviennent trois, hiérarchisés.

1. Poser la règle : `gap-2` (8px) entre contrôles d'un même groupe, `gap-4` (16px) entre groupes d'une section, `gap-6` (24px) entre sections. Aucune autre valeur d'écart vertical dans les panneaux.
2. Appliquer la règle à chaque section du panneau Propriétés. Les sections `Transformation`, `Appareil` et `Ombre` utilisent aujourd'hui respectivement 10, 12 et 8 px au même niveau d'imbrication : les trois convergent sur 8.
3. Supprimer les écarts résiduels de 2 et 6 px : ils naissent de marges posées à la main sur des libellés, pas d'un choix de rythme.
4. Appliquer la même règle au panneau Calques, à l'éditeur d'arrière-plan et aux trois modales.

### `2)` Rendre vraie la règle de rayon intérieur

> La règle est écrite dans `index.css` depuis v5 et violée sur les cinq îlots.

1. Faire porter à `.island` son propre padding, au lieu de le laisser à chaque consommateur : les cinq instances rendent aujourd'hui 0, 0, 6, 8 et 10 px.
2. Exprimer le rayon intérieur en `calc(var(--radius-xl) - var(--island-padding))` plutôt qu'en valeur littérale, pour que la règle tienne sans être recalculée à la main.
3. Traiter le cas des drawers, qui ont un padding de 0 parce que leur en-tête est à fleur de bord : leur contenu porte le padding, leur en-tête ne le porte pas.
4. Vérifier les trois modales : l'inset du corps est aujourd'hui de 20 px, celui des cartes internes de 14, celui des lignes de 12. Les ramener sur l'échelle, 24 pour le corps de modale et 16 pour une carte interne.

### `3)` Signaler le contenu qui dépasse

> Le drawer Propriétés coupe un bouton en deux sans rien indiquer.

1. Ajouter un masque en dégradé au bas de la zone défilante du drawer, actif seulement quand il reste du contenu sous le pli.
2. Vérifier que le masque ne mange pas la zone cliquable du dernier contrôle.
3. Appliquer le même traitement au panneau Calques quand la liste dépasse.

### `4)` Étendre la garde aux écarts

> Le rythme vertical rejoint les échelles vérifiées.

1. Étendre `scripts/scale-audit.mjs` : relever, pour chaque panneau flottant, les écarts verticaux distincts entre éléments frères visibles.
2. Faire échouer au-delà de 3 écarts distincts par panneau, en nommant les éléments et les valeurs relevées.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                    |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Le panneau Propriétés ouvert sur un calque d'appareil ne présente que trois écarts verticaux distincts, et l'écart entre deux champs d'un même groupe est identique dans toutes les sections. |
| 2    | Les cinq îlots flottants présentent le même retrait intérieur, et le rayon d'un élément collé au bord d'un îlot suit la courbe de l'îlot sans laisser de croissant de fond visible. |
| 3    | Quand le contenu du drawer Propriétés dépasse, le bas s'estompe au lieu de trancher un contrôle, et le dernier contrôle reste cliquable sur toute sa surface. |
| 4    | `pnpm run audit:scale` échoue en nommant le panneau et les valeurs si l'on réintroduit un quatrième écart vertical.                     |
