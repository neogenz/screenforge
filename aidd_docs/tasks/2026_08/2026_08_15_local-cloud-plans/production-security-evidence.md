# Preuve de sécurité avant lancement

> **Archive de baseline — remplacée le 2026-08-16.** Ce relevé prouve seulement
> l’état local de l’ancien modèle et ne peut autoriser ni production ni
> publication. La nouvelle preuve, nécessairement expurgée, est définie par
> [`phase-5.md`](./phase-5.md) et [`phase-6.md`](./phase-6.md).

| Champ | Valeur |
| --- | --- |
| Date | 2026-08-15 |
| Contrôleur | Codex, session locale autorisée par le propriétaire |
| Commit de départ | `46188ed` |
| Environnements | build local ; inventaire Vercel authentifié ; aucun déploiement ScreenForge publié dans cette passe |
| Verdict production | **bloqué** — les contrôles externes listés plus bas n'ont pas de preuve réelle |

Les statuts utilisés sont fermés : `verified-local`, `blocked-external`,
`enabled`, `unavailable-on-current-plan` ou `not-applicable`. Une absence de
preuve n'est jamais convertie en succès.

## Contrôles

| Contrôle | Environnement | Commande ou écran consulté | Résultat nettoyé | Statut | Référence officielle |
| --- | --- | --- | --- | --- | --- |
| Gate de release | local + Convex local réel | `pnpm run test:release` | 530 unitaires, 168 E2E release, 2 E2E prelaunch ; 1 fixture Apple externe absente et explicitement skippée ; audits contraste/échelle/landing réussis | `verified-local` | `aidd_docs/memory/coding-assertions.md` |
| Candidate CSP Report-Only et hashes JSON-LD | profils prelaunch + launch | `pnpm run build:profiles` | deux builds, les deux JSON-LD de chaque langue et l'éditeur acceptés ; aucun handler inline | `verified-local` | [Vercel headers](https://vercel.com/docs/headers/security-headers) |
| Headers HTTP réels et HSTS | Preview + production | `pnpm run audit:security-headers -- <URL_HTTPS>` | aucune URL ScreenForge déployée ; audit réel impossible | `blocked-external` | [HSTS Vercel](https://vercel.com/docs/headers/security-headers#strict-transport-security) |
| Projet et alias Vercel | équipe Vercel authentifiée | inventaire projets par connecteur le 2026-08-15 | aucun projet ScreenForge trouvé ; publication refusée tant que la cible Preview/Production n'est pas explicitement choisie | `blocked-external` | [déploiement CLI Vercel](https://vercel.com/docs/projects/deploy-from-cli) |
| Protection Preview | Preview | Settings → Deployment Protection puis navigation privée | aucun projet/Preview sur lequel l'activer ou la tester | `blocked-external` | [Deployment Protection](https://vercel.com/docs/deployment-protection) |
| CORS exact | Convex local simulé | `pnpm --filter backend run test:unit` | 127 tests ; origine admise reflétée, hostile/`null`/config invalide refusés, sans Origin admis, aucun `*` | `verified-local` | [variables Convex par déploiement](https://docs.convex.dev/production/environment-variables) |
| CORS déployé | Convex préprod + prod | `convex env set CORS_ALLOWED_ORIGINS …` puis preflight réel | clés `.env.preprod` et `.env.production` absentes de ce worktree ; alias préprod inconnu | `blocked-external` | [variables Convex par déploiement](https://docs.convex.dev/production/environment-variables) |
| Auth et isolation cross-account | Convex local simulé | tests `assets`, `projects`, `accountDeletion`, `authorization` | Bearer, propriétaire, suppression et stockage croisé restent couverts | `verified-local` | [authorization Convex](https://docs.convex.dev/auth/functions-auth) |
| Absence de secrets dans le bundle | build launch | recherche des noms privés dans `apps/web/dist` | aucun nom JWT, Resend, Polar ou deploy key trouvé | `verified-local` | [variables Vercel](https://vercel.com/docs/environment-variables) |
| SPF, DKIM et DMARC | `auth.screenforge.app` | Resend Domains + DNS du registrar | aucune console DNS/Resend inspectée ; aucun envoi réel | `blocked-external` | [domaines Resend](https://resend.com/docs/dashboard/domains/introduction) |
| Clé Resend `sending_access` | préprod + prod | Resend API Keys puis présence seule dans Convex | clé et portée non vérifiées ; aucune valeur lue ou copiée | `blocked-external` | [permissions des clés Resend](https://resend.com/docs/dashboard/api-keys/introduction) |
| MFA et récupération | GitHub + Vercel + Resend | pages sécurité de chaque compte | contrôle d'identité non effectué par l'agent ; aucun code de récupération consulté | `blocked-external` | [2FA GitHub](https://docs.github.com/authentication/securing-your-account-with-two-factor-authentication-2fa) |
| Dependabot workspace + Actions | dépôt local | `.github/dependabot.yml` + `pnpm run lint` | configuration hebdomadaire valide localement ; alerts/security updates GitHub non inspectés | `verified-local` | [configuration Dependabot](https://docs.github.com/code-security/dependabot/working-with-dependabot/dependabot-options-reference) |
| Limites et alertes de dépense | Convex + Vercel | dashboards Usage/Billing | plan et seuils non inspectés ; aucune disponibilité supposée | `blocked-external` | [limites Convex](https://docs.convex.dev/production/state/limits) |
| Sauvegarde avec File Storage | Convex préprod + prod | Dashboard → Backups | aucune sauvegarde créée dans cette passe | `blocked-external` | [Backup & Restore Convex](https://docs.convex.dev/database/backup-restore) |
| Restore drill hors production | cible jetable | restore puis contrôle comptes/projets/assets/settings | aucune cible jetable ni archive attestée | `blocked-external` | [restore Convex](https://docs.convex.dev/database/backup-restore#restoring-a-backup) |
| Compte propriétaire Local + Cloud | préprod puis prod | connexion réelle, résolution unique, grant et révocation | fonction interne et tests locaux prêts ; identité réelle jamais fabriquée | `blocked-external` | [fonctions internes Convex](https://docs.convex.dev/functions/internal-functions) |

## Verrous de production

1. Créer explicitement une **Preview** ScreenForge Vercel, lui poser les deux
   variables publiques, activer Standard Protection et obtenir son alias stable.
2. Poser l'alias exact dans `SITE_URL` et `CORS_ALLOWED_ORIGINS` de préproduction,
   déployer le backend, puis passer l'audit HTTP et le parcours navigateur.
3. Vérifier Resend/DNS, MFA/récupération et les réglages GitHub/Vercel sans
   enregistrer de secret dans cette preuve.
4. Créer une sauvegarde avec fichiers et réussir une restauration hors production.
5. Connecter une fois le propriétaire réel, tester grant/révocation en préprod,
   puis seulement répéter en production.
6. Donner un go production distinct ; tant que les étapes 1 à 5 ne sont pas
   `enabled`, `pnpm run deploy:prod` et les paiements réels restent interdits.

## Nettoyage

Aucun token, compte jetable, export de base ou secret externe n'a été créé dans
cette passe. Les données de test Convex restent confinées au déploiement local
anonyme et sont recréées par la suite de tests.
