---
status: pending
---

# Instruction: la vignette dit ce qu'elle montre

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── src/
│   ├── lib/stage.ts                                ✏️ THUMBNAIL_HEIGHT relevée, largeur toujours déduite
│   └── components/screens-bar/
│       ├── ScreenThumbnail.tsx                     ✏️ libellé sous la vignette, seulement s'il a été choisi
│       └── ScreensBar.tsx                          ✏️ hauteur de bande selon la présence d'un libellé
├── src/lib/screens.ts                              ✅ screenHasCustomName() — un seul endroit décide
├── src/lib/screens.test.ts                         ✅ le nom par défaut ne compte pas comme un nom
└── CLAUDE.md                                       ✏️ la règle du libellé
```

## Wireframe

```txt
  aucun écran renommé                     deux écrans renommés
┌────┐ ┌────┐ ┌────┐ ┌────┐          ┌────┐ ┌────┐ ┌────┐ ┌────┐
│ ⓵  │ │ ⓶  │ │ ⓷  │ │ ⓸  │          │ ①  │ │ ⓶  │ │ ⓷  │ │ ⓸  │
│    │ │    │ │    │ │    │          │    │ │    │ │    │ │    │
└────┘ └────┘ └────┘ └────┘          └────┘ └────┘ └────┘ └────┘
                                     Accroche      Tarifs
   ↑ pas de rangée de libellés :        ↑ la rangée n'apparaît que si au moins
     « Écran 3 » sous un « 3 »            un écran porte un nom choisi ; les
     ne dit rien de plus                  autres laissent leur place vide
```

## Tasks to do

### `1)` Décider ce qu'est un nom

> « Écran 3 » n'est pas un nom, c'est un rang écrit en toutes lettres. C'est la seule raison pour laquelle la colonne de libellés valait la peine d'être retirée.

1. `src/lib/screens.ts` : `screenHasCustomName(screen, index)` — faux tant que le nom est celui que la création a posé.
2. La comparaison passe par la même fonction que celle qui nomme un écran à sa création : deux formules qui doivent rester d'accord n'en font qu'une.
3. Test unitaire : nom par défaut → faux, renommé → vrai, renommé *vers* le nom par défaut → faux (et c'est voulu).

### `2)` Relever la vignette, sans toucher au cadrage

> Un libellé sous une tuile de 46 tient six caractères. Ce n'est pas le libellé qu'il faut raccourcir, c'est la tuile qu'il faut relever — la largeur suit, elle est déduite.

1. Relever `THUMBNAIL_HEIGHT` (100 → 116 donne 53 de large ; 124 donne 57). Choisir sur capture, pas sur calcul.
2. **Ne jamais toucher `THUMBNAIL_WIDTH`** : elle vient d'`APP_STORE_TARGET`, c'est ce qui garantit que la vignette montre le cadrage réel.
3. Vérifier `FILMSTRIP_MAX_WIDTH` : dix tuiles plus larges plus l'ajout doivent encore tenir sous la gouttière du HUD de zoom, sinon la bande défile — ce qui est acceptable, mais doit être constaté et écrit.

### `3)` Poser le libellé

> Une rangée qui n'apparaît que quand elle a quelque chose à dire.

1. La rangée n'existe que si `screens.some(screenHasCustomName)` — sinon aucune hauteur n'est réservée.
2. Libellé tronqué sur une ligne, `text-2xs`, `text-muted-foreground`, `text-foreground` pour l'écran courant.
3. Le nom complet reste sur l'infobulle et dans le menu contextuel : la troncature ne doit jamais être le seul accès au nom.
4. `FILMSTRIP_HEIGHT` devient conditionnelle : la mesurer depuis le même booléen, jamais depuis une classe CSS.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                    |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `pnpm run test:unit` couvre les trois cas ; renommer un écran vers son nom par défaut ne fait pas apparaître la rangée.                   |
| 2    | La vignette garde le rapport de `APP_STORE_TARGET` à un pixel près, et dix tuiles ne passent pas sous le HUD de zoom.                     |
| 3    | Projet neuf : aucune rangée de libellés, la bande est à sa hauteur minimale. Un écran renommé : la rangée apparaît, la planche remonte d'autant, sans saut au rendu suivant. |
