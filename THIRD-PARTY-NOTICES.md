# Third-party notices

Ce fichier liste les œuvres tierces dont ScreenForge redistribue des extraits
dans son propre code source, et les notices que leurs licences exigent de
conserver. Les dépendances installées (`package.json`) ne sont pas listées ici :
elles restent chez leur éditeur, avec leur licence, et ne sont pas recopiées.

## Lucide — tracés d'icônes

- Paquet : `lucide-react`
- Version lue : 1.7.0
- Licence : ISC
- Usage : le catalogue `apps/web/src/lib/vector-catalog.ts` recopie le `d` d'un
  sous-ensemble de 36 icônes, converti en un tracé unique par icône. Le paquet
  reste par ailleurs une dépendance normale pour les icônes de l'interface.
- Pourquoi une recopie plutôt qu'un import : un projet ScreenForge persiste un
  identifiant de catalogue, et le rendu Fabric a besoin du tracé, pas d'un
  composant React. Faire dépendre le modèle sérialisé d'un composant aurait lié
  le format de fichier à une bibliothèque d'interface.

```
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

### Feather, pour huit de ces icônes

Lucide déclare une partie de son jeu comme dérivée du projet Feather, sous
licence MIT. Dans le sous-ensemble repris ici, les icônes concernées sont :
`calendar`, `check`, `clock`, `download`, `key`, `lock`, `search`, `target`.

```
The MIT License (MIT)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Les deux dépôts audités — aucune ligne reprise

Deux projets ont été lus pendant la conception du cycle de vie de campagne.
Aucun code n'en a été copié ni adapté, donc leur licence n'impose ici aucune
notice ; l'entrée existe pour que l'absence de reprise soit une affirmation
vérifiable et non un silence.

| Dépôt                                   | HEAD lu                                    | Licence |
| --------------------------------------- | ------------------------------------------ | ------- |
| realZachi/shotluma                      | `4ff3397b46ccea087234506fede32b66e9a7050c` | MIT     |
| dotnetdreamer/open-screenshot-generator | `a25360ba2deb13a1a7eeea01681f7f55ca013fc6` | MIT     |

Ce qui en vient est de l'ordre de l'idée — un rôle porté par un écran, un lot
de captures remplacé en une opération, un manifeste d'export — jamais du
fichier. Le relevé ligne à ligne est dans
`aidd_docs/tasks/2026_08/2026_08_10_campaign-lifecycle/audit-sources.md`.

Aucun de leurs assets n'est repris : ni overlays ni mockups de Shotluma, ni
photos Adobe Stock d'Open Screenshot Generator, ni Product Bezels Apple
redistribués. Les cadres d'appareil de ScreenForge sont tracés pour ce dépôt.

## Ce qui n'est pas repris

Les formes du catalogue (`triangle`, `losange`, `étoile`, `éclat`, `étincelle`,
`goutte`, `arche`, `anneau`, `ligne`, `flèche`, `vague`) sont tracées pour ce
dépôt : géométrie paramétrique, aucune source tierce.

Aucun asset binaire tiers n'est redistribué.

## Licences transitives

Relevé au 2026-08-11 par `pnpm licenses list` sur l'arbre complet : 339 MIT,
27 ISC, 22 Apache-2.0, 13 BSD, et quelques cas qui méritent d'être nommés
plutôt que noyés dans un total.

| Paquet                     | Licence                    | Ce qu'elle implique ici                                                                                                                                                          |
| -------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lightningcss` (+ binaire) | MPL-2.0                    | Outil de compilation CSS, jamais redistribué. Le copyleft porte sur ses propres fichiers, qui ne sont pas modifiés.                                                              |
| `caniuse-lite`             | CC-BY-4.0                  | Données de compatibilité, consommées à la compilation. Attribution : Alexis Deveria et contributeurs.                                                                            |
| `jszip`                    | MIT ou GPL-3.0-or-later    | Double licence : ScreenForge retient MIT.                                                                                                                                        |
| `argparse`                 | Python-2.0                 | Permissive, transitive, hors du paquet livré au navigateur.                                                                                                                      |
| `@polar-sh/sdk`            | MIT annoncée, champ absent | Le paquet publié ne déclare pas `license` et ne joint pas de fichier ; le dépôt amont et son README annoncent MIT. Utilisé côté serveur (`apps/api`), jamais dans le navigateur. |

Aucune dépendance sous licence à réciprocité forte (GPL, AGPL) n'entre dans un
artefact livré.

Apple, App Store et iPhone sont des marques d'Apple Inc. ScreenForge est un
projet indépendant, sans affiliation ni approbation d'Apple.
