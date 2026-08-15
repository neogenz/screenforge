---
objective: "Remplacer l’offre Gratuit/Licence/Cloud par deux offres commerciales Local et Cloud, synchroniser dans Convex toutes les données durables prévues, provisionner un compte propriétaire avec tous les droits client et durcir le déploiement Cloud avec des contrôles officiellement documentés."
status: in-progress
---

# Plan: offres Local et Cloud avec compte propriétaire

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Faire de Local l’achat perpétuel sans serveur et de Cloud l’abonnement autonome qui inclut les droits Local, le compte et la synchronisation Convex des projets, assets et préférences sûres, avec une mise en production mesurée et récupérable. |
| **Source** | Demandes utilisateur et note de sécurité fournies le 2026-08-15, vérifiées contre le dépôt et les documentations officielles. |
| **Baseline** | L’application est déjà local-first; Convex porte l’authentification, le miroir Polar, les projets et leurs assets. Le travail complète et simplifie cette fondation sans réécrire la sync. |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Transformer les droits et la facturation en offres Local et Cloud autonomes | [`phase-1.md`](./phase-1.md) |
| 2 | Garantir la sauvegarde Cloud complète des projets, assets et préférences durables | [`phase-2.md`](./phase-2.md) |
| 3 | Aligner l’éditeur, le compte et la landing sur les deux offres | [`phase-3.md`](./phase-3.md) |
| 4 | Ajouter puis provisionner un accès propriétaire complet et révocable | [`phase-4.md`](./phase-4.md) |
| 5 | Durcir le déploiement et l’exploitation avant production | [`phase-5.md`](./phase-5.md) |
| 6 | Prouver la migration et boucler jusqu’à une review approuvée | [`phase-6.md`](./phase-6.md) |

## Execution ownership

Le lancement est conduit de bout en bout par l’agent, avec un arrêt uniquement
aux frontières où une identité, un engagement financier ou un secret humain est
requis. Une application connectée ne garantit pas qu’elle soit pilotable dans
la session courante : l’exécution commence par un contrôle de capacité en
lecture seule, puis utilise le connecteur, le navigateur authentifié ou la CLI
la plus étroite disponible. Aucun secret n’est demandé dans le chat ni copié
dans le dépôt.

| Workstream | Agent executes | User checkpoint |
| --- | --- | --- |
| Code, migrations et qualité | Implémenter les six phases, corriger les causes racines, lancer tests ciblés puis `pnpm run test:release`, assert, review et browser QA jusqu’au vert. | Trancher seulement une décision produit nouvelle qui changerait le périmètre ou les prix arrêtés dans ce plan. |
| Convex | Configurer préproduction puis production, poser les variables directement sur chaque déploiement, déployer, contrôler isolation, limites, sauvegarde et restauration hors production. | Se reconnecter ou valider MFA/OTP si la session Convex l’exige; approuver explicitement le cutover production. |
| Vercel et domaine web | Créer/importer le projet, régler build/output, variables publiques, alias préprod, domaine production, protection Preview, headers et audits HTTP réels. | Posséder le domaine, autoriser sa liaison et intervenir uniquement pour connexion, MFA/OTP ou validation demandée par le registrar. |
| Resend et DNS mail | Déclarer le sous-domaine d’envoi, fournir les enregistrements SPF/DKIM/DMARC, créer une clé limitée à l’envoi, la poser dans Convex et tester le lien magique. | Autoriser les changements DNS et accomplir connexion/MFA/OTP; ne jamais transmettre la clé dans le chat. |
| Polar | Configurer sandbox puis production : produit Local, produit Cloud, bénéfice Local, jeton minimal, endpoint signé, portail et test checkout/webhook. | Confirmer nom légal, devise, prix et politique de remboursement; compléter KYC, banque et compte de versement; confirmer avant activation de paiements réels. |
| Compte propriétaire | Déployer le grant interne révocable, l’appliquer après contrôle de l’identité et prouver export, ZIP et sync sans privilège administrateur. | Se connecter une fois avec son identité réelle et confirmer le compte cible; aucun mot de passe n’est partagé ni codé en dur. |
| Mise en ligne | Déployer préprod, fermer chaque preuve, déployer production, refaire les smoke tests et revenir à la version précédente si un gate échoue. | Donner le go/no-go final avant de rendre `VITE_COMMERCIAL_LAUNCH` public et d’accepter les premières ventes. |

### Environment contract

| Runtime | Variables attendues | Rule |
| --- | --- | --- |
| Vercel Preview/Production | `VITE_CONVEX_URL`, `VITE_COMMERCIAL_LAUNCH` | Publiques par nature; `VITE_COMMERCIAL_LAUNCH` reste vide jusqu’au go-live commercial. |
| Convex Auth | `SITE_URL`, `AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM`; `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` si les SSO sont activés | Valeurs distinctes par déploiement; secrets saisis directement dans Convex. |
| Convex / Polar | `POLAR_SERVER`, `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_LICENCE_PRODUCT_ID`, `POLAR_CLOUD_PRODUCT_ID`, `POLAR_LICENCE_BENEFIT_ID`, `CHECKOUT_SUCCESS_URL` | Les noms `POLAR_LICENCE_*` restent une compatibilité interne et désignent publiquement Local; sandbox et production ne partagent aucun identifiant. |
| Convex security | `CORS_ALLOWED_ORIGINS` après la phase 5 | Origines HTTPS exactes par environnement, sans joker; CORS ne remplace jamais l’autorisation serveur. |

### Mandatory launch checkpoints

1. Préproduction stable et protégée avant toute configuration production.
2. Checkout Polar sandbox, webhook signé, grant puis révocation prouvés avant le
   premier checkout réel.
3. SPF/DKIM vérifiés et lien magique reçu avant d’afficher cette méthode de
   connexion en production.
4. Sauvegarde Convex incluant File Storage restaurée hors production avant le
   cutover.
5. `pnpm run test:release`, audit des headers, assert, review et browser QA sans
   finding ouvert avant le go-live.
6. Activation commerciale en dernier; rollback immédiat par désactivation de
   `VITE_COMMERCIAL_LAUNCH` si paiement, entitlement ou sync échoue après mise en
   ligne.

## Decisions

| Decision | Why |
| --- | --- |
| Il n’existe que deux offres vendues : **Local à 49 $ une fois** et **Cloud à 39 $/an**. L’essai gratuit reste un état avant achat, pas une troisième carte tarifaire. | La demande retire le troisième plan sans supprimer l’essai qui permet de juger l’éditeur avant paiement. Les montants existants sont conservés; tout changement de prix ultérieur devra être décidé puis répercuté chez Polar et dans les surfaces publiques. |
| Cloud est achetable seul et donne, tant qu’il est actif, export propre, ZIP et sync; un achat Local séparé reste perpétuel après la fin de Cloud. | Cloud devient un vrai plan autonome, tout en préservant la valeur et les droits déjà acquis par les clients Local historiques. |
| Les champs persistés `licenceGrantedAt` restent en place et sont présentés comme **Local**; aucune migration de renommage n’est faite. | Le nom interne historique n’est pas visible par le client. Le conserver évite une migration Convex sans bénéfice fonctionnel et permet de distinguer un achat Local perpétuel d’un droit Local inclus temporairement par Cloud. |
| « Tout dans Convex » couvre le document projet complet, chaque asset source référencé, le compte et une allowlist de préférences durables; les miniatures dérivées, jetons, clés API, compteurs d’essai, zoom et état des dialogues restent locaux. | Les caches reconstructibles, secrets et états éphémères ne doivent pas devenir des données cloud. Les globals, locales et releases sont déjà contenus dans le document projet. |
| Les lectures et suppressions cloud restent possibles après expiration; seules les écritures et nouvelles synchronisations exigent Cloud actif. | Un abonnement expiré ne doit jamais prendre les données de l’utilisateur en otage. |
| Le compte propriétaire reçoit une dérogation interne, idempotente et révocable, fusionnée avec les droits Polar; elle ne donne aucun pouvoir d’administration backend. | Un faux achat Polar, une date en 2099 ou un e-mail codé en dur seraient difficiles à révoquer et pourraient être écrasés. Une mutation interne minimale donne exactement les droits client demandés sans porte publique. |
| Le déploiement web cible Vercel seulement après confirmation de sa Root Directory et d’un domaine de préproduction stable; aucune règle de sécurité ne dépend d’une URL Preview aléatoire ou d’un joker de sous-domaines. | Le dépôt ne contient aujourd’hui ni configuration Vercel ni site de préproduction déclaré. Une origine stable rend les politiques CSP et CORS exactes, testables et plus petites. |
| La CSP est d’abord observée sur Preview avec `Content-Security-Policy-Report-Only`, puis bloquante après élimination des violations; `script-src` reste sans `unsafe-inline` ni `unsafe-eval`, tandis que `style-src 'unsafe-inline'` est conservé tant que Fabric/React et le boot CSS l’exigent. | MDN recommande de tester une nouvelle politique en Report-Only. Le dépôt contient du JavaScript HTML inline déplaçable, mais aussi des styles inline nécessaires au positionnement; supprimer les deux en une fois agrandirait le changement sans gain prouvé. |
| HSTS n’est pas redéclaré dans `vercel.json`; sa présence est assertée sur les réponses déployées. | Vercel envoie déjà HSTS par défaut. Le dupliquer crée deux sources de vérité sans renforcer la protection. |
| Les HTTP actions Convex conservent l’authentification Bearer et ajoutent une allowlist CORS d’origines exactes avec `Vary: Origin`; CORS reste une défense navigateur, jamais une autorisation métier. | Les endpoints Convex sont publics par conception et l’autorisation serveur reste obligatoire. L’allowlist remplace le joker actuel sans prétendre arrêter un client non navigateur. |
| Vercel ne reçoit que les variables `VITE_*` publiques; secrets Auth/Resend/Polar restent séparés par déploiement dans Convex et ne sont jamais copiés dans les bundles, logs ou commandes versionnées. | Vite expose toutes les variables `VITE_*` au code client, alors que Convex fournit des variables de déploiement destinées aux secrets. |
| Les preuves externes sont des relevés manuels datés ou des assertions HTTP réelles, pas des tests simulés dans le dépôt. Les fonctions payantes — sauvegardes périodiques ou streaming de logs Convex, Spend Management Vercel — sont activées seulement si l’offre souscrite les rend disponibles. | La protection Preview, la MFA, DNS, les sauvegardes et les seuils de dépense vivent dans les consoles fournisseurs. Un test local ne peut pas prouver leur état et certaines fonctions dépendent du plan. |

## Resources

| Official source | What it settles for this plan |
| --- | --- |
| [Convex — Authentication](https://docs.convex.dev/auth/overview) | Toute fonction publique doit refaire authentification et autorisation; CORS ne remplace pas ce contrôle. |
| [Convex — File Storage](https://docs.convex.dev/file-storage/overview) et [HTTP Actions](https://docs.convex.dev/functions/http-actions) | Les URLs de stockage sont porteuses d’accès; les téléchargements privés restent derrière une HTTP action authentifiée, avec CORS explicite. |
| [Convex — Environment Variables](https://docs.convex.dev/production/environment-variables) | Les secrets sont séparés par déploiement et déclarés dans `convex.config.ts`. |
| [Convex — Backup & Restore](https://docs.convex.dev/database/backup-restore) | Une sauvegarde peut inclure les fichiers; une restauration est destructive et doit être répétée hors production. Le code et les variables d’environnement sont sauvegardés séparément. |
| [Convex — Logs](https://docs.convex.dev/production/integrations/) et [Usage Limits](https://docs.convex.dev/production/usage-limits) | Les logs Dashboard sont le socle; export/streaming et alertes externes restent conditionnels au plan, tandis que les limites d’usage sont configurées par déploiement. |
| [Vercel — Production checklist](https://vercel.com/docs/production-checklist) et [Deployment Protection](https://vercel.com/docs/deployment-protection) | Headers, protection des déploiements, accès d’équipe et dépenses font partie du contrôle de lancement; les Previews peuvent être protégées sans fermer le domaine de production. |
| [Vercel — Response headers](https://vercel.com/docs/headers/response-headers) et [`vercel.json`](https://vercel.com/docs/project-configuration/vercel-json) | HSTS est déjà envoyé par Vercel; les autres headers peuvent être déclarés dans la configuration projet. |
| [MDN — CSP deployment](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/CSP), [`frame-ancestors`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors) et [`nosniff`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options) | Déployer la CSP en Report-Only avant blocage; empêcher l’embarquement et le sniffing de type avec des directives dédiées. |
| [Vite — Env Variables](https://vite.dev/guide/env-and-mode) | Une variable préfixée `VITE_` est publique; aucun secret n’y est admis. |
| [Resend — Domains](https://resend.com/docs/dashboard/domains/introduction), [API keys](https://resend.com/docs/api-reference/api-keys/create-api-key) et [MFA](https://resend.com/changelog/multi-factor-authentication) | Utiliser un sous-domaine d’envoi avec SPF/DKIM, démarrer DMARC en observation, limiter la clé à l’envoi et protéger l’administration par MFA. |
| [GitHub — Dependabot](https://docs.github.com/en/code-security/tutorials/secure-your-dependencies/dependabot-quickstart) et [2FA recovery](https://docs.github.com/en/authentication/securing-your-account-with-two-factor-authentication-2fa/configuring-two-factor-authentication-recovery-methods) | Activer alertes/mises à jour de sécurité et conserver plusieurs méthodes de récupération administrateur. |
