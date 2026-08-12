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
pnpm --filter backend exec convex env  --env-file .env.preprod list
pnpm --filter backend exec convex run  --env-file .env.production billing:healthcheck '{}'
pnpm run deploy:preprod   # convex deploy --env-file .env.preprod
pnpm run deploy:prod      # convex deploy --env-file .env.production
```

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

Toutes les commandes se lancent depuis la racine du dépôt et visent la
préproduction ; remplacez `.env.preprod` par `.env.production` pour viser la
production.

### `SITE_URL` — l'origine du site, pas celle du déploiement — **posée**

C'est le point de départ de tous les liens envoyés et la seule destination de
retour autorisée après une authentification. L'étape 1 l'a posée sur les deux
déploiements : `http://localhost:5173` en préproduction, `https://screenforge.app`
en production. La première ligne ci-dessous est à rejouer le jour où un site de
préproduction existe — pas avant, une origine qui ne répond pas ne servirait
qu'à casser le retour d'authentification.

```bash
pnpm --filter backend exec convex env --env-file .env.preprod set SITE_URL https://votre-preprod.example
pnpm --filter backend exec convex env --env-file .env.production set SITE_URL https://screenforge.app
```

### `AUTH_RESEND_KEY` et `AUTH_EMAIL_FROM` — l'expéditeur du lien magique

Où : <https://resend.com/api-keys> pour la clé, <https://resend.com/domains>
pour vérifier le domaine d'envoi. Tant que le domaine n'est pas vérifié, Resend
n'accepte que `onboarding@resend.dev` et n'expédie qu'à votre propre adresse —
suffisant pour un essai, pas pour la préproduction.

```bash
pnpm --filter backend exec convex env --env-file .env.preprod set AUTH_RESEND_KEY re_xxxxxxxx
pnpm --filter backend exec convex env --env-file .env.preprod set AUTH_EMAIL_FROM "ScreenForge <bonjour@screenforge.app>"
```

### `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`

Où : <https://console.cloud.google.com/apis/credentials> → _Create credentials_
→ _OAuth client ID_ → _Web application_.

URI de redirection autorisée, une par déploiement — c'est l'URL **HTTP** du
déploiement Convex (port `.site`), pas celle du site :

```
https://acrobatic-orca-116.eu-west-1.convex.site/api/auth/callback/google      # préproduction
https://colorful-caterpillar-775.eu-west-1.convex.site/api/auth/callback/google # production
```

```bash
pnpm --filter backend exec convex env --env-file .env.preprod set AUTH_GOOGLE_ID xxxxx.apps.googleusercontent.com
pnpm --filter backend exec convex env --env-file .env.preprod set AUTH_GOOGLE_SECRET GOCSPX-xxxxxxxx
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
pnpm --filter backend exec convex env --env-file .env.preprod set AUTH_GITHUB_ID Iv1.xxxxxxxx
pnpm --filter backend exec convex env --env-file .env.preprod set AUTH_GITHUB_SECRET xxxxxxxx
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
| `POLAR_LICENCE_PRODUCT_ID` | _Products_ → le produit Licence (achat unique) → son `id`                     |
| `POLAR_CLOUD_PRODUCT_ID`   | _Products_ → le produit Cloud (abonnement annuel) → son `id`                  |
| `POLAR_LICENCE_BENEFIT_ID` | _Benefits_ → le bénéfice **porté par le produit Licence** → son `id`          |
| `CHECKOUT_SUCCESS_URL`     | choisie, pas lue : l'URL de retour de l'acheteur, sur votre site              |

Le bénéfice mérite son mot : un achat unique n'apparaît pas dans
`activeSubscriptions` — il n'a pas de période. Sa seule trace dans l'état client
est le bénéfice qu'il octroie. Le produit Licence doit donc en porter au moins
un, sans quoi la projection n'accordera jamais `licence`, quel que soit le
nombre d'achats.

```bash
pnpm --filter backend exec convex env --env-file .env.preprod set POLAR_SERVER sandbox
pnpm --filter backend exec convex env --env-file .env.preprod set POLAR_ACCESS_TOKEN polar_oat_xxxxxxxx
pnpm --filter backend exec convex env --env-file .env.preprod set POLAR_WEBHOOK_SECRET whsec_xxxxxxxx
pnpm --filter backend exec convex env --env-file .env.preprod set POLAR_LICENCE_PRODUCT_ID xxxxxxxx
pnpm --filter backend exec convex env --env-file .env.preprod set POLAR_CLOUD_PRODUCT_ID xxxxxxxx
pnpm --filter backend exec convex env --env-file .env.preprod set POLAR_LICENCE_BENEFIT_ID xxxxxxxx
pnpm --filter backend exec convex env --env-file .env.preprod set CHECKOUT_SUCCESS_URL "https://votre-preprod.example/?checkout=success"
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
pnpm --filter backend exec convex run --env-file .env.preprod billing:healthcheck '{}'
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

C'est l'état actuel du fichier : l'éditeur lancé ici parle au déploiement
**local**. Pour le brancher sur la préproduction ou la production, la valeur est
l'URL `.convex.cloud` du tableau des trois environnements.

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

```bash
pnpm --filter backend exec convex env --env-file .env.preprod list
```

## Le compte de test

Il se crée par la porte « mot de passe » de la dialog de connexion, sans
courriel à relever et sans tiers :

- adresse : `maxime.desogus@gmail.com`
- mot de passe : `12345678` (huit caractères, le minimum accepté par le
  fournisseur `Password`)

Le formulaire tente la connexion puis, si elle échoue, l'inscription : la
première soumission crée donc le compte, les suivantes l'ouvrent. Rien à
préparer côté serveur.

Il existe déjà sur **local** et sur **préproduction**, et porte la Licence et le
Cloud sur les deux. Ces droits ne viennent pas d'un achat — aucun compte Polar
n'est branché — mais d'une écriture directe dans le miroir, la fonction interne
qu'un webhook réel appellerait :

```bash
pnpm --filter backend exec convex run --env-file .env.preprod mirror:applyEntitlementsIfNewer \
  '{"userId":"<id du compte>","polarCustomerId":"cus_test","licenceGrantedAt":"2026-08-12T00:00:00.000Z","cloudStatus":"active","cloudPeriodEnd":"2027-08-12T00:00:00.000Z","sourceUpdatedAt":1}'
```

Le `userId` se lit sur le tableau de bord, table `users`. Rien de tout cela n'a
été fait en **production** : elle est vide, et c'est ce qu'on attend d'elle tant
que la vente n'est pas ouverte.
