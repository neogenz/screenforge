---
objective: 'Les écarts coss restants sont fermés : la surface flottante compose `Card` au lieu de la recopier, les cinq `group-hover` passent en `in-*` + `data-slot`, et les deux exemptions muettes deviennent une décision écrite.'
status: in-progress
---

# Plan: Fermer les écarts coss restants

## Overview

| Field      | Value                                                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Ne plus rien avoir qui contredise coss dans `apps/web`, ou l'avoir écrit comme une décision plutôt que laissé comme un silence |
| **Source** | Relevé de conformité du 2026-08-23, après la PR #28 : trois écarts subsistent, dont un seul touche le rendu de tout le chrome  |

## Phases

| #   | Phase                                           | File                         |
| --- | ----------------------------------------------- | ---------------------------- |
| 1   | La surface flottante compose `Card`             | [`phase-1.md`](./phase-1.md) |
| 2   | `group-hover` devient `in-*`, ce que coss écrit | [`phase-2.md`](./phase-2.md) |
| 3   | Les exemptions muettes de l'audit               | [`phase-3.md`](./phase-3.md) |

## Resources

| Source                                                       | Verified                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://coss.com/ui/r/p-card-1.json`                        | La particule ne passe à `Card` que de la mise en page (`w-full max-w-xs`) : aucune classe de coque n'y est répétée. C'est la forme attendue — habiller `Card`, pas le recopier.                                                                                    |
| `https://coss.com/ui/r/p-card-4.json`                        | Même lecture avec `CardFrame` : le cadre ne reçoit que la largeur, `Card` imbriqué ne reçoit rien. Confirme qu'un consommateur n'a jamais à réécrire `rounded-2xl border bg-card`.                                                                                 |
| `.claude/skills/coss/references/rules/styling.md`            | L. 23 : « Prefer data-slot-aware selectors and `in-*` patterns over `group` where available. » Le bloc `Do`/`Don't` (l. 73 vs 81) met `group-hover` du côté `Don't`. La liste de contrôle finale demande : « Any use of `group` that should be replaced with `in-*` + `data-slot`? » |
| `.claude/skills/coss/references/primitives/card.md`          | `Card` est la primitive de surface ; son anatomie est `Card` + `CardHeader`/`CardPanel`/`CardFooter`. Rien de tel qu'un `Island` n'existe côté coss : la composition attendue est un `Card` habillé, pas un jumeau.                                                 |

## Decisions

| Decision                                                                                          | Why                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Island` compose `Card` plutôt que de recopier ses classes                                        | C'est le seul écart de composition mesuré : `CLAUDE.md` affirme qu'il « wraps coss's own `Card` anatomy » alors qu'il n'importe pas `Card`. Recopier une coque, c'est en figer la version : le liseré `before:` et le `bg-clip-padding` que coss porte ne sont jamais arrivés jusqu'au chrome, et le prochain `shadcn add` ne les y portera pas davantage. |
| La direction de flex redevient explicite sur chaque île                                           | `Card` pose `flex flex-col`, et `flex-direction` n'est pas le même groupe de conflit que `display` : une île qui écrit `flex items-center` sans direction bascule en colonne. Mesuré sur `ZoomHud` et `SelectionToolbar`. Compter sur l'absence de `flex` dans la coque était un accident qui marchait.                        |
| `bg-popover` reste écrit à la main sur l'île, alors que `--popover` et `--card` ont la même valeur | Les deux jetons sont identiques au caractère près dans les deux thèmes (`index.css:146/156` et `174/184`), donc l'écrire ne peint rien de différent aujourd'hui. Mais une île est une surface flottante, et c'est le jeton que coss emploie pour ses propres popups : l'égalité actuelle est une coïncidence, pas un contrat.  |
| Le bouton natif de la tuile n'est pas remplacé par un `Button` coss, il est justifié dans l'audit  | La tuile n'est pas un bouton habillé : elle porte un `draggable`, un menu contextuel, un double-clic de renommage et ses propres `aria-pressed`/`aria-current`. L'envelopper reviendrait à neutraliser sa variante classe par classe. Le défaut n'est pas l'exemption, c'est qu'elle ne dit pas pourquoi et qu'un renommage la ferait fondre en silence. |
