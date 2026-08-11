---
status: done
---

# Instruction: tenir enchaînées les dix étapes, et dire sous quelle licence

## Architecture projection

```txt
LICENSE                                          ✅ la politique déjà annoncée, enfin écrite
README.md                                        ✏️ le badge pointe sur un fichier qui existe
THIRD-PARTY-NOTICES.md                           ✏️ les deux dépôts audités, les licences transitives
CLAUDE.md                                        ✏️ la carte du code, et quatre invariants du cycle
apps/web/src/
├── lib/stage.ts                                 ✏️ `DIALOG_STACK_MIN_WIDTH`, dérivé
├── components/ui/dialog.tsx                     ✏️ `DialogColumns` + `footerNote`
├── components/{release,publish}-dialog/          ✏️ deux colonnes qui s'empilent
└── components/{campaign,refresh,locale}-dialog/  ✏️ un pied qui passe à la ligne
apps/web/e2e/
├── dialogs-a11y.spec.ts                         ✅ 3 cas : clavier, densité, empilement
└── campaign-journey.spec.ts                     ✅ 1 cas : les dix étapes, d'affilée
```

## Le principe, et pourquoi il tient

**Un parcours n'est pas la somme de ses suites.** Chaque phase a laissé une
suite ciblée, et toutes passaient déjà. Ce que pas une ne pouvait voir, c'est
ce qui se casse quand les étapes s'enchaînent : un lot de captures qui
effacerait les cadrages posés avant lui, une langue qui contaminerait la
release, une release qui suivrait le projet, une publication qui repartirait du
projet vivant. Le parcours complet est le seul endroit d'où ces quatre-là sont
visibles, et il les vérifie sur un seul projet, dans l'ordre.

**Ce qui n'est pas mesuré n'est pas tenu.** Le validateur d'export vivait dans
`scripts/` et n'était lancé qu'à la main, c'est-à-dire jamais. Il tourne
maintenant sur le ZIP réel du parcours : numérotation continue, nombre de
planches, poids de chacune — trois choses qu'aucune assertion de dimension ne
voit.

**Une boîte qui ne déborde pas peut être illisible.** À 375px la boîte fait
343 : deux colonnes y laissaient 103px au formulaire. Rien ne sortait du cadre,
donc rien ne se plaignait. Le seuil d'empilement est dérivé de la largeur du
tiroir Propriétés, qui porte les mêmes contrôles — pas choisi.

## Tasks to do

### `1)` Les dix étapes, d'affilée, sur un seul projet

Composer, poser icône et forme, attribuer un rôle et régler un cadrage,
livrer un nouveau lot de captures, l'appliquer, retoucher un écran, créer une
langue et lever son débordement, figer une release, exporter, faire un essai à
blanc de publication. Sans souris pour ce qui peut s'en passer, sans credential
réel, avec un pont factice et des PNG produits par le test.

Quatre assertions portent le fichier, et ce sont les quatre défauts d'
enchaînement : le cadrage réglé avant la livraison est retrouvé identique
après, la retouche n'a pas touché l'autre écran, les empreintes de la release
ne bougent pas quand le projet continue, et ce qui part vers Apple porte
l'identifiant de la release figée et son nombre de planches — pas ceux d'
aujourd'hui.

### `2)` Le clavier, sur les cinq boîtes du cycle

Ouvrir avec `Entrée` depuis le bouton, vérifier que le focus entre, tabuler
vingt-cinq fois — plus que la boîte la plus fournie n'a de contrôles, donc au
moins un bouclage complet — en vérifiant à chaque pas qu'il n'est pas sorti,
fermer par `Échap`, et retrouver le focus sur le bouton d'origine.

Vingt-cinq et pas cinq : un piège cassé ne lâche pas au premier `Tab`, il lâche
au tour, quand le dernier contrôle rend la main au document.

### `3)` La densité, à la largeur d'un téléphone

À 375px, rien dans une boîte ne dépasse de sa case, la boîte tient dans la
fenêtre, et la page ne défile pas horizontalement. Deux exclusions, et ce sont
des décisions et non des exceptions : une ellipse et une case à défilement
annoncent elles-mêmes qu'elles coupent.

Deux défauts réels sont tombés là. Le pied des cinq boîtes rebâtissait la même
rangée « phrase à gauche, actions à droite » sans passer à la ligne, et la
paire de boutons sortait du cadre : il est remonté dans `Dialog` sous forme de
`footerNote`, une fois, avec `flex-wrap`. Et les deux boîtes à colonnes
gardaient leur grille quelle que soit la fenêtre : `DialogColumns` les empile
sous `DIALOG_STACK_MIN_WIDTH`, en rendant le défilement à la boîte — deux cases
à défilement empilées dans une fenêtre étroite, c'est du contenu qu'on
n'atteint plus sans deviner laquelle porte la barre.

### `4)` La licence, cohérente avec ce qu'elle annonçait

Le `README` affichait un badge « proprietary » lié à un fichier `LICENSE` qui
n'existait pas. Le fichier est écrit, avec exactement la politique déjà
déclarée : aucun droit accordé, rien d'inventé, rien d'assoupli. Le
titulaire seul peut changer cette politique ; ce qui manquait était le fichier,
pas la décision.

### `5)` La provenance, affirmée plutôt que tue

`THIRD-PARTY-NOTICES.md` nomme désormais les deux dépôts lus, leur HEAD et leur
licence MIT, et affirme qu'aucune ligne n'en a été reprise — donc qu'aucune
notice n'est due. Une absence de reprise qui n'est écrite nulle part ne se
distingue pas d'un oubli.

Les licences transitives sont relevées (`pnpm licenses list` : 339 MIT, 27 ISC,
22 Apache-2.0, 13 BSD) et les cinq cas qui méritaient un nom le portent —
`lightningcss` en MPL-2.0 côté outillage, `caniuse-lite` en CC-BY-4.0 avec son
attribution, `jszip` en double licence dont MIT est retenue, `argparse` en
Python-2.0, et `@polar-sh/sdk` dont le paquet publié omet le champ `license` là
où son dépôt annonce MIT. Aucune réciprocité forte dans un artefact livré.

### `6)` La carte du code, remise à jour

`CLAUDE.md` décrivait quatorze dossiers de composants sur vingt-cinq et une
poignée de modules `lib/`. Les treize dossiers et les quinze modules ajoutés
par ce cycle et par le socle SaaS y sont, et quatre invariants les accompagnent
— l'unique voie d'écriture, la release qui ne suit pas le projet, le défaut
local, et l'absence de tout identifiant Apple. Un agent qui lit ce fichier
avant d'éditer doit y trouver ce qui casserait le contrat.

## Test acceptance criteria

| Task | Acceptance criteria                                                                     |
| ---- | ---------------------------------------------------------------------------------------- |
| 1    | Le cadrage réglé avant une livraison est identique après elle                             |
| 1    | Une retouche d'écran ne modifie aucun autre écran                                          |
| 1    | Les empreintes d'une release ne changent pas quand le projet continue                      |
| 1    | Ce qui part vers Apple porte l'identifiant et le compte de la release figée                |
| 1    | Le ZIP exporté passe le validateur du dépôt : chemins, index continus, 1320×2868, poids    |
| 2    | Chaque boîte s'ouvre à `Entrée`, garde le focus sur un tour complet, se ferme à `Échap`   |
| 2    | Le focus revient sur le bouton d'ouverture, pas au début du document                       |
| 3    | À 375px, rien ne dépasse de sa case et la page ne défile pas horizontalement                |
| 3    | Sous le seuil, une boîte à deux colonnes n'en a plus qu'une                                |
| 4    | Le badge du README pointe sur un fichier qui existe, et la politique est inchangée         |
| 5    | Les deux dépôts audités, leur licence et l'absence de reprise sont écrits                  |
| 5    | Aucune dépendance à réciprocité forte n'entre dans un artefact livré                       |

## Ce qui n'est pas fait ici, et ce qui n'est pas prouvé

**La boîte d'export n'a pas été empilée.** Sa grille à deux colonnes précède
cette branche (`3d60681`, présent dans `feat/saas-foundations`) et sa liste est
à droite, ce que `DialogColumns` ne sait pas encore faire. Elle souffre du même
défaut de densité, elle est signalée, elle n'est pas corrigée ici : élargir le
périmètre d'une phase de durcissement à du code qu'elle n'a pas écrit est
exactement ce qui rend une PR illisible.

**Le clavier est vérifié, l'assistance d'écran ne l'est pas.** Le piège de
focus, l'ordre de tabulation, le retour du focus et les noms accessibles sont
mesurés ; ce qu'un lecteur d'écran annonce réellement en parcourant ces boîtes
ne l'est pas. Cela demanderait un harnais qui n'existe pas dans ce dépôt, et
un test qui l'affirmerait sans le mesurer serait pire que son absence.

**Le seuil d'empilement est dérivé d'un raisonnement, pas d'un panel.** Il vaut
la largeur du tiroir Propriétés plus la colonne de liste plus la gouttière,
parce que ce tiroir porte les mêmes contrôles. C'est une borne défendable, pas
une mesure d'usage.

**Le parcours ne couvre pas les deux paliers commerciaux.** Il tourne avec la
Licence posée, donc sans filigrane ; le palier gratuit a sa propre suite
(`export-tiers.spec.ts`) et le refus d'un lot filigrané la sienne
(`asc-publish.spec.ts`). Les rejouer ici aurait doublé cinq minutes de rendu
pour redire ce qui est déjà dit.

**`asc` n'a toujours pas téléversé.** Comme en phase 9 : le binaire a été sondé
en direct, la publication réelle demanderait un compte Apple et publierait
vraiment.

## Résultats

```
playwright e2e/dialogs-a11y.spec.ts               3 passed
playwright e2e/campaign-journey.spec.ts           1 passed
pnpm run test:unit                                319 passed (238 web + 49 api + 32 bridge)
pnpm run typecheck                                Done (web, api, bridge)
pnpm run lint                                     clean
pnpm run build                                    landing.html + landing-fr.html pré-rendus
pnpm run test:e2e                                 114 passed, 1 skipped + 2 prelaunch
pnpm run build:profiles                           profil commercial launch cohérent
pnpm run audit:landing                            contraste et interdits impeccable OK
pnpm run audit:scale                              Échelles fermées
pnpm run audit:contrast                           dark 4.78:1, light 4.55:1
pnpm licenses list                                339 MIT · 27 ISC · 22 Apache-2.0 · 13 BSD
```
