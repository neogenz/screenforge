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

## Étape 3 — le navigateur

Une seule variable, et elle est publique : c'est l'URL que le client Convex
appelle. Son absence est ce qui fait de ScreenForge une application purement
locale, et c'est un invariant testé (`e2e/boot-shell.spec.ts`).

`.env` à la racine du dépôt (`apps/web/vite.config.ts` lit `envDir` depuis la
racine) :

```
VITE_CONVEX_URL=https://<votre-déploiement>.convex.cloud
```

Pour la préproduction et la production, posez-la dans les variables
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
