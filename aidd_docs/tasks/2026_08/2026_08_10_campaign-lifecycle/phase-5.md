---
status: done
---

# Instruction: une livraison est un fait daté, pas une vue du projet

## Architecture projection

```txt
apps/web/src/
├── lib/
│   ├── hash.ts                              ✅ `sha256Hex` / `sha256OfBlob` partagés
│   ├── release.ts                           ✅ instantané, rendu du lot, figement, vérification, diff
│   ├── project-file.ts                      ✏️ empreinte prise dans `hash.ts` · format v3
│   ├── project-validation.ts                ✏️ `releases` validées · plafonds
│   ├── asset-refs.ts                        ✏️ les instantanés figés retiennent leurs assets
│   ├── storage.ts                           ✏️ import : les instantanés suivent la remise d'identifiants
│   └── commands.ts                          ✏️ « Releases… » dans ⌘K
├── components/
│   ├── release-dialog/ReleaseDialog.tsx     ✅ figer, vérifier, comparer, retirer
│   └── toolbar/TopBar.tsx                   ✏️ action secondaire (se replie avec les autres)
├── types/index.ts                           ✏️ `ProjectSnapshot`, `ReleaseFile`, `Release`
├── stores/ui.store.ts                       ✏️ `showReleaseDialog` dans la liste des modales
└── App.tsx                                  ✏️ boîte chargée à la demande
apps/web/
├── src/lib/__tests__/release.test.ts        ✅ 14 cas : instantané, figement, plafond, diff
└── e2e/release.spec.ts                      ✅ 2 cas de bout en bout
```

## Ce que le dépôt savait déjà faire

`exportScreenToBlob` était déjà déterministe — fast-png, zlib niveau 3, aucun
horodatage — et c'est cette propriété, vérifiée octet à octet depuis la phase
d'export, qui rend une release vérifiable sans stocker un seul pixel.
`runEditorTransaction` (phase 1) porte l'écriture, `collectAssetIds`
(`asset-refs.ts`) est déjà l'unique recensement d'assets, `EXPORT_DIMENSIONS`
donne les cibles. La phase n'ajoute qu'un module de domaine et une boîte.

## Tasks to do

### `1)` Une release ne contient aucun pixel

Le manifeste porte le chemin, les dimensions, la taille et l'empreinte SHA-256
de chaque planche ; l'instantané qui les a produites est cloné à côté. Dix PNG
par release auraient pesé des dizaines de mégaoctets dans IndexedDB pour redire
ce que le projet dit déjà — et le contrat demande de **régénérer les exports**,
donc c'est l'entrée qu'il faut figer, pas la sortie.

L'aperçu d'écran (`thumbnail`) reste dehors : c'est un cache de rendu qui change
à chaque coup de pinceau. Gardé, il aurait fait diverger deux figements du même
contenu et rempli le diff de bruit.

`watermarked` est figé avec le lot : le filigrane de l'offre gratuite change les
empreintes, donc la vérification doit rejouer le rendu tel qu'il a été fait, pas
tel que les droits du jour le feraient.

### `2)` Vérifier, c'est rejouer l'instantané — jamais le projet

`verifyRelease` rend l'instantané figé et recompare les empreintes. Une planche
modifiée depuis ne peut donc pas faire échouer la vérification : ce qu'elle
attrape est ce qui a changé **sous** le projet — une police qui ne se charge
plus, un cadre d'appareil remplacé, un moteur de rendu qui a bougé.

### `3)` Le diff est déterministe ou il ne sert à rien

Les écrans du projet d'abord dans leur ordre, les disparus ensuite dans leur
ordre d'origine ; même règle pour les calques ; comparaison indifférente à
l'ordre des clés ; propriétés modifiées triées. Un ensemble parcouru au hasard
rendrait deux fois le même diff dans deux ordres, et personne ne relit ça.

### `4)` Un lot figé retient ses assets

`collectAssetIds` descend maintenant dans `releases[].snapshot`. Sans cela, la
capture remplacée à la release suivante devenait orpheline au chargement
suivant, et le lot figé se serait vérifié contre une image absente. Le même
recensement sert quatre chemins (balayage au chargement, archive portable, sync
cloud, transaction) : la correction est à un seul endroit.

L'import d'archive remet des identifiants neufs sur les écrans et les calques ;
les instantanés figés suivent la même table de correspondance, sinon un projet
importé aurait porté des releases pointant vers des identifiants disparus.

### `5)` Durable avant d'être annoncée

Le figement force l'écriture locale (`saveCurrentProject`) avant son toast, au
lieu d'attendre les deux secondes de l'autosave. Une release perdue par un
rechargement n'est pas une modification perdue : c'est le fait daté sur lequel
tout le reste s'appuie, et l'utilisateur vient d'attendre son rendu.

Le format de fichier passe en **v3** : une archive écrite par cette version
porte des releases, et une version antérieure ne saurait pas les relire.

## Test acceptance criteria

| Task | Acceptance criteria                                                                   |
| ---- | ------------------------------------------------------------------------------------- |
| 1    | L'instantané ne porte que `name`, `screens`, `layoutLayers`, `globals` — jamais l'aperçu |
| 1    | Écrire dans le projet après le figement ne traverse pas jusqu'à l'instantané            |
| 1    | Une release entre et sort du projet en un seul pas d'annulation                         |
| 1    | Au-delà de 20 releases, le figement renonce sans rien écrire                            |
| 1    | Une empreinte qui n'est pas un SHA-256 fait rejeter le projet par la validation         |
| 2    | Un lot figé se rejoue à l'identique, et encore après modification du projet             |
| 3    | Deux appels sur les mêmes entrées rendent exactement le même diff                       |
| 3    | Réordonner les clés d'un calque ne produit aucun changement                             |
| 3    | Écrans, calques, fond, globaux et nom de projet sont comptés une fois chacun            |
| 4    | Un asset que seul un instantané figé cite encore reste recensé                          |
| 5    | Un lot figé survit au rechargement de la page et se retire à la demande                 |

## Deux corrections faites en écrivant les tests

**La mesure e2e attendait un statut déjà affiché.** Le test rechargeait la page
dès que « Enregistré » était visible — or il l'était encore, depuis la
sauvegarde précédente, le temps que React rende le passage à l'état modifié. Le
rechargement tombait donc dans la fenêtre de l'autosave. C'est ce qui a fait
remonter le vrai défaut : un lot figé n'était durable qu'au bout de deux
secondes (task 5). Le test attend maintenant le toast, qui suit l'écriture.

**Le nudge au clavier ne prouvait pas ce qu'il visait.** Le clic sur le canevas
à des coordonnées fixes ne garantissait pas la sélection ; l'édition passe par
le champ « Position X » du panneau de propriétés, qui est le chemin réel.

## Ce qui n'est pas fait ici

L'arborescence d'export d'une release et le manifeste `{ rôle: fichier }`
attendent la phase 9, qui produit les noms de fichiers. La densité responsive et
l'a11y clavier des nouvelles boîtes sont groupées en phase 10, avec celles des
phases 4 et 6 à 9.

## Résultats

```
vitest run src/lib/__tests__/release.test.ts   14 passed
pnpm run test:unit                             221 passed (172 web + 49 api)
pnpm run typecheck                             Done
pnpm run lint                                  clean
pnpm run build                                 built in 4.37s
playwright test release                        2 passed
pnpm run test:e2e                              104 passed, 1 skipped + 2 prelaunch
pnpm run audit:scale                           Échelles fermées
pnpm run audit:contrast                        dark 4.78:1, light 4.55:1
```
