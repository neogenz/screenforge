---
status: done
---

# Instruction: un fournisseur qu'on peut refuser

## Architecture projection

```txt
apps/bridge/                                    ✅ troisième déployable, boucle locale uniquement
├── src/protocol.ts                             ✅ contrat versionné, schémas zod, origines admises
├── src/pairing.ts                              ✅ jeton aléatoire, révocable, versionné, en mémoire
├── src/codex.ts                                ✅ client `codex app-server` (NDJSON JSON-RPC, stdio)
├── src/server.ts                               ✅ 4 routes typées : hello, models, plan, revoke
├── src/main.ts                                 ✅ écoute `127.0.0.1`, imprime le jeton une fois
├── src/bridge.test.ts                          ✅ 17 cas : pairing, origine, capacités, schémas
└── README.md                                   ✅ ce qui traverse, et le modèle de menace
apps/web/src/
├── lib/ai/providers.ts                         ✅ registre : transport, auth, modèles, capacités
├── lib/ai/bridge-client.ts                     ✅ client, jeton en mémoire, bornes au retour
├── lib/ai/run.ts                                ✏️ `planCampaign(brief, source)` — une seule entrée
├── components/campaign-dialog/CampaignDialog.tsx ✏️ section « Assistance », repliée par défaut
├── lib/__tests__/ai-provider.test.ts            ✅ 15 cas : registre, connexion, bornes, routage
└── e2e/ai-provider.spec.ts                      ✅ 1 cas de bout en bout, pont éteint
```

## Le principe, et pourquoi il tient

**Le chemin recommandé n'a besoin de personne.** La composition locale reste le
défaut, sans compte, sans clé, sans installation. L'assistance distante est une
section repliée : un utilisateur qui ouvre « Composer une campagne » veut des
planches, pas un formulaire de connexion. Un produit qui met sa dépendance
payante en première position force un choix avant d'avoir rendu un service.

**Le modèle ne pose toujours rien.** Il rend un plan, contraint par un schéma
JSON à l'aller et revalidé par zod au retour, puis à nouveau par `isCampaignPlan`
dans la page. Ce plan passe ensuite par le constructeur déterministe et les
outils bornés de la phase 6 — la seule voie d'écriture. Ajouter un fournisseur
n'a donc ajouté aucune surface d'écriture, ce qui est exactement pourquoi la
phase 6 venait avant.

**Trois champs sont repris de force au retour** : le nom de l'application, la
direction visuelle et le modèle d'appareil. L'utilisateur les a choisis dans le
formulaire ; un modèle qui les modifie n'a pas corrigé une erreur, il a ignoré
une consigne.

## Tasks to do

### `1)` Le registre dit six faits, l'interface les affiche

Un `if` aurait suffi à appeler deux fournisseurs. Ce qui ne tient pas dans un
`if`, ce sont les faits qu'une interface honnête doit énoncer sans lire le code :
transport, authentification, modèles admis, vision, outils, raisonnement — plus
une phrase sur **où passent les données**, affichée telle quelle à l'endroit du
choix, pas dans une page d'aide. Le pied de la boîte change avec le fournisseur :
« tout est composé sur votre appareil » cesserait d'être vrai le pont branché.

Le registre s'arrête à deux entrées. Une abstraction dessinée pour cinq
fournisseurs imaginaires aurait été dessinée pour aucun.

### `2)` Le pont écoute sur la boucle locale, et rien d'autre

`hostname: '127.0.0.1'`, jamais `0.0.0.0` : un pont qui écouterait sur toutes les
interfaces serait un service exposé au réseau local, jeton ou pas. C'est la
ligne qui compte le plus de tout ce fichier.

Deux barrières devant chaque route utile, et il faut les deux. L'**origine**
d'abord, parce qu'elle ne coûte rien et qu'elle est la seule qu'un attaquant ne
peut pas recopier — un jeton lu dans une capture d'écran voyage, l'origine d'une
page non. Le joker est retiré explicitement, y compris passé par
`SCREENFORGE_BRIDGE_ORIGINS`. Le **jeton** ensuite, comparé à durée constante.
Une requête sans `Origin` ne vient pas d'un navigateur (`curl`, un test) : elle
passe la première barrière faute de pouvoir être jugée, jamais la seconde.

`/hello` est la seule route ouverte, et ne dit que ce qu'une page a besoin de
savoir pour proposer l'appairage : version, présence de Codex, capacités,
version du jeton. Pas de modèles, pas de chemins, pas de nom de machine.

### `3)` Le jeton n'est écrit nulle part

Tiré au démarrage par `randomBytes(32)`, affiché une fois sur la sortie standard
du pont, gardé côté page dans l'état React de la boîte. Ni fichier de
configuration, ni `localStorage`, ni `sessionStorage`, ni cookie, ni projet, ni
Cloud, ni journal — un secret écrit quelque part est un secret qu'une sauvegarde,
une synchronisation de profil ou un rapport d'erreur finit par emporter, et
`localStorage` est de surcroît lisible par tout script chargé dans la page. Le
prix est une saisie par session ; c'est le bon prix pour une clé qui commande un
processus sur la machine de l'utilisateur.

Révocable à chaud : `POST /pair/revoke` en tire un nouveau et incrémente la
version, donc un jeton recopié ailleurs cesse de valoir à l'instant, sans
redémarrer quoi que ce soit. La version voyage dans `/hello`, donc une page
appairée avec un jeton mort peut le dire au lieu de boucler sur des 401.

### `4)` Codex garde son authentification

Le pont ne lit jamais `~/.codex`, ne copie aucun jeton, n'inspecte aucune
variable d'environnement de connexion. Il lance le binaire que l'utilisateur a
déjà installé et connecté, et lui parle en NDJSON sur stdio. Un pont qui
manipulerait ces jetons serait un voleur d'identifiants avec de bonnes
intentions — et c'est aussi pourquoi ScreenForge ne demande aucune clé d'API :
il n'y a rien à chiffrer, rien à stocker, rien à faire fuiter.

Le tour tourne dans un fil `ephemeral`, en `sandbox: 'read-only'` et
`approvalPolicy: 'never'` : ni écriture ni commande ne sont possibles, et rien ne
peut rester suspendu à attendre une approbation que le pont ne saurait donner.

### `5)` Aucune image ne traverse le pont

`briefSchema` n'a pas de champ pour une image : le nom de l'application, sa
phrase, la direction, et pour chaque écran un **libellé** plus un booléen de
présence. Zod retire ce qu'il ne connaît pas, donc un appelant qui joindrait une
capture la verrait jetée avant que quoi que ce soit n'atteigne stdin. Le test le
vérifie par la négative : le corps envoyé ne contient ni `data:`, ni
l'identifiant d'asset du logo, ni celui d'une capture.

### `6)` Un échec dit quoi faire

Le cas le plus fréquent n'est pas une erreur HTTP mais un pont éteint : `fetch`
rejette sans statut. « Échec réseau » n'apprend rien ; la commande à lancer, si.
Les autres états sont distingués parce qu'ils appellent des gestes différents —
pont absent, `codex` absent, jeton refusé, origine refusée, versions
divergentes. Aucun message ne porte de trace : ils s'affichent à l'utilisateur.

## Test acceptance criteria

| Task | Acceptance criteria                                                                       |
| ---- | ------------------------------------------------------------------------------------------ |
| 1    | Un seul fournisseur est recommandé, et c'est celui qui ne demande ni compte ni installation |
| 1    | Chaque entrée du registre déclare transport, authentification et capacités                  |
| 2    | Une page d'une autre origine est refusée en 403, jeton valide ou non                        |
| 2    | Le joker d'origine venu de l'environnement est ignoré                                       |
| 2    | Une requête sans origine reste soumise au jeton                                             |
| 3    | Deux jetons tirés diffèrent ; un jeton tronqué ou allongé est refusé                        |
| 3    | La révocation incrémente la version et tue le jeton précédent sur la réponse même           |
| 3    | Le jeton saisi n'apparaît ni dans `localStorage` ni dans `sessionStorage`                    |
| 4    | `/hello` répond sans jeton et ne divulgue ni modèles ni jeton                                |
| 4    | Les modèles ne sont lisibles qu'avec le jeton                                                |
| 5    | Le corps envoyé au pont ne contient aucune image ni identifiant d'asset                      |
| 5    | Un plan hors schéma, à l'aller comme au retour, est refusé avant toute écriture              |
| 6    | Le pont éteint produit un message nommant la commande à lancer                               |
| 6    | Le fournisseur distant choisi mais non connecté retombe sur la composition locale            |

## Ce qui n'est pas fait ici, et ce qui n'est pas prouvé

**Le tour d'inférence réel n'a pas été exercé.** `initialize`, `model/list` et
`thread/start` ont été vérifiés en direct contre le `codex app-server` installé
(codex-cli 0.147.0) ; `turn/start` et ses notifications sont construits depuis le
schéma JSON généré par ce même binaire, mais aucun tour n'a été lancé — cela
consommerait le quota Codex de l'utilisateur. C'est la seule partie de cette
phase dont la validation est structurelle et non empirique, et le dire vaut mieux
que de laisser croire l'inverse.

**Une page servie en HTTPS ne peut pas atteindre le pont.** Le navigateur refuse
une requête en clair vers `http://127.0.0.1` depuis une origine `https://`
(contenu mixte). Le pont est donc utilisable depuis un ScreenForge servi en
local ; le rendre joignable depuis un déploiement public demanderait un
certificat de confiance locale, hors de ce périmètre. C'est une raison de plus
pour que le chemin recommandé reste la composition locale, et c'est écrit dans le
`README` du pont plutôt que découvert par l'utilisateur.

**Aucun provider géré ni BYOK.** Le contrat les autorise sous condition de
stockage défendable et de modèle de menace documenté. Aucun n'est ajouté : le
seul transport livré ne demande aucune clé, ce qui est la position la plus
défendable disponible. Le jour où il en faudra une, le registre a déjà le champ
`auth` pour le dire.

**Aucune boucle d'outils conversationnelle.** Le modèle rend un plan, pas une
suite d'appels d'outils. Les schémas d'outils de la phase 6 restent la seule voie
d'écriture, et leur premier appelant distant reste à venir : un modèle qui
enchaîne vingt appels demande une boucle d'approbation que cette phase ne livre
pas, et un plan relu couvre le besoin réel.

L'a11y clavier et la densité responsive de cette section rejoignent le groupe de
la phase 10, avec celles des phases 4 à 6.

## Résultats

```
vitest run apps/bridge/src                        17 passed
vitest run src/lib/__tests__/ai-provider.test.ts  15 passed
playwright test ai-provider                        1 passed
pnpm run test:unit                                270 passed (204 web + 49 api + 17 bridge)
pnpm run typecheck                                Done (web, api, bridge)
pnpm run lint                                     clean
pnpm run build                                    built in 2.38s
pnpm run test:e2e                                 107 passed, 1 skipped + 2 prelaunch
pnpm run audit:scale                              Échelles fermées
pnpm run audit:contrast                           dark 4.78:1, light 4.55:1
```
