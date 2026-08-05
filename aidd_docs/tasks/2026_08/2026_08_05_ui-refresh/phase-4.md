---
status: done
---

# Instruction: l'insertion se voit pendant le glissement

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── src/components/screens-bar/
│   └── ScreensBar.tsx                  ✏️ une barre d'insertion s'ajoute au décalage existant
├── e2e/smoke.spec.ts                   ✏️ le test de glissement assied aussi la barre
└── CLAUDE.md                           ✏️ la règle du réordonnancement
```

## Wireframe

```txt
        ┌────┐ ┌────┐ ▌ ┌────┐ ┌────┐
        │ ⓶  │ │ ⓷  │ ▌ │    │ │ ⓹  │      ▌ = barre d'insertion citron, 3px,
        │    │ │    │ ▌ │vide│ │    │          pleine hauteur de la vignette
        └────┘ └────┘ ▌ └────┘ └────┘

        la rangée s'écarte déjà (acquis) ; la barre nomme le point d'insertion
        et non l'arrangement final — c'est ce que le décalage seul ne dit pas
        quand la place ouverte est en bord de bande ou hors du champ de vision
```

## Tasks to do

### `1)` Dessiner la barre

> Le décalage montre le résultat, la barre montre le geste. Les deux ne disent pas la même chose.

1. Un seul élément dans la bande, positionné depuis `drag.over` et `THUMBNAIL_SLOT` — jamais dix éléments conditionnels.
2. `--color-marker`, 3px de large, `rounded-full`, hauteur de l'aperçu.
3. `pointer-events-none` obligatoire : la barre ne doit pas voler un `dragover`, sinon la cible se fige sur elle.
4. Elle n'apparaît que pendant un glissement, et disparaît au `dragend` comme au `drop`.

### `2)` Vérifier qu'elle ne rouvre pas le bogue du lâcher

> Le décalage libère l'emplacement sous le curseur : c'est ce qui empêche `dragover` d'osciller, et c'est aussi ce qui avait fait échouer le `drop`. Un élément de plus dans cette zone peut tout rejouer.

1. Confirmer que la barre est bien inerte au pointeur, sur mesure et non sur lecture du code.
2. Rejouer le glissement dans les deux sens et vérifier que l'ordre du store change et se conserve.

### `3)` Étendre le test

1. `e2e/smoke.spec.ts` : après le `dragover`, la barre existe et sa position correspond à la cible.
2. Après le `drop`, elle a disparu et l'ordre a changé.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------ |
| 1    | Pendant un glissement, une barre citron marque le point d'insertion ; hors glissement, elle n'est pas dans le DOM.        |
| 2    | Le lâcher conserve l'ordre dans les deux sens, comme avant l'ajout de la barre.                                          |
| 3    | `pnpm run test:e2e` passe, y compris les assertions de position de la barre.                                             |
