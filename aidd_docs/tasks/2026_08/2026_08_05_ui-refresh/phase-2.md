---
status: pending
---

# Instruction: le numéro rentre dans la vignette

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── src/
│   ├── lib/stage.ts                                ✏️ THUMBNAIL_BADGE_GAP et THUMBNAIL_COLUMN_HEIGHT tombent
│   └── components/screens-bar/
│       ├── ScreenThumbnail.tsx                     ✏️ badge en surimpression, la tuile reprend l'état
│       └── ScreensBar.tsx                          ✏️ hauteur de bande, alignement du « + » et du compteur
├── e2e/smoke.spec.ts                               ✏️ le test de glissement suit la nouvelle hauteur
├── CLAUDE.md                                       ✏️ la règle de la pastille est réécrite
└── aidd_docs/memory/design.md                      ✏️ idem
```

## Wireframe

```txt
   au repos                    survol                     écran courant
┌──────────┐               ┌──────────┐                ┌──────────┐  ← soulevée de 2px
│ ⓵        │               │ ⓵     ⋯  │                │ ①        │    ombre un cran plus haute
│          │               │          │                │          │
│  aperçu  │               │  aperçu  │                │  aperçu  │
│          │               │          │                │          │
│          │               │          │                │          │
└──────────┘               └──────────┘                └──────────┘

⓵ = chiffre blanc sur voile sombre translucide, coin haut-gauche, 4px du bord
①  = chiffre encre sur pastille citron, même position, même gabarit

Plus aucune rangée sous les vignettes : la bande perd 26px de hauteur,
le canevas les récupère par STAGE_BOTTOM_INSET.
```

## Tasks to do

### `1)` Poser le badge sur l'aperçu

> Le badge cesse d'être un objet de la scène pour devenir une marque sur l'image. Il ne contraste plus qu'avec une chose : l'aperçu.

1. Le sortir du flux de la colonne, le placer `absolute top-1 left-1` dans le conteneur `overflow-hidden` de l'aperçu.
2. Au repos : voile sombre translucide + `backdrop-blur` léger, chiffre clair. Le voile est ce qui le rend lisible sur un aperçu blanc **comme** sur un aperçu noir — c'est tout l'intérêt du déplacement.
3. Actif : `marker-fill`, même gabarit, même position. Le citron ne change pas de sens, il change de support.
4. Garder `tabular`, le rang sans zéro de tête, et l'ombre de contact **retirée** : un badge posé sur l'image ne se détache pas d'elle.

### `2)` Rendre les 26px au canevas

> La colonne n'a plus de seconde rangée : tout ce qui la mesurait disparaît.

1. Supprimer `THUMBNAIL_BADGE_GAP` et `THUMBNAIL_COLUMN_HEIGHT` de `lib/stage.ts`.
2. `FILMSTRIP_HEIGHT = THUMBNAIL_HEIGHT + FILMSTRIP_PADDING * 2`.
3. Recentrer le bouton « + » et le compteur sur `THUMBNAIL_HEIGHT` — ils s'y alignaient déjà, la constante intermédiaire disparaît seulement.
4. Vérifier `STAGE_BOTTOM_INSET` : le canevas doit gagner exactement la différence, sans réajustement à la main.

### `3)` Rendre l'état à la tuile

> Le badge seul ne suffit plus à 46px : il occupe le coin, pas la silhouette. La tuile reprend une part de l'état, mais pas un anneau.

1. Écran courant : léger soulèvement (`-translate-y-*` d'un cran de l'échelle) + l'ombre d'un niveau au-dessus.
2. **Pas d'anneau citron** : mesuré, 2px de trait plein sur une tuile de 46 de large est le trait le plus épais de l'interface et se lit comme un surligneur.
3. Réserver le soulèvement dans le rembourrage de la bande, sinon la tuile active se fait rogner par la boîte défilante.
4. `motion-reduce` : le soulèvement disparaît, l'ombre et le badge restent — l'état ne doit jamais tenir au mouvement seul.

### `4)` Reprendre le champ de renommage

> Il se posait sur la puce, qui n'existe plus.

1. Le poser sur le bas de l'aperçu, pleine largeur de la tuile.
2. Vérifier qu'il reste au-dessus du badge en z, et que `Échap` / `Entrée` / blur se comportent comme avant.

### `5)` Mettre les mesures à jour

1. `e2e/smoke.spec.ts` : le test de glissement lit des hauteurs, pas des puces — vérifier qu'il passe sans modification, et le corriger sinon.
2. Réécrire dans `CLAUDE.md` et `aidd_docs/memory/design.md` la règle « seul l'écran courant porte la pastille » : elle reste vraie, mais la pastille a changé de support.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Le numéro se lit sur un aperçu blanc et sur un aperçu noir, dans les deux thèmes ; le citron n'apparaît que sur l'écran courant.            |
| 2    | `FILMSTRIP_HEIGHT` diminue de 26 exactement, `scrollHeight === clientHeight` sur la bande, et la planche remonte d'autant sans réglage.      |
| 3    | L'écran courant se distingue à 1× sans anneau ; sous `prefers-reduced-motion` il se distingue encore ; l'anneau de focus n'est pas rogné.    |
| 4    | Double-clic ouvre le champ, `Entrée` valide, `Échap` annule, et le champ ne recouvre pas le badge.                                          |
| 5    | `typecheck`, `lint`, `audit:contrast`, `audit:scale`, `test:unit` et `test:e2e` passent ; les deux documents décrivent ce qui est à l'écran. |
