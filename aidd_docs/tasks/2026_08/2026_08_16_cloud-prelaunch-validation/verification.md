# Preuves Cloud pré-lancement

Ce fichier est l'unique matrice publique de validation pour Convex, Resend,
Polar Sandbox et les Previews Vercel. Il ne doit contenir ni jeton, secret,
adresse personnelle, cookie, lien magique, payload fournisseur, identifiant de
compte, URL temporaire ni capture de console sensible.

## Matrice

| Surface | Preuve attendue | État | Date | Commit ou URL publique stable |
| --- | --- | --- | --- | --- |
| Preflight expurgé | Configuration complète ou noms/règles seulement | vert local | 2026-08-16 | commit de phase 1 |
| Convex préproduction | Auth, projets, images et settings sur deux sessions | vert | 2026-08-17 | commit de phase 2 |
| Resend test | Lien livré uniquement au destinataire autorisé | vert | 2026-08-17 | `ac7d120` |
| Compte propriétaire | Cloud complémentaire actif, aucun rôle admin | vert | 2026-08-17 | `ac7d120` |
| Polar Sandbox | Achat, relivraison, révocation et signature | à valider | — | — |
| Preview Vercel | Local puis Cloud sur Convex préproduction uniquement | à valider | — | — |
| Sauvegarde | Restauration cohérente dans une cible jetable | à valider | — | — |
| Production | Aucun tag, domaine ou paiement réel avant les gates | protégé | 2026-08-16 | workflow tagué |

## Asserts

- Phase 1 : 4 tests preflight, 132 tests backend et 615 tests workspace passent;
  typecheck, lint, format, audit de publication et Gitleaks passent également.
- Phase 2, infrastructure : le déploiement de préproduction accepte le commit
  candidat; le preflight retourne `ready: true` sans valeur, et le healthcheck
  facturation ne remonte aucune incohérence.
- Phase 2, régression : le gate E2E strict Cloud passe avec 181 scénarios verts,
  un scénario ignoré explicitement et aucun échec. Après la corrective
  iteration, le scénario ciblé de consentement passe également : deux projets
  antérieurs au login, actif inclus, restent distants à zéro après « Plus tard »
  et un rechargement; « Tout rattacher » en crée exactement deux; un projet créé
  et modifié après le login repart automatiquement.
- Phase 2, compte réel : le lien autorisé a créé un unique compte; la dérogation
  complémentaire expose Cloud actif avec un état Polar vide. Le premier profil
  a synchronisé projet, assets et settings. Une seconde session réelle a repris
  ces données, renvoyé un changement unique au serveur et conservé l'entitlement
  propriétaire. Un write anonyme puis un write après révocation temporaire ont
  été refusés côté serveur sans mutation; la dérogation propriétaire a ensuite
  été restaurée.
- Phase 2, données : l'écart de catalogue observé n'était pas une duplication
  du renommage. Il provenait de l'enrôlement implicite d'un ancien document
  local actif avant le dialogue de rattachement. La cause racine est corrigée
  dans `sync.ts`; aucun projet, asset, setting ou compte réel n'a été supprimé,
  renommé ou modifié pendant cette corrective iteration.
- Phase 2, gates locaux après correction : 619 tests workspace passent (dont
  132 backend et 392 web), ainsi que la sonde MCP, typecheck, lint et le contrôle
  Prettier. Le test E2E Cloud ciblé passe avec un compte et des projets
  synthétiques sur le déploiement Convex local.
- GitHub : dépôt public, secret scanning et push protection actifs, rulesets
  branche et tags actifs; aucun tag v1 créé.

## Review

- Résolu — le cycle initial créait un accusé de synchronisation pour le projet
  actif avant le choix du dialogue. La suppression de cet enrôlement conserve
  la file durable des projets déjà reconnus et les commits post-login, tout en
  rendant « Plus tard » effectivement sans write Cloud. Le test E2E mesure les
  catalogues distants avant et après rechargement, rattachement et nouveau
  commit.
- P2 UX — `MigrateProjectsDialog` affiche le nom du projet dans une surface
  arrondie qui ressemble à un champ éditable alors que la ligne est
  volontairement en lecture seule. La clarification visuelle est volontairement
  hors de cette phase et possède son propre plan AIDD; aucune modification UX
  n'est incluse dans le commit de consentement Cloud.

## Browser QA

- Profil propriétaire principal : projet, assets et settings synchronisés.
- Second profil réel : session distincte, état synchronisé et modification
  retrouvée une seule fois côté serveur.
- Refus serveur : anonyme puis entitlement révoqué, données inchangées.
- Corrective iteration : parcours E2E synthétique isolé, aucun accès aux lignes
  réelles de préproduction.
- Aucune capture, adresse, URL éphémère, identifiant ou sortie sensible n'est
  publiée dans cette preuve.
