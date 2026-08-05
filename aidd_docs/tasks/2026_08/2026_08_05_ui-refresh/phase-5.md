---
status: done
---

# Instruction: la scène claire remonte et les rayons s'ouvrent

> **Phase ajoutée en cours d'exécution**, à la demande explicite de l'utilisateur
> après la phase 2, et exécutée avant les phases 3 et 4. Elle reprend deux
> éléments que le plan initial avait classés « hors périmètre ». Les raisons
> écrites là-bas n'étaient pas toutes de même force : celle des rayons ne tenait
> qu'à l'échelle fermée, qui dérive d'un seul réglage amont et peut donc bouger
> sans s'ouvrir ; celle de la teinte tenait à une règle de fond, et elle tient
> toujours — c'est la clarté qui a été reprise, pas la dominante bleutée.

## Architecture projection

```txt
.
├── src/
│   ├── index.css                                   ✏️ rampe claire à deux niveaux, --radius 10 → 15px
│   └── components/screens-bar/
│       └── ScreenThumbnail.tsx                     ✏️ la vignette sort de l'échelle d'îlot
├── CLAUDE.md                                       ✏️ les deux règles réécrites
└── aidd_docs/memory/design.md                      ✏️ idem
```

## Wireframe

```txt
   avant : cinq crans                    après : deux niveaux
┌──────────────────────────┐          ┌──────────────────────────┐
│ scène 0.9 (gris franc)   │          │ scène 0.965 (presque      │
│  ┌────────────────────┐  │          │  ┌────────────────────┐  │  blanc, grain visible)
│  │ îlot 1.0           │  │          │  │ îlot 1.0           │  │
│  └────────────────────┘  │          │  └────────────────────┘  │  l'ombre sépare, pas
│  rayon d'îlot 14         │          │  rayon d'îlot 21         │  l'écart de clarté
└──────────────────────────┘          └──────────────────────────┘
```

## Tasks to do

### `1)` Repitcher le thème clair sur deux niveaux

1. `--color-stage` : 0.9 → 0.965. `--color-background` suit — il ne se voit qu'au
   rebond de défilement et sous le squelette de démarrage, et les deux ne doivent
   pas s'annoncer l'un avant l'autre.
2. **Chroma 0 conservé.** La maquette teinte tout en `slate` ; l'œil compense une
   dominante posée contre la planche, et l'utilisateur corrigerait alors dans son
   export une couleur qui n'y est pas. C'est la règle qui existe pour cet outil.
3. Ne pas toucher `card`, `popover`, `muted`, `secondary`, `accent` : la scène
   remonte au-dessus de `muted`, qui devient le fond le plus exigeant du thème —
   réécrire le commentaire qui désignait la scène comme tel.
4. Constater le pire cas de contraste avant/après.

### `2)` Ouvrir la chaîne des rayons par l'amont

1. `--radius` : 0.625rem (10px) → 0.9375rem (15px). Les multiplicateurs étant des
   cinquièmes, tout multiple de 5px sort la chaîne entière en entiers : 6/9/12/15/21.
2. Ne toucher **aucun** `rounded-*` de composant : c'est le point du réglage unique.
3. `--island-padding` suit à 9. C'est le seul nombre de l'app autorisé hors grille
   de 4 : la règle concentrique prime sur la grille, et le retrait est déduit.
4. 20px (8/12/16/20/28) a été écarté : à rayon 16, les contrôles de 32 deviennent
   des gélules pleines.

### `3)` Sortir la vignette de l'échelle d'îlot

> Le rayon d'îlot est calibré sur des surfaces larges. Une tuile de 46 n'en est pas une.

1. `rounded-xl` (21) sur une tuile large de 46 fait 46 % de la largeur : une gélule.
2. La vignette prend `rounded-md` (12), au plus près des 14 d'avant. Le champ de
   renommage suit en `rounded-b-md`.
3. Vérifier que l'échelle reste à 4 valeurs distinctes rendues.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | --------------------- |
| 1    | `pnpm run audit:contrast` passe et le pire cas clair s'améliore ; la scène reste chroma 0 ; les îlots se détachent encore à 1× dans les deux thèmes. |
| 2    | `pnpm run audit:scale` passe avec 4 rayons distincts ; aucun `rounded-*` de composant n'a été touché pour y arriver. |
| 3    | La vignette ne se lit pas comme une gélule à 1× ; l'échelle reste à 4 valeurs. |

## Résultat mesuré

- Contraste : pire cas clair **6.83:1 → 7.84:1**, sombre inchangé à 6.81:1.
- Rayons rendus : `12px ×46`, `9px ×15`, `21px ×4`, `6px ×1` — 4 valeurs, garde-fou vert.
- Commits : `5438a44`.
