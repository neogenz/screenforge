---
status: done
---

# Instruction: Design v2 — direction specimen/blueprint

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
src/landing/
├── landing.css                 ✏️ filets de colonne, labels techniques, dimension lines
├── components/
│   ├── SpecLabel.tsx           ✅ micro-label technique (2xs, uppercase, tracking) — signature
│   ├── DimensionNote.tsx       ✅ callout de dimension façon plan (filet + valeur tabulaire)
│   ├── SectionHeading.tsx      ✅ en-tête numéroté « 01 — … » + filet
│   ├── Pricing.tsx             ✏️ tableau comparatif hairline remplace les trois cartes
│   ├── Hero.tsx                ✏️ visuel annoté par des DimensionNote
│   ├── ProofStrip.tsx          ✏️ chiffres géants tabulaires, filets verticaux
│   ├── Features.tsx            ✏️ sections numérotées, composition plan technique
│   ├── Faq.tsx                 ✏️ rangées numérotées
│   └── Nav.tsx / Footer.tsx    ✏️ alignement sur la grille à filets
```

## Wireframe

```txt
│        │                                            │  ← filets de colonne
│  SF ···································· EN | FR · [Ouvrir] │
│        │                                            │
│  SCREENSHOT SPEC — IPHONE 6.9″          (SpecLabel) │
│  Des captures App Store,                            │
│  au pixel près.                                     │
│  [Commencer]  [Voir les tarifs]                     │
│        ┌──────────────────────────────┐             │
│        │  planche réelle              │←── 1320 px ← DimensionNote
│        │                              │             │
│        └──────────────────────────────┘             │
│              ↑ 2868 px (DimensionNote)              │
├─────────────────────────────────────────────────────┤
│  1320×2868        │  PNG-24 · sRGB   │  10 écrans   │  ← chiffres géants
├─────────────────────────────────────────────────────┤
│  01 — L'ÉDITEUR                                     │
│  texte │ visuel débordant                           │
│  02 — L'EXPORT                                      │
│  visuel │ texte                                     │
├─────────────────────────────────────────────────────┤
│  03 — TARIFS  (tableau hairline, pas de cartes)     │
│              Gratuit │ Mensuel     │ Lifetime       │
│  Exports     3/set   │ illimités   │ illimités      │
│  Watermark   oui     │ non         │ non            │
│  Prix        0 $     │ 9,99 $/mois │ 39,99 $        │
├─────────────────────────────────────────────────────┤
│  04 — QUESTIONS (rangées numérotées)                │
└─────────────────────────────────────────────────────┘
```

## Tasks to do

### `1)` Vocabulaire blueprint

> Les trois primitives qui portent la direction : label technique, callout de cote, en-tête numéroté.

1. `SpecLabel` : text-2xs, uppercase, tracking 0.12em, muted — pour les mentions de spécification (« SCREENSHOT SPEC — IPHONE 6.9″ »).
2. `DimensionNote` : filet 1px avec embêts + valeur tabulaire, horizontal ou vertical — la cote d'un plan.
3. `SectionHeading` : « 01 — Titre » aligné sur un filet horizontal plein container.
4. `landing.css` : filets de colonne verticaux encadrant le container (background-image hairlines), aucune couleur ajoutée.

### `2)` Recomposer les sections

> Même contenu, autre présence : la page se lit comme une fiche technique du produit.

1. Hero : SpecLabel au-dessus du titre, visuel réel annoté de deux DimensionNote (1320 / 2868), filets de colonne visibles.
2. ProofStrip : chiffres en text-5xl+ tabulaire, séparés par des filets verticaux plein-hauteur.
3. Features : chaque bloc précédé d'un SectionHeading numéroté ; le visuel garde son débordement de grille.
4. Pricing : tableau hairline (rangées = caractéristiques, colonnes = offres, colonne Lifetime sur fond `card`), CTAs intégrés à la dernière rangée ; grille de cartes supprimée.
5. FAQ : rangées numérotées 4.1, 4.2… en tabulaire devant chaque question.
6. `audit:landing` reste vert ; reveal/motion inchangés ; contrastes ≥ 4,5:1.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                  |
| ---- | ---------------------------------------------------------------------------------------------------- |
| 1    | Le hero porte au moins deux cotes de dimension annotées sur le visuel réel                           |
| 2    | Chaque section est introduite par un en-tête numéroté sur filet                                      |
| 3    | Le pricing est un tableau à filets sans aucune carte ; la colonne Lifetime se distingue par la valeur |
| 4    | `audit:landing` vert ; aucune couleur chromatique ajoutée hors visuels produit                       |
