---
status: done
---

# Instruction: le modèle décide, le dépôt écrit

## Architecture projection

```txt
apps/web/src/
├── lib/ai/
│   ├── tools.ts                              ✅ schémas stricts, bornes, allowlist, exécuteur
│   ├── plan.ts                               ✅ brief, directions, plan, plan → appels d'outils
│   ├── state.ts                               ✅ ce qu'un modèle a le droit de voir
│   └── run.ts                                 ✅ run accepté = une transaction ; abandonné = néant
├── lib/
│   ├── assets.ts                              ✏️ `forgetAssets` (un run abandonné ne laisse rien)
│   ├── layer-factories.ts                     ✏️ `createDeviceLayer` annoncé `DeviceFrameLayer`
│   └── commands.ts                            ✏️ « Composer une campagne… » dans ⌘K
├── components/
│   ├── campaign-dialog/CampaignDialog.tsx     ✅ brief, plan relu, pose, retouche d'un écran
│   └── toolbar/TopBar.tsx                     ✏️ action secondaire
├── stores/ui.store.ts                         ✏️ `showCampaignDialog` dans la liste des modales
└── App.tsx                                    ✏️ boîte chargée à la demande
apps/web/
├── src/lib/__tests__/ai-builder.test.ts       ✅ 17 cas : schémas, bornes, portée, run, fuite
└── e2e/ai-campaign.spec.ts                    ✅ 2 cas de bout en bout
```

## Le principe, et pourquoi il tient

**Un modèle ne touche jamais le projet. Il propose des appels d'outils.** Chaque
outil appelle les mêmes fabriques que les boutons de la barre — `createTextLayer`,
`createDeviceLayer`, `createShapeLayer` — donc ce qui sort d'une génération est
fait de calques ScreenForge ordinaires : sélectionnables, éditables au clavier,
exportables, indiscernables de ce que la main aurait posé. Il n'y a aucune voie
par laquelle une image aplatie ou du JSON Fabric arbitraire pourrait entrer, non
parce que c'est interdit, mais parce qu'aucun outil ne l'accepte.

Trois barrières, dans cet ordre :

1. **Le schéma** — objets stricts (`additionalProperties: false`), énumérations
   fermées sur les catalogues réels (formes, icônes, modèles d'appareil,
   polices), bornes numériques. Les mêmes schémas partent dans la requête d'un
   fournisseur et sont revalidés à l'arrivée : un schéma envoyé n'est pas un
   schéma respecté.
2. **L'allowlist par type de calque** — `content` sur une forme ou `iconId` sur
   un texte produirait un calque que la validation accepte et que le moteur de
   rendu ignore : mort à l'export, sans erreur nulle part. `id`, `zIndex`,
   `locked` et les identifiants d'assets n'y sont jamais.
3. **La transaction** — le lot entier s'applique sur un clone, `isProject` le
   juge, et il devient une seule référence de projet et un seul pas
   d'annulation. Vingt calques posés se défont d'un ⌘Z ; sans cela, revenir en
   arrière demanderait vingt annulations, ce qui revient à ne pas pouvoir.

## Tasks to do

### `1)` Ce qui sort du projet est aussi borné que ce qui y entre

`describeProject` / `describeScreen` rendent du JSON plat : géométrie arrondie,
noms, rôles, et pour une capture un simple booléen. **Jamais une data URL, jamais
un identifiant d'asset, jamais un objet Fabric.** Une capture d'application pèse
des mégaoctets en base64 et appartient à l'utilisateur ; l'envoyer à un tiers
serait une fuite que personne n'a décidée. Le test l'assure par la négative :
la sérialisation ne contient ni `data:image` ni l'identifiant de l'asset.

### `2)` Le plan est relu avant que quoi que ce soit ne soit posé

Une génération qui écrit directement demande à l'utilisateur de juger dix écrans
déjà là ; un plan tient en une page, se corrige, se refuse, et ne coûte rien à
jeter. Le plan est aussi la seule forme que les deux moitiés du produit
partagent : la composition locale et un fournisseur distant rendent le même
objet, et `isCampaignPlan` le valide dans les deux cas — y compris quand il vient
d'ici, parce que demain il viendra d'ailleurs et que la boîte ne le saura pas.

### `3)` La composition locale est la voie par défaut, pas un bouchon de test

`planFromBrief` compose sans modèle : une planche par capture, la direction
visuelle choisie, un rôle normalisé par capture, l'accroche tirée du libellé ou
du pitch. Hors ligne, gratuite, déterministe — donc utilisable tout de suite, et
c'est elle que les tests exercent. `planCampaign` est asynchrone alors qu'elle
répond immédiatement : c'est la couture où un fournisseur distant se branche en
phase 7, sans que la boîte ait à réapprendre à attendre.

Les quatre directions posent des hex littéraux et non des jetons de thème :
elles partent sur la planche exportée, et une planche ne change pas de couleur
parce que l'utilisateur a basculé son éditeur en clair.

### `4)` Une édition ciblée ne sort pas de son écran

`ToolContext.screenId` refuse `add_screen`, refuse un `screenId` divergent, et
refuse tout calque qui n'appartient pas à l'écran visé — vérifié pour chaque
outil qui nomme un calque, pas seulement à l'entrée. La retouche livrée
(« Harmoniser cet écran ») ne crée ni ne supprime rien : elle repeint le fond,
l'encre des textes et la teinte des formes de l'écran courant.

### `5)` Un run abandonné ne laisse rien

Les captures sont enregistrées dès l'import, parce que le plan a besoin de leurs
dimensions pour cadrer. Si l'utilisateur referme sans accepter, `discardAiAssets`
les rend au néant. Le balayage général (`sweepAssets`) n'aurait pas convenu : il
n'est correct qu'au chargement, quand la pile d'annulation vient d'être vidée.
`forgetAssets` ne touche donc que les identifiants nommés par l'appelant, et
`keepIds` protège le cas où la déduplication lui a rendu l'identifiant d'un asset
déjà posé.

Un asset ne peut pas non plus être posé s'il ne vient pas de ce run :
`place_screenshot_asset` et `add_image` exigent que l'identifiant figure dans la
liste des imports de l'utilisateur, sans quoi un modèle pourrait déplacer
n'importe quelle image du registre dans n'importe quel écran.

## Test acceptance criteria

| Task | Acceptance criteria                                                                    |
| ---- | --------------------------------------------------------------------------------------- |
| 1    | La vue rendue au modèle ne contient ni data URL ni identifiant d'asset                    |
| 2    | Un plan dont la direction ou les écrans sont invalides est rejeté avant toute écriture    |
| 2    | Le plan reste visible sans qu'aucun écran ne soit ajouté tant qu'il n'est pas accepté     |
| 3    | Une campagne composée produit un texte et un appareil éditables, avec rôle et fond posés  |
| 3    | Tous les appels produits par le plan passent la validation de schéma                      |
| 4    | Une édition ciblée refuse `add_screen`, un autre écran et un calque étranger              |
| 4    | L'harmonisation ne change ni le fond ni les textes des autres écrans                      |
| 5    | Un run refusé laisse le projet à la référence exacte d'avant, et l'historique vide        |
| 5    | Un run accepté vaut un seul pas d'annulation                                              |
| 5    | Une capture importée puis abandonnée disparaît du registre ; une capture posée y reste    |

> Tenu pour la fermeture directe, pas pour l'harmonisation : elle levait le
> drapeau nommé « accepté » sans poser une seule capture, donc un run
> harmonisé puis fermé laissait ses fichiers importés dans le registre.
> Corrigé en phase 10, tâche 8 — le drapeau s'appelle désormais `placed` et
> dit ce qu'il mesure.

## Ce qui n'est pas fait ici

**Aucun fournisseur distant.** Le registre de providers, le bridge Codex sur
`127.0.0.1`, le pairing et les capacités sont la phase 7 — c'est là que les
schémas d'outils publiés ici trouvent leur premier appelant. La phase 6 livre la
moitié qui doit exister d'abord : sans exécuteur borné, brancher un modèle
reviendrait à lui donner les stores.

**Aucune boucle d'outils conversationnelle.** Le modèle rendra un plan, puis des
appels d'outils ; les lectures (`get_project_state`, `get_screen`) ont leur
schéma et leur implémentation, mais rien ne les appelle encore — elles servent la
boucle de la phase 7. L'exécuteur les refuse explicitement : il écrit, il ne lit
pas.

La densité responsive et l'a11y clavier de cette boîte sont groupées en phase 10,
avec celles des phases 4, 5 et 7 à 9.

## Résultats

```
vitest run src/lib/__tests__/ai-builder.test.ts   17 passed
pnpm run test:unit                                238 passed (189 web + 49 api)
pnpm run typecheck                                Done
pnpm run lint                                     clean
pnpm run build                                    built in 3.33s
playwright test ai-campaign                       2 passed
pnpm run test:e2e                                 106 passed, 1 skipped + 2 prelaunch
pnpm run audit:scale                              Échelles fermées
pnpm run audit:contrast                           dark 4.78:1, light 4.55:1
```
