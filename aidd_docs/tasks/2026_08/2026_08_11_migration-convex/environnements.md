# Les trois environnements, et ce qu'un humain doit y poser

Ce document est la seule liste des valeurs que l'implémentation ne pouvait pas
créer elle-même : une clé d'API se lit sur un tableau de bord derrière un
identifiant, une application OAuth se déclare à la main, un domaine
d'expédition se vérifie par DNS. Tout le reste — le schéma, les fonctions, les
compteurs, les index — est poussé par `convex deploy` et n'attend personne.

Chaque valeur est donnée avec la commande exacte qui la pose, sur le
déploiement exact. Aucune ne porte le préfixe `VITE_` : ce préfixe est ce qui
fait entrer une valeur dans le paquet du navigateur, et une seule de ces
valeurs a le droit d'y être (`VITE_CONVEX_URL`, qui est une URL publique).

## Les trois environnements

Ils existent, et les étapes 0 et 1 sont faites. Projet Convex `screenforge`,
équipe `maxime-c8a93`, **données en Europe (Irlande)** — `aws-eu-west-1`, alias
`eu` — pour les deux déploiements du nuage.

| Environnement | Déploiement Convex             | URL                                              | Pousser le code        |
| ------------- | ------------------------------ | ------------------------------------------------ | ---------------------- |
| **local**     | `anonymous:anonymous-agent`    | `http://127.0.0.1:3210`                          | `pnpm run dev:backend` |
| **preprod**   | `dev:acrobatic-orca-116`       | `https://acrobatic-orca-116.eu-west-1.convex.cloud`   | `pnpm run deploy:preprod` |
| **prod**      | `prod:colorful-caterpillar-775`| `https://colorful-caterpillar-775.eu-west-1.convex.cloud` | `pnpm run deploy:prod` |

L'hôte HTTP d'un déploiement — celui des webhooks et des rappels OAuth — est le
même nom en `.convex.site`.

L'environnement **local** ne demande ni compte Convex, ni Docker, ni aucune des
valeurs ci-dessous : seuls le lien magique et les deux SSO y sont hors service,
ce qui est sans conséquence puisque la porte par mot de passe suffit à ouvrir
une session.

### Comment chaque commande choisit sa cible

`apps/backend/.env.local` reste sur le déploiement **local** et n'en bouge pas.
C'est délibéré, et c'est mesuré : quand il désigne la préproduction,
`pnpm run dev:backend` pousse dans le nuage sans le dire, et le travail local
écrit dans un déploiement partagé. **Une commande sans cible explicite vise donc
le local.** Toutes celles de ce document en portent une.

Deux variables commandent cela, et elles ne disent pas la même chose. C'est la
distinction à tenir, tout le reste en découle :

- **`CONVEX_DEPLOYMENT` désigne un projet**, pas une cible. La doc du CLI le dit
  pour `deploy` : « the target deployment is the production deployment of the
  project that the deployment specified by `CONVEX_DEPLOYMENT` belongs to ».
  Nommer la préproduction par cette variable et lancer `convex deploy` déploie
  donc en **production** — c'est le comportement écrit, pas un piège.
- **`CONVEX_DEPLOY_KEY` désigne un déploiement.** Le CLI le formule ainsi :
  « Creates a deploy key that, when set as `CONVEX_DEPLOY_KEY`, scopes all
  commands to the target deployment. » C'est ce qui est employé ici.

Une clé par cible, dans un fichier hors du dépôt, créée une seule fois :

```bash
pnpm --filter backend exec convex deployment token create screenforge-preprod \
  --deployment maxime-c8a93:screenforge:preprod --save-env .env.preprod
pnpm --filter backend exec convex deployment token create screenforge-prod \
  --deployment maxime-c8a93:screenforge:production --save-env .env.production
```

> Ces deux fichiers portent un **secret** : une clé de déploiement ouvre en
> écriture le déploiement qu'elle nomme. Ils sont couverts par `.env.*` dans
> `.gitignore`, ne quittent pas la machine, et se révoquent par
> `convex deployment token delete <nom>`. Ne jamais passer `--save-env` sans
> chemin : il écrirait dans `.env.local`, qui sert au déploiement local.

À partir de là, **toute** commande se borne à sa cible par `--env-file`, et rien
ne dépend plus de ce que `.env.local` désigne :

```bash
cd apps/backend                                                    # une fois
pnpm exec convex env  --env-file .env.preprod list
pnpm exec convex run  --env-file .env.production billing:healthcheck '{}'
pnpm exec convex data --env-file .env.preprod projects
```

```bash
pnpm run deploy:preprod   # depuis la racine — convex deploy --env-file .env.preprod
pnpm run deploy:prod      # depuis la racine — convex deploy --env-file .env.production
```

> **Ces commandes-là se lancent depuis `apps/backend`, et c'est la seule
> exception à la règle « toujours depuis la racine ».** Trois formes ont été
> essayées et deux échouent : `pnpm --filter backend exec convex … --env-file X`
> fait lire `--env-file` par **pnpm**, qui cherche `X` à la racine et s'arrête
> avant d'appeler Convex (`pnpm: .env.preprod: not found`) ; et sourcer le
> fichier dans l'environnement vise le déploiement **local** sans rien dire,
> parce que la CLI lit `.env.local` en plus et que son `CONVEX_DEPLOYMENT`
> l'emporte — mesuré, la table `users` rendue est celle du local. `--env-file`
> n'existant que comme option de sous-commande, aucun script racine ne peut
> l'injecter : d'où l'absence de raccourci et la présence de ce `cd`. Seul
> `deploy` en a un, parce que le script vit déjà dans le paquet.

> **Les raccourcis `--prod` et `--deployment dev` se résolvent, eux, à travers
> `.env.local`.** Ce fichier étant sur le déploiement local — qui est anonyme et
> n'appartient à aucun projet du nuage — `convex env --prod list` rend les
> variables du **local** : mesuré, les trois JWKS diffèrent. Ce n'est pas une
> anomalie du CLI, c'est ce qu'un déploiement anonyme peut répondre à une
> question qui suppose un projet. `--env-file` ne pose pas la question.

## Étape 0 — le compte Convex — **faite**

```bash
pnpm --filter backend exec convex login
```

Les deux déploiements ont été créés ainsi, la région étant choisie à la
création et non modifiable ensuite :

```bash
pnpm --filter backend exec convex project create screenforge
pnpm --filter backend exec convex deployment create maxime-c8a93:screenforge:preprod --type dev --region eu --default
pnpm --filter backend exec convex deployment create maxime-c8a93:screenforge:production --type prod --region eu --default
```

## Étape 1 — les clés de signature de session — **faite**

Elles sont générées, pas choisies, et sont déjà posées sur les deux
déploiements. Le binaire s'appelle `auth`, pas `@convex-dev/auth` :

```bash
pnpm --filter backend exec auth --skip-git-check --deployment-name acrobatic-orca-116 --web-server-url http://localhost:5173
pnpm --filter backend exec auth --skip-git-check --deployment-name colorful-caterpillar-775 --web-server-url https://screenforge.app
```

Ce binaire-là ne connaît ni `--env-file` ni la référence
`équipe:projet:déploiement` : seulement `--deployment-name`, `--prod` et
`--preview-name`. Le nom, lui, ne dépend de rien — c'est celui du tableau des
trois environnements, et c'est la forme donnée ici.

> **Ne les rejouez pas sans raison.** Les clés posées l'ont été depuis un
> `.env.local` qui désignait alors la préproduction, donc par le défaut et par
> `--prod` ; le résultat est vérifié déploiement par déploiement (`JWKS` et
> `SITE_URL` distincts sur chacun), mais les commandes ci-dessus sont la forme à
> employer désormais. Régénérer une clé de signature invalide toutes les
> sessions ouvertes sur ce déploiement.

Chacune pose `JWT_PRIVATE_KEY`, `JWKS` et `SITE_URL` sur sa cible. `SITE_URL`
vaut donc `http://localhost:5173` en préproduction : c'est ce qui la rend
utilisable depuis l'éditeur lancé sur cette machine, tant qu'aucun site de
préproduction n'est publié. Le jour où il l'est, une seule commande le corrige
(voir plus bas).

## Étape 2 — les valeurs à obtenir et à poser

Toutes les commandes se lancent depuis `apps/backend` (voir l'encadré plus haut)
et visent la préproduction ; remplacez `.env.preprod` par `.env.production` pour
viser la production.

**Rien de cette étape n'est nécessaire pour ouvrir une session et synchroniser
un projet en préproduction** : la porte par mot de passe ne dépend d'aucune de
ces valeurs, et le compte de test y porte déjà ses droits. Ce qui suit ouvre les
trois autres portes et la vente, une à une, chacune indépendamment.

> **Ce que le lien magique et les deux SSO n'achètent pas tant que
> `SITE_URL` vaut `http://localhost:5173`.** Le retour d'authentification n'a
> qu'une destination autorisée, et c'est celle-là : `safeRedirect` ramène tout le
> reste à l'origine du déploiement. Le rappel OAuth atterrit bien sur
> `…convex.site`, mais le code de session repart ensuite vers le `localhost` de
> celui qui regarde. Brancher ces trois portes ne rend donc pas la préproduction
> partageable — seule la machine qui fait tourner Vite peut finir une connexion.
> Ce qui la rendrait partageable est un site de préproduction publié, et le
> `SITE_URL` correspondant. Ni l'un ni l'autre n'existe : aucun hébergeur n'est
> choisi, et aucun fichier du dépôt n'en nomme.

> **Ce qu'aucune de ces valeurs n'est en train de bloquer.** Une variable
> d'authentification absente ne se signale nulle part : `billing:healthcheck` ne
> couvre que les six valeurs de Polar. Cliquer « Google » sans `AUTH_GOOGLE_ID`
> mène à une page d'erreur de Google, et demander un lien magique sans
> `AUTH_RESEND_KEY` envoie un `Bearer undefined` à Resend, dont le refus
> s'affiche comme un problème de mot de passe. Aucune des deux n'est un plantage
> — ce sont deux portes ouvertes sur un mur.

### `SITE_URL` — l'origine du site, pas celle du déploiement — **posée**

C'est le point de départ de tous les liens envoyés et la seule destination de
retour autorisée après une authentification. L'étape 1 l'a posée sur les deux
déploiements : `http://localhost:5173` en préproduction, `https://screenforge.app`
en production. La première ligne ci-dessous est à rejouer le jour où un site de
préproduction existe — pas avant, une origine qui ne répond pas ne servirait
qu'à casser le retour d'authentification.

```bash
pnpm exec convex env --env-file .env.preprod set SITE_URL https://votre-preprod.example
pnpm exec convex env --env-file .env.production set SITE_URL https://screenforge.app
```

### `AUTH_RESEND_KEY` et `AUTH_EMAIL_FROM` — l'expéditeur du lien magique

Où : <https://resend.com/api-keys> pour la clé, <https://resend.com/domains>
pour vérifier le domaine d'envoi. Tant que le domaine n'est pas vérifié, Resend
n'accepte que `onboarding@resend.dev` et n'expédie qu'à votre propre adresse —
suffisant pour un essai, pas pour la préproduction.

```bash
pnpm exec convex env --env-file .env.preprod set AUTH_RESEND_KEY re_xxxxxxxx
pnpm exec convex env --env-file .env.preprod set AUTH_EMAIL_FROM "ScreenForge <bonjour@screenforge.app>"
```

### `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`

Où : <https://console.cloud.google.com/apis/credentials> → _Create credentials_
→ _OAuth client ID_ → _Web application_.

Cette entrée n'est atteignable qu'après deux préalables que la console impose et
qui n'ont rien à voir avec ScreenForge : un projet Google Cloud, et un écran de
consentement OAuth configuré. Tant que l'application n'est pas publiée, seules
les adresses inscrites comme utilisateurs de test peuvent se connecter — la
vôtre en fait partie, pas celle d'un collègue.

URI de redirection autorisée, une par déploiement — c'est l'URL **HTTP** du
déploiement Convex (port `.site`), pas celle du site :

```
https://acrobatic-orca-116.eu-west-1.convex.site/api/auth/callback/google      # préproduction
https://colorful-caterpillar-775.eu-west-1.convex.site/api/auth/callback/google # production
```

```bash
pnpm exec convex env --env-file .env.preprod set AUTH_GOOGLE_ID xxxxx.apps.googleusercontent.com
pnpm exec convex env --env-file .env.preprod set AUTH_GOOGLE_SECRET GOCSPX-xxxxxxxx
```

### `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`

Où : <https://github.com/settings/developers> → _New OAuth App_. Une
application par déploiement, GitHub n'acceptant qu'une seule URL de rappel par
application :

```
https://acrobatic-orca-116.eu-west-1.convex.site/api/auth/callback/github      # préproduction
https://colorful-caterpillar-775.eu-west-1.convex.site/api/auth/callback/github # production
```

```bash
pnpm exec convex env --env-file .env.preprod set AUTH_GITHUB_ID Iv1.xxxxxxxx
pnpm exec convex env --env-file .env.preprod set AUTH_GITHUB_SECRET xxxxxxxx
```

### Polar — la vente

Six valeurs, toutes sur le même tableau de bord, et deux environnements Polar
qui ne partagent rien : le bac à sable (<https://sandbox.polar.sh>) a sa propre
base, ses propres produits et ses propres clés. Le même jeton n'ouvre pas les
deux, et `POLAR_SERVER` absent vaut `sandbox` — pour qu'une variable oubliée ne
facture personne.

| Variable                   | Où la lire                                                                   |
| -------------------------- | ---------------------------------------------------------------------------- |
| `POLAR_ACCESS_TOKEN`       | _Settings → Developers → New Token_, portée `checkouts:write`, `customer_sessions:write` |
| `POLAR_WEBHOOK_SECRET`     | affiché **une seule fois**, à la création du endpoint webhook (voir plus bas) |
| `POLAR_LICENCE_PRODUCT_ID` | _Products_ → le produit Local (achat unique à 49 $) → son `id`                |
| `POLAR_CLOUD_PRODUCT_ID`   | _Products_ → le produit Cloud autonome (abonnement annuel à 39 $) → son `id`  |
| `POLAR_LICENCE_BENEFIT_ID` | _Benefits_ → le bénéfice **porté par le produit Local** → son `id`            |
| `CHECKOUT_SUCCESS_URL`     | choisie, pas lue : l'URL de retour de l'acheteur, sur votre site              |

Le bénéfice mérite son mot : un achat unique n'apparaît pas dans
`activeSubscriptions` — il n'a pas de période. Sa seule trace dans l'état client
est le bénéfice qu'il octroie. Le produit Local doit donc en porter au moins un,
sans quoi la projection n'accordera jamais le droit perpétuel interne
`licence`, quel que soit le nombre d'achats. Le produit Cloud ne dépend pas de
ce bénéfice : un compte neuf doit pouvoir acheter et recevoir Cloud directement.

Les noms `POLAR_LICENCE_*` restent une compatibilité interne avec les
déploiements déjà configurés. Ils désignent désormais l'offre publique Local et
ne doivent pas réapparaître dans l'interface client.

```bash
pnpm exec convex env --env-file .env.preprod set POLAR_SERVER sandbox
pnpm exec convex env --env-file .env.preprod set POLAR_ACCESS_TOKEN polar_oat_xxxxxxxx
pnpm exec convex env --env-file .env.preprod set POLAR_WEBHOOK_SECRET whsec_xxxxxxxx
pnpm exec convex env --env-file .env.preprod set POLAR_LICENCE_PRODUCT_ID xxxxxxxx
pnpm exec convex env --env-file .env.preprod set POLAR_CLOUD_PRODUCT_ID xxxxxxxx
pnpm exec convex env --env-file .env.preprod set POLAR_LICENCE_BENEFIT_ID xxxxxxxx
pnpm exec convex env --env-file .env.preprod set CHECKOUT_SUCCESS_URL "https://votre-preprod.example/?checkout=success"
```

En production, `--env-file .env.production`, `POLAR_SERVER=production`, et un
jeton de production — les identifiants de produits diffèrent aussi.

#### Le endpoint webhook

_Settings → Webhooks → Add Endpoint_. L'URL est celle du déploiement Convex sur
son hôte **HTTP** (`.site`), jamais celle du site :

```
https://acrobatic-orca-116.eu-west-1.convex.site/billing/webhook      # préproduction
https://colorful-caterpillar-775.eu-west-1.convex.site/billing/webhook # production
```

Format **Raw**, et un seul événement à cocher : `customer.state_changed`. C'est
le seul que le serveur écoute, parce que Polar y sert les abonnements actifs et
les bénéfices accordés en un objet complet — création, changement, octroi et
révocation compris. Cocher `order.paid` en plus ne ferait qu'ajouter des
livraisons acquittées et ignorées.

### Vérifier que la vente a tout ce qu'il lui faut

Une fonction Convex n'a pas de démarrage où se plaindre d'une variable
manquante : rien ne s'en apercevrait avant qu'un acheteur ne clique. Ce
contrôle est donc explicite, et se relance après chaque `convex env set` :

```bash
pnpm exec convex run --env-file .env.preprod billing:healthcheck '{}'
```

Il rend `[]` quand tout est posé, et sinon le nom de chaque variable manquante.

## Étape 3 — le navigateur

Deux variables, toutes deux publiques et toutes deux facultatives. Elles ne
disent pas la même chose et c'est pour cela qu'elles sont deux : l'une ouvre le
compte, l'autre ouvre la vente.

`.env` à la racine du dépôt (`apps/web/vite.config.ts` lit `envDir` depuis la
racine) :

```
VITE_CONVEX_URL=http://127.0.0.1:3210
VITE_COMMERCIAL_LAUNCH=1
```

C'est l'état actuel du fichier, et il ne bouge pas : l'éditeur lancé par
`pnpm run dev` parle au déploiement **local**. Pour parler à la préproduction,
c'est un autre script, jamais une autre valeur dans ce fichier :

```bash
pnpm run dev:preprod
```

Il pose `VITE_CONVEX_URL` en ligne, ce qui l'emporte sur le fichier — le motif
est déjà celui de `build:profiles`. Le fichier reste donc sur le local, pour deux
raisons mesurées : le mode purement local est ce que `e2e/boot-shell.spec.ts`
vérifie, et il tombe dès que `VITE_CONVEX_URL` désigne un déploiement ; et un
fichier qu'on repointe est un fichier qu'on oublie de repointer, cette fois-ci
vers un déploiement partagé. Pour un paquet destiné à être hébergé, la variable
se pose de la même façon, à la construction :

```bash
VITE_CONVEX_URL=https://acrobatic-orca-116.eu-west-1.convex.cloud pnpm run build
```

> **Le port du serveur de développement est épinglé à 5173**
> (`apps/web/vite.config.ts`, `strictPort`), parce que `SITE_URL` le connaît par
> cœur en préproduction. Sans cela Vite glisse en silence sur 5174 quand 5173 est
> pris, et le retour d'authentification livre son code de connexion à une fenêtre
> qui n'existe pas. Vite refuse désormais de démarrer, ce qui est l'échec qu'on
> veut.

> **La session ne suit pas le déploiement, elle suit l'origine.**
> `apps/web/src/lib/session-keys.ts` fixe volontairement le nom des clés de
> stockage, indépendamment de l'hôte du déploiement. Or le local et la
> préproduction sont servis sur le même `http://localhost:5173` : en changeant de
> cible, le jeton de l'un survit et l'autre ne l'a pas signé. L'éditeur se
> présente alors déconnecté, sans un mot. **Se déconnecter avant de changer de
> cible** ; si c'est déjà fait, vider les données du site pour
> `http://localhost:5173`.

`VITE_CONVEX_URL` est l'URL que le client Convex appelle. Son absence est ce qui
fait de ScreenForge une application purement locale, et c'est un invariant testé
(`e2e/boot-shell.spec.ts`).

`VITE_COMMERCIAL_LAUNCH` ouvre les tarifs, le checkout et les paliers payants.
Vide, l'éditeur reste en avant-lancement : exports propres illimités, aucune
boîte de prix, aucune promesse d'achat qu'on ne pourrait pas honorer. N'importe
quelle valeur non vide l'ouvre. Elle est séparée de la précédente parce que le
même déploiement sert les comptes gratuits : la présence d'un déploiement ne dit
rien de l'ouverture commerciale.

Pour la préproduction et la production, posez-les dans les variables
d'environnement de la plateforme d'hébergement, jamais dans le dépôt.

## Vérifier

Depuis `apps/backend`. Les variables posées :

```bash
pnpm exec convex env --env-file .env.preprod list
```

Et ce que le navigateur prétend avoir écrit, qui ne se prouve pas dans le
navigateur : la pastille de synchronisation de la barre du haut disparaît quand
la sync est éteinte, donc « rien à signaler » et « jamais démarré » s'y
ressemblent. Les deux tables tranchent :

```bash
pnpm exec convex data --env-file .env.preprod projects   # une ligne par projet poussé
pnpm exec convex data --env-file .env.preprod assets     # une ligne par image envoyée
pnpm exec convex data --env-file .env.preprod users
pnpm exec convex data --env-file .env.preprod entitlements
```

### Où on en est, déploiement par déploiement

Mesuré le 2026-08-12, pas déduit.

| | local | préproduction | production |
| --- | --- | --- | --- |
| Code poussé | oui | oui | oui |
| `JWKS` / `JWT_PRIVATE_KEY` / `SITE_URL` | oui | oui (`http://localhost:5173`) | oui (`https://screenforge.app`) |
| Resend, Google, GitHub | non | non | non |
| Les six valeurs Polar | non | non | non |
| Fixture Password persistante | non | non | non |
| Licence + Cloud de fixture | créée à la demande, jetable | aucune | aucune |
| `projects` / `assets` | selon la suite e2e | vides | vides |

La production est vide et doit le rester tant que la vente n'est pas ouverte.

## Accès propriétaire complémentaire

Cet accès donne exactement les capacités d'un client Local + Cloud. Il ne crée
ni rôle administrateur, ni client Polar, ni abonnement fictif. Il est accordé
uniquement après une connexion réelle et vérifiée sur le déploiement ciblé.

Toujours commencer en préproduction. Depuis `apps/backend` :

1. Se connecter une fois dans ScreenForge par Google, GitHub ou lien magique.
2. Résoudre le compte par son adresse exacte, sans écrire cette adresse dans Git :

```bash
pnpm exec convex run --env-file .env.preprod --inline-query 'const email = "<OWNER_EMAIL>"; const rows = await ctx.db.query("users").collect(); return rows.filter((row) => row.email === email).map((row) => ({ _id: row._id, email: row.email }));'
```

Arrêter si le résultat ne contient pas exactement une ligne. Copier son `_id`
dans la commande suivante, sans le conserver dans un fichier versionné :

```bash
pnpm exec convex run --env-file .env.preprod mirror:setComplimentaryAccess \
  '{"userId":"<USER_ID>","local":true,"cloud":true,"note":"owner complimentary access"}'
```

Contrôler la ligne côté opérateur :

```bash
pnpm exec convex run --env-file .env.preprod --inline-query 'const userId = "<USER_ID>"; return await ctx.db.query("entitlements").withIndex("by_user", (q) => q.eq("userId", userId)).unique();'
```

Puis rafraîchir ScreenForge : le compte doit afficher Cloud, permettre un export
propre et un ZIP, synchroniser un projet avec une image et le thème, puis
retrouver les trois dans un second contexte navigateur. Supprimer ensuite le
projet distant de contrôle.

La révocation se garde juste à côté du grant et se teste en préproduction avant
toute opération en production :

```bash
pnpm exec convex run --env-file .env.preprod mirror:setComplimentaryAccess \
  '{"userId":"<USER_ID>","local":false,"cloud":false,"note":"owner complimentary access revoked"}'
```

Après ce test, réappliquer le grant de préproduction. Seulement après le
round-trip complet, répéter exactement la résolution, le grant, le contrôle UI
et le contrôle de ligne avec `.env.production`. Ne jamais réutiliser un
`userId` entre les deux cibles : une identité est propre à son déploiement.

## Les fixtures d'authentification

Le fournisseur `test-password` n'est jamais rendu dans l'interface et refuse
toute adresse qui ne finit pas exactement par `@screenforge.test`. La suite
génère une adresse et un secret uniques à chaque scénario, puis crée la fixture
à la demande. Aucun identifiant partagé ne vit dans Git ni dans un gestionnaire
d'environnement.

Le compte préproduction auparavant documenté a été supprimé le 2026-08-15, avec
ses droits et ses données. Une tentative avec l'ancien couple a ensuite été
refusée. La préproduction et la production ne portent donc aucune fixture
persistante.

Pour un scénario automatisé local, `apps/backend/tests/stack.ts` crée la session
et écrit les droits via la fonction interne qu'un webhook réel appellerait :

```bash
pnpm exec convex run --env-file .env.preprod mirror:applyEntitlementsIfNewer \
  '{"userId":"<id du compte>","polarCustomerId":"cus_test","licenceGrantedAt":"2026-08-12T00:00:00.000Z","cloudStatus":"active","cloudPeriodEnd":"2027-08-12T00:00:00.000Z","sourceUpdatedAt":1}'
```

Le `userId` vient du jeton créé par le scénario. Rien de tout cela n'est fait en
**production** : elle est vide, et c'est ce qu'on attend d'elle tant que la vente
n'est pas ouverte.

**L'ordre reste contraint : le compte d'abord, les droits ensuite.**
`applyEntitlementsIfNewer` rend
`ignored` sur un `userId` qu'elle ne connaît pas, et un `userId` n'existe qu'une
fois le compte créé sur ce déploiement-là. Créez-le donc dans le navigateur,
lisez son identifiant, puis écrivez ses droits — avec un `sourceUpdatedAt`
strictement supérieur à celui de la ligne existante s'il y en a une. Dans le
mauvais ordre, le compte s'ouvre normalement et la synchronisation reste éteinte
**sans le dire** : la pastille de la barre du haut ne s'affiche pas quand le
droit manque.

## Tester la préproduction de bout en bout

L'ordre compte. Chaque étape est là parce qu'elle échoue en silence si on la
saute.

1. **Se déconnecter dans l'éditeur** tant qu'il parle encore au local — la
   session est stockée sous un nom fixe, sur la même origine, et survivrait au
   changement de cible en faisant passer la préproduction pour déconnectée.
2. `pnpm run dev:preprod` depuis la racine, puis ouvrir `http://localhost:5173`.
   Vite refusera de démarrer si le port est pris ; c'est voulu.
3. Se connecter par Google, GitHub ou lien magique, après avoir configuré le
   fournisseur choisi dans les sections précédentes. La porte de fixture n'est
   pas une fonctionnalité de préproduction manuelle.
4. **Modifier le projet ouvert** : c'est la modification qui déclenche la
   poussée, pas la connexion. Si une boîte propose de rattacher les autres
   projets locaux, l'accepter — sans elle, un seul projet monte, ce qui ressemble
   à une synchronisation partielle.
5. **Importer une capture** dans un écran, pour envoyer un binaire.
6. **Vérifier hors du navigateur**, depuis `apps/backend` : les tables `projects`
   et `assets` doivent porter une ligne chacune.

Deux choses à savoir avant de conclure à une panne. Un projet portant plus de
dix images consomme la réserve du compteur `assetUpload` (seau de 30 par heure,
capacité 10) dès la première synchronisation : le statut passe en erreur avec un
« Réessayer », et c'est un plafond, pas un défaut. Et une modification du backend
faite sur cette branche n'est en préproduction qu'après `pnpm run deploy:preprod`
— le navigateur ne prévient pas qu'il parle à une version antérieure.

La suite Playwright `--project=cloud`, elle, n'a pas à viser la préproduction :
elle vise déjà le déploiement anonyme local sans configuration, elle y crée de
vrais comptes que rien ne supprime, et la clé d'administration qu'elle lit n'a
pas d'équivalent documenté pour un déploiement du nuage. La préproduction se
teste à la main, par la séquence ci-dessus.
