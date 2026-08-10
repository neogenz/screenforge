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

## Ce qui n'est pas repris

Les formes du catalogue (`triangle`, `losange`, `étoile`, `éclat`, `étincelle`,
`goutte`, `arche`, `anneau`, `ligne`, `flèche`, `vague`) sont tracées pour ce
dépôt : géométrie paramétrique, aucune source tierce.

Aucun asset binaire tiers n'est redistribué. Les décisions et les preuves sont
consignées dans
`aidd_docs/tasks/2026_08/2026_08_10_campaign-lifecycle/audit-sources.md`.

Apple, App Store et iPhone sont des marques d'Apple Inc. ScreenForge est un
projet indépendant, sans affiliation ni approbation d'Apple.
