---
status: done
---

# Instruction: publier sans jamais tenir la clé

## Architecture projection

```txt
apps/web/src/
├── lib/asc.ts                                  ✅ langues, arborescence, manifeste, commande, preflight
├── lib/bridge-client.ts                         ✏️ déplacé hors de `ai/`, jetons par capacité, publication
├── lib/release.ts                               ✏️ `onFile` : les octets pour qui en a besoin
├── lib/hash.ts                                  ✏️ `sha256OfText` pour l'empreinte d'un lot
├── lib/project-file.ts                          ✏️ `PROJECT_FILE_VERSION` 4 → 5
├── types/index.ts                               ✏️ `Release.locale`
├── components/publish-dialog/PublishDialog.tsx  ✅ destination, preflight, ZIP, commande, pont
├── components/release-dialog/ReleaseDialog.tsx  ✏️ figer dans une langue
├── lib/__tests__/asc.test.ts                    ✅ 16 cas : langues, manifeste, commande, preflight
└── e2e/asc-publish.spec.ts                      ✅ 2 cas : ordre imposé, filigrane refusé
apps/bridge/src/
├── pairing.ts                                   ✏️ un jeton par capacité, révocables séparément
├── asc.ts                                       ✅ sonde, dossier privé, nettoyage, idempotence
├── protocol.ts                                  ✏️ protocole 2, schémas de publication
├── server.ts                                    ✏️ `POST /asc/publish`, autorisation par capacité
├── bridge.test.ts                               ✏️ 13 cas de plus : capacités, arguments, délais
└── README.md                                    ✏️ ce qui traverse pour publier, et ce qui non
```

## Le principe, et pourquoi il tient

**Le chemin sans pont est complet.** Le ZIP et la commande à coller suffisent à
publier depuis un terminal : pas de démon à lancer, pas de jeton à recopier,
rien de ScreenForge à installer. C'est la moitié qui a été livrée d'abord, et
c'est elle qui couvre le besoin réel — le pont ne fait que lancer la même
commande à la place de l'utilisateur. Une publication qui exigerait un troisième
déployable pour exister aurait fait dépendre la livraison d'Apple d'un processus
que ScreenForge maintient.

**ScreenForge ne détient aucune clé App Store.** Pas de champ pour en saisir,
pas de stockage, pas de transport, pas d'affichage. `asc` résout les siennes
dans le trousseau du système, exactement comme lorsqu'il est lancé à la main. Il
n'y a donc rien à chiffrer et rien à faire fuiter — la position la plus
défendable étant celle où le secret n'existe pas dans le produit.

**On publie une release, jamais le projet.** La boîte rend les planches depuis
l'instantané figé, recalcule leurs empreintes, les compare à celles de la
release, et n'ouvre la publication que si tout correspond. Ce qui part est donc
littéralement ce qui a été figé et relu.

## Tasks to do

### `1)` Le preflight refuse localement ce qu'Apple refuserait après coup

Quatre choses se trompent en silence : l'application, la version, la langue et
la taille d'écran. Une locale `de` au lieu de `de-DE`, une planche de 1290×2796
dans un jeu 6,9", un identifiant de localisation absent — tout cela se découvre
aujourd'hui après le téléversement, ou pire, ne se découvre pas.

La liste des langues est **fermée**, pas une expression régulière : `de` a la
bonne forme et n'existe pas côté Apple. C'est exactement l'erreur qu'un projet
localisé produit, puisque les codes de la phase 8 sont ceux de l'utilisateur et
non ceux du magasin, et la seule façon de l'attraper est de comparer à la liste.
La correspondance la plus proche est proposée, jamais appliquée d'office :
choisir `pt-PT` quand l'utilisateur visait le Brésil coûterait une campagne.

Les erreurs bloquent, les avertissements informent. Un poids de fichier
au-dessus de la cible interne n'a jamais empêché une publication qu'Apple
accepte ; une planche hors dimensions fait échouer les dix.

La seule règle qui vienne de ScreenForge et non d'Apple : **un lot filigrané ne
se publie pas**. Le découvrir sur la fiche du magasin serait tard.

### `2)` Une release sait dans quelle langue elle a été rendue

`Release.locale`, posé au figement. Sans lui, publier consiste à choisir une
fiche de destination sans que rien ne dise ce que les planches contiennent, et
téléverser un lot français dans la fiche allemande passe sans une erreur. Figer
depuis « Releases » propose donc les langues du projet, refuse de figer une
langue qui déborde encore, et la boîte de publication signale l'écart entre la
langue rendue et la fiche visée.

### `3)` Le manifeste est déterministe, ou il ne prouve rien

Clés dans l'ordre du type, planches triées par nom, aucun horodatage hors celui
de la release. Deux calculs du même lot rendent deux fichiers identiques à
l'octet près — sinon « vérifiable » est un mot.

L'empreinte du lot se calcule sur la **liste** `nom empreinte` triée, pas sur les
octets concaténés : chaque planche a déjà la sienne, et le résultat ne dépend ni
de l'ordre de rendu ni du temps de calcul.

### `4)` Deux capacités, deux jetons

Le pont fait deux choses sans rapport : parler à un modèle, et publier chez
Apple. Elles n'exigent pas la même confiance — la première ne reçoit aucune
image, la seconde reçoit tout le lot et lance un téléversement irréversible. Un
jeton unique aurait fait de l'appairage à un assistant une autorisation de
publier. Ici, refuser une capacité est un geste : on ne recopie pas son jeton, et
la révocation de l'une laisse l'autre vivante.

C'est aussi ce qui rend lisible la seule exception de tout ce périmètre : des
images traversent le pont sur cette route, parce que leur destination est Apple
et non un modèle.

### `5)` Aucune ligne de commande n'est construite

`execFile` prend un tableau d'arguments : pas de shell, donc pas d'expansion, pas
de `;`, pas de substitution. Les noms de fichiers sont validés avant écriture et
ne peuvent contenir aucun séparateur — la traversée de répertoire est impossible
par construction plutôt que rattrapée par une normalisation.

La commande affichée et la commande exécutée sortent de la même fonction. Une
commande montrée à l'utilisateur qui différerait de celle lancée serait pire
qu'aucune commande.

> Ce n'était pas vrai, et la phase 10 l'a corrigé. Deux constructeurs vivaient
> dans deux paquets — celui du navigateur ne pouvait structurellement pas
> émettre `--replace`, et la page affichait la commande figée du manifeste.
> Cocher « supprimer les captures déjà en ligne » laissait donc le bloc montrer
> une commande sans le drapeau pendant que le pont lançait celle avec. Rien ne
> les reliait à la compilation ; c'est un test qui les apparie désormais, sur
> les quatre combinaisons.

`--replace` supprime les captures déjà en ligne. Il n'est jamais dans le tableau
tant qu'une case qui le nomme n'a pas été cochée, et il est **absent**, pas
présent avec une valeur fausse : un drapeau qu'on ne peut pas lire dans la
commande affichée est un drapeau qu'on ne peut pas relire.

### `6)` Après un délai dépassé, le pont ne rejoue rien

Un téléversement qui n'a pas rendu la main a peut-être abouti : les octets sont
partis, la réponse non. Rejouer doublerait les captures chez Apple. Le pont dit
que le sort est inconnu, en 409 et non en 502 — rien n'indique un échec — et
s'arrête là. Ce résultat n'entre pas dans la mémoire d'idempotence : enregistrer
un non-résultat comme fait accompli serait pire que de ne rien enregistrer.

L'idempotence, elle, tient sur `release + destination + empreinte du lot`. Le
même lot au même endroit rend le résultat déjà obtenu. Un essai à blanc n'y
entre pas : il n'a rien publié.

### `7)` Ce qui sort du pont est relu

`asc` n'imprime pas de secret aujourd'hui. Sa sortie traverse pourtant une
requête HTTP, s'affiche dans une page et finit dans une capture d'écran de
rapport de bug. Blocs PEM, JWT, chemins `.p8`, paires `clé=valeur` suspectes et
dossier personnel sont remplacés avant de partir.

## Test acceptance criteria

| Task | Acceptance criteria                                                                    |
| ---- | --------------------------------------------------------------------------------------- |
| 1    | Une langue absente du catalogue Apple bloque, en nommant la plus proche                  |
| 1    | Une planche hors dimensions bloque ; un poids excessif avertit sans bloquer               |
| 1    | Un lot filigrané est refusé quoi qu'il contienne d'autre                                  |
| 1    | Une destination incomplète bloque avant tout rendu                                        |
| 2    | Le figement propose les langues du projet et refuse une langue qui déborde                |
| 2    | L'écart entre la langue rendue et la fiche visée est signalé                              |
| 3    | Deux calculs du même lot rendent un manifeste identique à l'octet près                    |
| 3    | L'empreinte du lot ne dépend pas de l'ordre de rendu et change dès qu'une planche change   |
| 3    | Le manifeste ne contient aucun identifiant Apple                                           |
| 4    | Le jeton d'une capacité ne vaut jamais pour l'autre                                        |
| 4    | Révoquer une capacité laisse l'autre intacte                                               |
| 5    | Chaque argument est un élément du tableau, jamais une chaîne composée                      |
| 5    | `--replace` est absent sans demande explicite, dans la commande envoyée comme affichée     |
| 5    | Un nom de fichier qui sort du dossier est refusé par le schéma                              |
| 6    | Un délai dépassé rend « sort inconnu » et ne tente qu'un seul téléversement                |
| 6    | Le même lot vers la même destination n'est pas renvoyé ; un essai à blanc ne compte pas    |
| 7    | La sortie rendue ne contient ni JWT, ni clé privée, ni identifiant d'émetteur              |
| 7    | Le dossier temporaire est supprimé, y compris quand le téléversement échoue                |
| —    | Rien ne peut être publié avant que le lot ait été rendu depuis la release et rehaché       |

## Ce qui n'est pas fait ici, et ce qui n'est pas prouvé

**Aucun téléversement réel n'a été exercé.** `asc --version`, `asc screenshots
--help`, `asc screenshots upload --help`, `asc screenshots sizes --all` et la
validation du type d'appareil ont été vérifiés en direct contre le binaire
installé (asc 0.45.4) — c'est de là que viennent `APP_IPHONE_69`, les dimensions
acceptées et les drapeaux. `screenshots upload` lui-même n'a jamais été lancé
contre App Store Connect : cela demanderait un compte Apple, une application
réelle et une clé, et publierait pour de vrai. Le pont est donc testé contre une
doublure qui ne lance aucun processus, et l'E2E contre un pont factice. C'est la
limite honnête de ce périmètre, et elle est la même que celle de la phase 7.

**Le pont ne diffuse pas sa progression.** Les étapes sont rendues à la fin, pas
au fil de l'eau : un téléversement d'une minute n'affiche rien avant son
résultat. `ponytail:` un flux SSE remplacerait une réponse JSON par un canal à
maintenir des deux côtés ; le jour où un lot mettra assez longtemps pour que ça
compte, la liste d'étapes est déjà la bonne forme de message.

**La mémoire d'idempotence est celle du processus.** Un pont redémarré republie
le même lot. La rendre durable demanderait un état sur disque que ce pont n'a
pas, et que sa promesse — rien d'écrit, rien de persistant — exclut. Le vrai
garde-fou reste `--replace` désactivé et `--dry-run` par défaut.

> Corrigé en phase 10, tâche 8 : cette phrase était vraie de la page et fausse
> du schéma. `dryRun` valait `false` par défaut — un appelant détenant le jeton
> et omettant le champ obtenait un vrai téléversement — et la clé d'idempotence
> ignorait les deux drapeaux, donc un remplacement demandé après un ajout était
> rendu par le cache et rapporté en succès. Les deux sont mesurés maintenant.

**ScreenForge ne pilote ni la soumission ni la revue.** Un téléversement accepté
n'est pas une fiche publiée. TestFlight et App Review sont hors périmètre par le
contrat, et le produit ne prétend pas les remplacer.

**Le catalogue de langues Apple est recopié.** Trente-neuf entrées figées dans
le code plutôt que lues chez Apple : la liste bouge rarement, et la lire
demanderait un appel authentifié pour valider un champ de formulaire. Si elle
dérive, le preflight refusera une langue valide — visible et corrigeable, au
contraire d'une acceptation silencieuse.

L'a11y clavier et la densité responsive de cette boîte rejoignent le groupe de
la phase 10, avec celles des phases 4 à 8.

## Résultats

```
vitest run src/lib/__tests__/asc.test.ts          16 passed
vitest run apps/bridge/src                        32 passed
playwright test e2e/asc-publish.spec.ts            2 passed
pnpm run test:unit                                319 passed (238 web + 49 api + 32 bridge)
pnpm run typecheck                                Done (web, api, bridge)
pnpm run lint                                     clean
pnpm run build                                    built in 1.34s
pnpm run test:e2e                                 110 passed, 1 skipped + 2 prelaunch
pnpm run audit:scale                              Échelles fermées
pnpm run audit:contrast                           dark 4.78:1, light 4.55:1
```
