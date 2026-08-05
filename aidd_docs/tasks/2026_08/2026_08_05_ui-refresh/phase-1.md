---
status: done
---

# Instruction: la scène prend un grain

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── src/
│   ├── index.css                       ✏️ jeton --color-stage-dot, utilitaire .stage-grain qui porte son pas
│   └── components/canvas/
│       └── CanvasEditor.tsx            ✏️ la scène porte .stage-grain
├── scripts/
│   └── contrast-audit.mjs              ✏️ le point n'est pas une encre : exclu de la matrice, documenté comme tel
└── aidd_docs/memory/design.md          ✏️ la scène n'est plus un aplat
```

## Wireframe

```txt
┌──────────────────────────────────────────────────────────────┐
│  · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·   │
│  · · · · · · · ┌────────────────────────┐ · · · · · · · · ·   │  points : 1px, pas de 22px
│  · · · · · · · │                        │ · · · · · · · · ·   │  achromatiques, opacité ~0.09
│  · · · · · · · │        PLANCHE         │ · · · · · · · · ·   │  clair / ~0.06 sombre
│  · · · · · · · │      1320 × 2868       │ · · · · · · · · ·   │
│  · · · · · · · │                        │ · · · · · · · · ·   │  la planche garde son ombre :
│  · · · · · · · └────────────────────────┘ · · · · · · · · ·   │  c'est elle qui doit flotter,
│  · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·   │  pas la scène qui doit vibrer
└──────────────────────────────────────────────────────────────┘
```

## Tasks to do

### `1)` Déclarer l'encre du point

> Un point de grille n'est pas une encre de texte : il a son propre jeton, et il ne passe pas la matrice de contraste.

1. Ajouter `--color-stage-dot` dans `@theme static` : sombre `oklch(1 0 0 / 0.055)`, clair `oklch(0 0 0 / 0.09)`. Le point s'éclaircit sur fond sombre et s'assombrit sur fond clair — la maquette n'en donne que la version claire.
2. Le pas de 22px vit dans l'utilitaire, pas dans `@theme` : il est lu à un seul endroit et ne change pas selon le thème, donc en faire un jeton n'aurait généré que des utilitaires Tailwind inutiles. La valeur vient de la maquette ; elle n'appartient à aucune échelle fermée (ni rayon, ni écart, ni hauteur de contrôle) et n'a donc pas à tomber sur 4.
3. Chroma 0 obligatoire : c'est la surface qui borde la planche.

### `2)` Poser le grain

> Un seul utilitaire, sur un seul élément.

1. `@utility stage-grain` dans `src/index.css` : `background-image: radial-gradient(circle at 1px 1px, var(--color-stage-dot) 1px, transparent 0); background-size: var(--stage-dot-size) var(--stage-dot-size);`
2. L'appliquer sur l'élément qui porte déjà `bg-stage`, jamais sur un enfant : le grain doit défiler avec la scène, pas avec le contenu.
3. Vérifier que le canevas Fabric couvre bien le grain là où il peint — le grain est derrière, pas dedans.

### `3)` Épaissir le caractère des ombres, sans toucher l'échelle

> La maquette paraît plus chère surtout par ses ombres : très floues, très décalées vers le bas, très transparentes. C'est un réglage de jetons, pas une couche de plus.

1. Comparer `--shadow-md/lg/xl` actuels à `0 18px 50px -12px oklch(0 0 0 / 0.35)`. **Résultat : rien à changer.** La maquette n'a qu'une couche, les nôtres en ont trois, et `--shadow-md` porte déjà `0 24px 48px -24px / 55%` en couche basse. Ce n'est pas son ombre qui la rendait plus riche, c'est sa scène texturée.
2. N'ajuster que le flou et le décalage vertical des trois jetons existants. **Aucun quatrième niveau.**
3. Recapturer `probe:visual` avant/après et ne garder l'ajustement que s'il se voit à 1× — sinon, le laisser tel quel et l'écrire dans le rapport.

### `4)` Fermer la porte au garde-fou

> Un jeton translucide qui entre dans la matrice ink × surface la fait échouer pour de mauvaises raisons.

1. `scripts/contrast-audit.mjs` : ne pas ajouter `stage-dot` à `INKS` ni à `SURFACES`.
2. Écrire en commentaire pourquoi : un motif décoratif ne porte aucune information, et son alpha le rend illisible par construction pour un calcul WCAG.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                             |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `--color-stage-dot` existe dans les deux thèmes, chroma 0, et `pnpm run audit:contrast` passe sans l'avoir croisé.                                |
| 2    | La scène montre une grille de points dans les deux thèmes ; la planche et son ombre restent lisibles par-dessus ; le grain ne bouge pas au zoom du canevas. |
| 3    | `pnpm run audit:scale` passe (aucun rayon, écart ni hauteur nouveau) et la capture 1× montre une différence, ou le rapport dit que rien n'a bougé. |
| 4    | `pnpm run audit:contrast` passe et le commentaire du script explique l'exclusion.                                                                 |
