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
├── lib/stage.ts                                 ✏️ `DIALOG_STACK_MIN_WIDTH` dérivé, seuil de repli re-mesuré
├── components/ui/dialog.tsx                     ✏️ `DialogColumns` + `footerNote`
├── components/{release,publish,export}-dialog/   ✏️ deux colonnes qui s'empilent, des deux côtés
├── components/{campaign,refresh,locale}-dialog/  ✏️ un pied qui passe à la ligne
├── lib/locale.ts                                ✏️ la revue descend dans les calques partagés
├── lib/asc.ts                                   ✏️ la commande affichée porte les drapeaux
├── lib/ai/plan.ts                               ✏️ le fond d'un plan jugé sur le contrat du projet
└── lib/project-validation.ts                    ✏️ `isBackground` exporté, une seule définition
apps/bridge/src/
├── asc.ts                                       ✏️ la clé d'idempotence retient les drapeaux
└── protocol.ts                                  ✏️ `dryRun` inoffensif par défaut
apps/web/e2e/
├── dialogs-a11y.spec.ts                         ✅ 4 cas : clavier, densité, empilement × 2 sens
├── responsive-chrome.spec.ts                    ✏️ une mesure **au** seuil, pas seulement autour
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

**Un seuil est une promesse datée.** Il a été mesuré une fois contre un contenu
qui a grossi ensuite, et personne ne mesurait plus au seuil : de part et d'autre,
tout allait bien. Entre les deux, la rangée débordait de 119px et le CTA
principal se posait hors de l'écran, sur une bande de 346px de largeurs
courantes. C'est le mode de panne propre aux constantes dérivées d'une mesure :
elles vieillissent en silence, et une suite verte des deux côtés du seuil ne dit
rien de ce qui se passe dessus.

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

### `7)` La boîte d'export, au même régime

Elle a le même défaut de densité, mais son rail est à **droite** : il récapitule
ce que la colonne de gauche décide. `DialogColumns` prend donc un `railSide`
plutôt qu'un ordre imposé — inverser pour uniformiser aurait mis le
récapitulatif avant le travail, dans le DOM comme sous le curseur de
tabulation. Sa largeur de rail rejoint `DIALOG_SIDEBAR_WIDTH` au passage : deux
largeurs de rail pour un même rôle, c'est une échelle qui s'ouvre.

Sa grille précède la branche (`3d60681`), et le périmètre a été élargi sur
demande explicite.

### `8)` Ce qu'une revue indépendante a trouvé

Un agent de vérification a relu le cycle entier — le code, pas le diff — avec
mandat de chercher ce qui manque plutôt que de confirmer ce qui est là. Sept
défauts réels en sont sortis, tous corrigés ici, chacun avec le test qui
l'aurait vu :

1. **Le CTA principal hors de l'écran de 768 à 1114** (mesuré : à 900px la
   rangée réclamait 993 dans un îlot de 874, « Ouvrir l'export » posé à 1006,
   sans défilement pour le rattraper). Le seuil de repli était calé sur le
   contenu d'avant les six boutons du cycle. Re-mesuré à 1114, arrondi au palier
   standard au-dessus.
2. **La revue de langue ne descendait pas dans les calques partagés** : un texte
   « partagé partout » était semé dans la variante, listé, substitué à l'export,
   et jamais mesuré. Il pouvait déborder sur les dix planches sans bloquer ni
   l'export ni le figement — c'est-à-dire tout le contraire de ce que la phase 8
   promet.
3. **La commande affichée et la commande exécutée divergeaient** sur `--replace`,
   le seul drapeau irréversible du produit : la page montrait celle du
   manifeste, figée avant que la case existe. Les deux constructeurs vivant dans
   deux paquets qu'aucun type ne relie, c'est un test qui les tient appariés
   maintenant, sur les quatre combinaisons.
4. **La clé d'idempotence ignorait les drapeaux** : un remplacement demandé après
   un ajout était avalé par le cache et rapporté en succès, avec un
   `replaceExisting: false` dans une réponse que personne ne relit. Prudent dans
   son effet, faux dans ce qu'il disait.
5. **`dryRun` était inoffensif dans la page et pas dans le schéma** : un appelant
   détenant le jeton et omettant le champ obtenait un vrai téléversement. Le
   garde-fou annoncé n'existait que dans la case cochée.
6. **L'harmonisation désarmait le nettoyage** : elle levait le drapeau nommé
   « accepté » sans poser une seule capture, donc un run abandonné laissait ses
   fichiers importés dans le registre. Le drapeau dit maintenant ce qu'il mesure.
7. **`isCampaignPlan` ne validait pas le fond qu'il déclarait valider** : `{}`
   passait, s'affichait comme un plan valide, et n'échouait qu'au clic sur
   « Poser », sur un message qui désignait le mauvais endroit. Rien n'était
   jamais écrit — la défense en profondeur tenait, l'erreur mentait.

Deux corrections de documentation avec : l'invariant « une seule voie
d'écriture » interdisait `updateLayer`, ce que le dépôt fait partout et que le
même fichier autorise trois paragraphes plus haut ; et deux tables d'acceptation
des phases 1 et 3 citaient un plafond de version dépassé depuis, désormais
annotées plutôt que réécrites.

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
| 7    | La boîte d'export empile ses colonnes sous le seuil, rail à droite                         |
| 7    | Elle passe les mêmes épreuves de clavier et de densité que les cinq autres                  |
| 8    | À `TOP_BAR_COMPACT_WIDTH` exactement, la rangée ne déborde pas et le CTA est dans la fenêtre |
| 8    | Un calque partagé qui déborde est signalé, et sa langue est bloquée                          |
| 8    | La commande affichée est, aux quatre combinaisons de drapeaux, celle que le pont exécute    |
| 8    | Un remplacement après un ajout relance un téléversement, il n'est pas rendu par le cache    |
| 8    | Une requête de publication sans `dryRun` ne téléverse pas pour de vrai                       |
| 8    | Un run harmonisé puis abandonné rend ses captures importées au néant                        |
| 8    | Un plan dont le fond ne tient pas le contrat du projet est refusé avant l'affichage         |

## Ce qui n'est pas fait ici, et ce qui n'est pas prouvé

**Le téléversement réel du pont reste testé contre une doublure.** La clé
d'idempotence et le défaut `dryRun` sont mesurés sur un `asc` factice qui
enregistre son `argv`. Ce que le vrai binaire fait de `--replace` n'a pas été
exercé, et ne le sera pas sans un compte Apple.

**Le seuil de repli est mesuré sur un état de la barre, pas sur tous.** 1114 a
été relevé avec les deux entrées commerciales présentes et le palier « Gratuit »
affiché, ce qui est le cas le plus large que la rangée sait produire aujourd'hui.
Une entrée de plus le périmerait à nouveau, exactement comme la première fois —
la seule protection réelle est la mesure au seuil, pas la constante.

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
playwright e2e/dialogs-a11y.spec.ts               4 passed
playwright e2e/campaign-journey.spec.ts           1 passed
playwright e2e/responsive-chrome.spec.ts          3 passed
pnpm run test:unit                                324 passed (241 web + 49 api + 34 bridge)
pnpm run typecheck                                Done (web, api, bridge)
pnpm run lint                                     clean
pnpm run build                                    landing.html + landing-fr.html pré-rendus
pnpm run test:e2e                                 115 passed, 1 skipped + 2 prelaunch
pnpm run build:profiles                           profil commercial launch cohérent
pnpm run audit:landing                            contraste et interdits impeccable OK
pnpm run audit:scale                              Échelles fermées
pnpm run audit:contrast                           dark 4.78:1, light 4.55:1
pnpm licenses list                                339 MIT · 27 ISC · 22 Apache-2.0 · 13 BSD
```

Mesures reprises à la main dans le navigateur, avant et après le seuil corrigé,
avec le projet ouvert et les deux entrées commerciales présentes :

```
avant  900px   rangée 993 dans un îlot de 874 · Exporter à 1006 · aucun défilement
après  900px   repliée · débordement 0 · Exporter dans la fenêtre
après  1280px  déployée · débordement 0 · colonnes 252 / 293 / 675
```
