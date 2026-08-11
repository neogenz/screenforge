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

| Environnement | Déploiement Convex             | Ce qui l'atteint                       |
| ------------- | ------------------------------ | -------------------------------------- |
| **local**     | `anonymous:anonymous-agent`    | `pnpm run dev:backend`, les tests       |
| **dev**       | déploiement _development_ du projet Convex | la préproduction, les tests de bout en bout |
| **prod**      | déploiement _production_ du projet Convex  | le site publié                          |

L'environnement **local** tourne déjà. Il ne demande ni compte Convex, ni
Docker, ni aucune des valeurs ci-dessous — seul le lien magique et les deux SSO
y sont hors service, ce qui est sans conséquence puisque la porte par mot de
passe suffit à ouvrir une session.

```bash
pnpm run dev:backend
```

## Étape 0 — le compte Convex (obligatoire pour dev et prod)

C'est une connexion par navigateur : personne d'autre que vous ne peut la
faire.

```bash
pnpm --filter backend exec convex login
```

Puis, une seule fois, pour créer le projet et son déploiement de développement :

```bash
pnpm --filter backend exec convex dev --configure new --project screenforge --once
```

À partir de là, `--prod` désigne la production du même projet.

## Étape 1 — les clés de signature de session

Elles sont générées, pas choisies. Une commande par déploiement, et rien à
recopier :

```bash
pnpm --filter backend exec @convex-dev/auth --skip-git-check --web-server-url https://screenforge.app
```

Elle pose `JWT_PRIVATE_KEY`, `JWKS` et `SITE_URL`. Pour la production, relancez
la même commande avec `CONVEX_DEPLOYMENT` pointant sur le déploiement de
production, ou posez `SITE_URL` à la main comme ci-dessous.

## Étape 2 — les valeurs à obtenir et à poser

Toutes les commandes se lancent depuis la racine du dépôt. Ajoutez `--prod`
juste après `env` pour viser la production.

### `SITE_URL` — l'origine du site, pas celle du déploiement

C'est le point de départ de tous les liens envoyés et la seule destination de
retour autorisée après une authentification.

```bash
pnpm --filter backend exec convex env set SITE_URL https://votre-preprod.example
pnpm --filter backend exec convex env --prod set SITE_URL https://screenforge.app
```

### `AUTH_RESEND_KEY` et `AUTH_EMAIL_FROM` — l'expéditeur du lien magique

Où : <https://resend.com/api-keys> pour la clé, <https://resend.com/domains>
pour vérifier le domaine d'envoi. Tant que le domaine n'est pas vérifié, Resend
n'accepte que `onboarding@resend.dev` et n'expédie qu'à votre propre adresse —
suffisant pour un essai, pas pour la préproduction.

```bash
pnpm --filter backend exec convex env set AUTH_RESEND_KEY re_xxxxxxxx
pnpm --filter backend exec convex env set AUTH_EMAIL_FROM "ScreenForge <bonjour@screenforge.app>"
```

### `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`

Où : <https://console.cloud.google.com/apis/credentials> → _Create credentials_
→ _OAuth client ID_ → _Web application_.

URI de redirection autorisée, une par déploiement — c'est l'URL **HTTP** du
déploiement Convex (port `.site`), pas celle du site :

```
https://<votre-déploiement>.convex.site/api/auth/callback/google
```

```bash
pnpm --filter backend exec convex env set AUTH_GOOGLE_ID xxxxx.apps.googleusercontent.com
pnpm --filter backend exec convex env set AUTH_GOOGLE_SECRET GOCSPX-xxxxxxxx
```

### `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`

Où : <https://github.com/settings/developers> → _New OAuth App_. Une
application par déploiement, GitHub n'acceptant qu'une seule URL de rappel par
application :

```
https://<votre-déploiement>.convex.site/api/auth/callback/github
```

```bash
pnpm --filter backend exec convex env set AUTH_GITHUB_ID Iv1.xxxxxxxx
pnpm --filter backend exec convex env set AUTH_GITHUB_SECRET xxxxxxxx
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
pnpm --filter backend exec convex env set POLAR_SERVER sandbox
pnpm --filter backend exec convex env set POLAR_ACCESS_TOKEN polar_oat_xxxxxxxx
pnpm --filter backend exec convex env set POLAR_WEBHOOK_SECRET whsec_xxxxxxxx
pnpm --filter backend exec convex env set POLAR_LICENCE_PRODUCT_ID xxxxxxxx
pnpm --filter backend exec convex env set POLAR_CLOUD_PRODUCT_ID xxxxxxxx
pnpm --filter backend exec convex env set POLAR_LICENCE_BENEFIT_ID xxxxxxxx
pnpm --filter backend exec convex env set CHECKOUT_SUCCESS_URL "https://votre-preprod.example/?checkout=success"
```

En production, `--prod` après `env`, `POLAR_SERVER=production`, et un jeton de
production — les identifiants de produits diffèrent aussi.

#### Le endpoint webhook

_Settings → Webhooks → Add Endpoint_. L'URL est celle du déploiement Convex sur
son hôte **HTTP** (`.site`), jamais celle du site :

```
https://<votre-déploiement>.convex.site/billing/webhook
```

Format **Raw**, et un seul événement à cocher : `customer.state_changed`. C'est
le seul que le serveur écoute, parce que Polar y sert les abonnements actifs et
les bénéfices accordés en un objet complet — création, changement, octroi et
révocation compris. Cocher `order.paid` en plus ne ferait qu'ajouter des
livraisons acquittées et ignorées.

### Vérifier que la vente a tout ce qu'il lui faut

`env.ts` mourait au démarrage quand une variable manquait ; une fonction Convex
n'a pas de démarrage. Ce contrôle est donc explicite, et se relance après chaque
`convex env set` :

```bash
pnpm --filter backend exec convex run billing:healthcheck '{}'
```

Il rend `[]` quand tout est posé, et sinon le nom de chaque variable manquante.

## Étape 3 — le navigateur

Deux variables, toutes deux publiques et toutes deux facultatives. Elles ne
disent pas la même chose et c'est pour cela qu'elles sont deux : l'une ouvre le
compte, l'autre ouvre la vente.

`.env` à la racine du dépôt (`apps/web/vite.config.ts` lit `envDir` depuis la
racine) :

```
VITE_CONVEX_URL=https://<votre-déploiement>.convex.cloud
VITE_COMMERCIAL_LAUNCH=
```

`VITE_CONVEX_URL` est l'URL que le client Convex appelle. Son absence est ce qui
fait de ScreenForge une application purement locale, et c'est un invariant testé
(`e2e/boot-shell.spec.ts`).

`VITE_COMMERCIAL_LAUNCH` ouvre les tarifs, le checkout et les paliers payants.
Vide, l'éditeur reste en avant-lancement : exports propres illimités, aucune
boîte de prix, aucune promesse d'achat qu'on ne pourrait pas honorer. N'importe
quelle valeur non vide l'ouvre. Elle est séparée depuis le démantèlement de
`apps/api` : la présence d'un déploiement ne dit plus rien de l'ouverture
commerciale, puisque le même déploiement sert les comptes gratuits.

Pour la préproduction et la production, posez-les dans les variables
d'environnement de la plateforme d'hébergement, jamais dans le dépôt.

## Vérifier

```bash
pnpm --filter backend exec convex env list
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
