---
objective: "ScreenForge reprend les partis pris visuels de la maquette qui tiennent — grain de scène, numéro dans la vignette, vignette qui se nomme, insertion visible — sans changer une seule fonction, sans jeton hors contrat shadcn et sans ouvrir les échelles fermées."
status: implemented
---

# Plan: reprise UI de la maquette « app-screen-preview-redesign »

## Overview

| Field      | Value                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| **Goal**   | Quatre reprises visuelles isolées, chacune livrable seule, aucune refonte structurelle ni fonctionnelle |
| **Source** | Maquette React locale `~/Downloads/app-screen-preview-redesign` + capture annotée fournie le 2026-08-05 |

## Phases

| #   | Phase                                    | File                         |
| --- | ---------------------------------------- | ---------------------------- |
| 1   | La scène prend un grain                  | [`phase-1.md`](./phase-1.md) |
| 2   | Le numéro rentre dans la vignette        | [`phase-2.md`](./phase-2.md) |
| 5   | La scène claire remonte et les rayons s'ouvrent | [`phase-5.md`](./phase-5.md) |
| 3   | La vignette dit ce qu'elle montre        | [`phase-3.md`](./phase-3.md) |
| 4   | L'insertion se voit pendant le glissement | [`phase-4.md`](./phase-4.md) |

La phase 5 a été ajoutée après coup et exécutée à sa place dans ce tableau, entre
la 2 et la 3 : l'utilisateur a demandé, capture de la maquette à l'appui, de
reprendre sa clarté de fond et ses arrondis, tous deux classés hors périmètre au
départ. Les numéros de fichier n'ont pas été renumérotés — l'ordre d'exécution
est celui de cette table, pas celui des noms.

## Resources

| Source                                              | Verified                                                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `app-screen-preview-redesign/src/index.css`         | La maquette n'a **aucun jeton** : 40 lignes, une police et une animation. Toute sa couleur est en classes Tailwind brutes (`slate-*`, `lime-400`). Rien n'est importable tel quel, tout est à traduire. |
| `app-screen-preview-redesign/src/components/Canvas.tsx`     | Valeurs exactes des points : `radial-gradient(circle at 1px 1px, rgba(15,23,42,0.09) 1px, transparent 0)`, pas de `22px`.                    |
| `app-screen-preview-redesign/src/components/DockStrip.tsx`  | Le numéro est **dans** la vignette (`absolute top-1 left-1`), sur `bg-slate-900/45` + `backdrop-blur`, citron quand actif. Le libellé est optionnel et tronqué. |
| `app-screen-preview-redesign/src/hooks/useReorder.ts`       | Leur réordonnancement ne décale pas la rangée : il pousse les marges et dessine une barre d'insertion, donc le `drop` reste sur la tuile.     |

## Decisions

| Decision                                                                                          | Why                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Le numéro passe **dans** la vignette et la rangée de puces disparaît                              | Une puce posée sur la scène doit contraster avec deux thèmes et avec un aperçu presque toujours clair ; posée sur l'aperçu, elle n'a plus qu'une surface à contraster. Elle rend aussi les 26px de colonne que la rangée coûtait au canevas. Cela remplace le travail livré en `3884394`. |
| La scène reste **achromatique**, points compris                                                   | La maquette teinte tout en `slate` (bleuté). Un outil de jugement colorimétrique ne peut pas teinter ce qui borde la planche : l'œil compense, et l'utilisateur corrige une dominante qui n'existe pas dans son export.                                                                    |
| Aucun plateau, aucun verre dépoli sous la pellicule                                               | La carte de la maquette ne tient que parce que sa scène est texturée et teintée. La nôtre ne le sera qu'à moitié (points, mais neutre), et le plateau avait été retiré sur mesures : trois clartés voisines, 26px de canevas pour encadrer du vide.                                        |
| Le rayon 26 et l'ombre `0 18px 50px -12px` de la maquette ne sont pas repris tels quels           | Ils court-circuiteraient `--shadow-md/lg/xl`. **Révisé en phase 5** : l'argument « ils ouvriraient l'échelle » était faux pour le rayon — la chaîne dérive d'un seul réglage amont, qu'on peut déplacer sans ouvrir quoi que ce soit. `--radius` est passé de 10 à 15px (6/9/12/15/21). L'ombre, elle, n'a pas bougé. |
| Rien de ce qui relève de l'UX de la maquette n'entre dans ce plan                                 | Planche multi-écrans, sélecteur de disposition, écrans masqués, curseur de taille, panneau de notes : ce sont des fonctions, pas une peau. La demande est explicitement une note UI.                                                                                                       |

## Hors périmètre, et pourquoi

| Élément de la maquette                          | Écarté parce que                                                                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Dominante bleutée de la scène `slate-50`         | Contredit « chroma 0 sur toute surface de chrome » — la règle existe pour cet outil précisément, et elle a tenu. **Sa clarté, en revanche, a été reprise en phase 5** : la ligne d'origine confondait les deux, alors que seule la seconde touchait à une règle. |
| Pastille citron sur la bascule « Libellés »      | Le citron ne dit jamais « action » : il dit « vous êtes ici ». Un jeton qui marque deux choses n'en marque plus aucune.                        |
| Libellés capitales espacées (`ÉCRANS`, `NOTE…`)  | « No all-caps labels » est une règle écrite du projet ; les capitales espacées se lisent 15 à 20 % moins vite en libellé court.                |
| Plateau en verre dépoli sous la pellicule        | Voir Decisions.                                                                                                                                |
| Pastille d'actions flottante à trois boutons     | Nos actions d'écran sont huit, pas trois. Le menu contextuel les tient toutes ; trois boutons imposeraient d'en cacher cinq.                    |
| Emplacement d'ajout en tirets                    | « Ajouter un écran » est une action, pas un emplacement vide ; le bouton rond a été choisi sur cet argument et rien ici ne le contredit.        |
| Planche multi-écrans, modes de disposition, masquage d'écran, curseur de taille | Fonctions. Hors d'une note UI, et chacune touche `use-canvas.ts`, `stage.ts` et l'export.                                              |
