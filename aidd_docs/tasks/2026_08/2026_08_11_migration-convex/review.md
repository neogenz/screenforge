# Review: migration-convex

- **Verdict**: blocked
- **Diff**: `e69671b...d4e04c4`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_15
- **Findings**: 7 critical, 4 warning, 0 minor

## Phases

### Phase 1 — Socle `apps/backend`, authentification, débit d'auth

- [ ] Le backend local démarre sans Docker ni compte Convex — not-applicable: démarrage d'un déploiement Convex local non rejoué pendant cette review; script présent dans `apps/backend/package.json`.
- [ ] Le lien magique fonctionne de bout en bout via Resend — not-applicable: domaine, secret Resend et déploiement cloud propriétaire non configurés (`environnements.md:395-400`).
- [ ] Google et GitHub reviennent sur l'éditeur — not-applicable: applications OAuth et secrets propriétaire non configurés (`environnements.md:395-400`).
- [x] La session est persistée et la déconnexion la retire — `apps/web/src/lib/session-keys.ts`, `apps/web/src/lib/auth.ts`.
- [x] Sans `VITE_CONVEX_URL`, le SDK reste hors du boot — `apps/web/e2e/boot-shell.spec.ts`; profil local-first E2E vert.
- [x] Le quatrième lien magique est refusé avec un message stable — `apps/backend/convex/auth.test.ts`, `apps/backend/convex/limits.ts:74-75`.
- [x] La sixième vérification erronée est refusée — `apps/backend/convex/auth.test.ts`, `apps/backend/convex/auth.ts`.
- [x] Les compteurs et leurs contre-tests existent — `apps/backend/convex/auth.test.ts`.
- [x] Le gate intermédiaire est resté vert avant le démantèlement — commit `44e3c78`; gate final `pnpm test` vert.

### Phase 2 — Schéma, droits et mur d'autorisation

- [x] La règle commerciale a une seule implémentation — `apps/backend/convex/entitlements.ts:149`, `apps/backend/convex/authz.ts:82`.
- [x] Les assertions d'entitlements ont été portées sans perte — `apps/backend/convex/entitlements.test.ts`.
- [x] Le mur refuse l'écriture sans Cloud et laisse lecture/suppression ouvertes — `apps/backend/convex/authz.ts`, `apps/backend/convex/authz.test.ts`.
- [x] Expiration et résiliation sont projetées correctement — `apps/backend/convex/entitlements.test.ts:172-175`.
- [x] Les écritures internes restent inaccessibles au client — `apps/backend/convex/mirror.ts`, `apps/backend/convex/mirror.test.ts`.
- [x] Une livraison plus récente gagne sur une ancienne — `apps/backend/convex/mirror.test.ts`.
- [x] Deux premières écritures concurrentes ne créent qu'une ligne — `apps/backend/convex/mirror.test.ts`.
- [x] Le gate intermédiaire est resté vert avant le démantèlement — commit `124d1e3`; gate final `pnpm test` vert.

### Phase 3 — Synchronisation des projets et binaires

- [x] Un projet supérieur à 1 MiB fait l'aller-retour — `apps/web/e2e/sync.spec.ts`; passage local réel documenté dans `phase-6.md:211-224`.
- [x] Le LWW conserve le plus grand `updatedAt` — `apps/backend/convex/projects.test.ts:145-149`.
- [ ] Le nettoyage d'une poussée rejetée ou remplacée préserve toujours le projet actif — fix: un rejeu avec le même `blobId` et le même horodatage supprime le blob encore référencé (`apps/backend/convex/projects.ts:85-87`).
- [x] Les bornes 16/17 MiB sont appliquées — `apps/backend/convex/assets.test.ts`; passage local réel documenté dans `phase-6.md:211-224`.
- [x] Un type ou une taille mensongère supprime le fichier et refuse la ligne — `apps/backend/convex/assets.ts:101-105`, `apps/backend/convex/assets.test.ts`.
- [x] La lecture d'un asset d'un autre compte rend 404 — `apps/backend/convex/assets.test.ts`.
- [ ] Deux navigateurs convergent via le backend réel — not-applicable: les 15 scénarios cloud de `apps/web/e2e/sync.spec.ts` ont été sautés faute de déploiement Convex local actif.
- [x] Une coupure réseau conserve édition, autosave et reprise — `apps/web/src/lib/__tests__/sync.test.ts`, `apps/web/e2e/sync.spec.ts`.
- [x] Sans droit Cloud, aucune synchronisation ne part — `apps/web/src/lib/__tests__/sync.test.ts`, `apps/backend/convex/authz.test.ts`.
- [x] Les projets locaux peuvent être rattachés après achat — `apps/web/e2e/sync.spec.ts`, `apps/web/src/lib/__tests__/sync.test.ts`.

### Phase 4 — Vente Polar

- [x] Les charges Polar signées alimentent le même miroir — `apps/backend/convex/billing.test.ts`.
- [x] Signature invalide, type inconnu et charge malformée ont les statuts prévus — `apps/backend/convex/billing.test.ts`.
- [x] Les livraisons désordonnées gardent la plus récente — `apps/backend/convex/mirror.test.ts`.
- [x] Le Cloud sans Licence est refusé et journalisé — `apps/backend/convex/entitlements.test.ts`, `apps/backend/convex/billing.test.ts`.
- [x] Le checkout Cloud sans Licence s'arrête avant Polar — `apps/backend/convex/billing.test.ts`.
- [x] Le onzième checkout est borné et traduit — `apps/backend/convex/billing.test.ts`, `apps/web/src/lib/account.ts`.
- [ ] Un achat Polar réel ouvre le droit sans rechargement — not-applicable: sandbox, produits et secrets Polar propriétaire absents (`environnements.md:398-404`).
- [x] La clé Supabase de service a disparu du produit — aucun résultat dans `apps/`, `scripts/` ou les manifests actifs.

### Phase 5 — Suppression de compte

- [x] Le test de schéma détecte une nouvelle table portant `userId` — `apps/backend/convex/accountDeletion.test.ts:202-210`.
- [ ] Une suppression réussie ne laisse aucun document, fichier ni session — fix: les enfants au-delà du lot de 100 et les tables auth indirectes peuvent survivre (`apps/backend/convex/accountDeletion.ts:123-136`).
- [x] La barrière ferme les uploads dès l'état `prepared` — `apps/backend/convex/accountDeletion.test.ts:345-366`.
- [ ] Une reprise ne saute aucun document — fix: le parent est supprimé après le premier lot même si un 101e jeton existe (`apps/backend/convex/accountDeletion.ts:123-136`).
- [ ] Un compte dépassant un lot est entièrement nettoyé dans tous les domaines — fix: le test ne dépasse le lot que pour les assets, pas pour les jetons enfants (`apps/backend/convex/accountDeletion.test.ts:383-408`).
- [x] Un refus réel de stockage conserve la ligne pour reprise — `apps/backend/convex/accountDeletion.ts:89-101`, `phase-5.md:164-177`.
- [x] La quatrième demande horaire est refusée — `apps/backend/convex/accountDeletion.test.ts`.
- [x] Les frontières encore pertinentes de l'ancienne route ont été portées — `apps/backend/convex/accountDeletion.test.ts`, écarts explicités dans `phase-5.md:179-197`.

### Phase 6 — Démantèlement et validation de release

- [x] `supabase` ne subsiste plus dans `apps/` et `scripts/` — grep de contrôle sans résultat.
- [ ] `@hono/node-server` n'est plus installé — not-applicable: il appartient au pont local vivant (`apps/bridge/package.json:20`), pas au backend supprimé.
- [x] Les gates de `test:release` sont verts — tests, types, lint, builds, E2E et trois audits passés; lancement scindé uniquement pour autoriser le port local 5199.
- [ ] Le parcours production connexion → achat → sync → suppression est validé — not-applicable: déploiement et identifiants propriétaire requis (`environnements.md:395-404`).
- [x] Les trois contrôles manuels locaux sont consignés — `phase-6.md:211-224`.
- [ ] Supabase hébergé et Railway sont détruits — not-applicable: action externe propriétaire non autorisée (`environnements.md`).
- [ ] Aucun document historique ne décrit l'ancien stack — not-applicable: les plans datés de la fondation SaaS sont conservés comme historique et marqués remplacés (`aidd_docs/tasks/2026_08/2026_08_05_screenforge-saas/plan.md:9-16`).

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🔴 critical | code | 3 | `apps/backend/convex/assets.ts:64-120`, `apps/backend/convex/projects.ts:60-100` | Les mutations acceptent un `storageId`/`blobId` fourni par le client sans le rattacher à l'utilisateur qui a obtenu l'URL d'upload. Un détenteur d'un ID d'un autre compte peut l'enregistrer sous sa propre ligne, le lire par l'`httpAction`, puis le supprimer; les alias légitimes entre lignes sont aussi corrompus par un remplacement ou `removeProject`. | Créer une réservation d'upload liée à `{userId, type, entityId}`, la consommer une seule fois à la confirmation, et refuser/sécuriser toute suppression d'un blob encore référencé. |
| 🔴 critical | code | 3 | `apps/backend/convex/projects.ts:85-87` | Une poussée idempotente avec le même `blobId` et le même `updatedAt` entre dans `stale`, supprime le blob actif, puis laisse la ligne `projects` pointer vers un fichier absent. Le garde présent sur le chemin accepté n'existe pas ici. | Ne supprimer le blob rejeté que s'il diffère du blob actif et n'est référencé par aucune autre ligne; ajouter le rejeu exact comme contre-test. |
| 🔴 critical | code | 5 | `apps/backend/convex/accountDeletion.ts:123-136` | Avec plus de 100 refresh tokens sur une session, seuls les 100 premiers sont supprimés; comme le budget global reste positif, la session parente est ensuite supprimée et les suivants deviennent orphelins, inatteignables aux reprises. | Ne supprimer le parent qu'après une nouvelle lecture bornée confirmant zéro enfant; couvrir 101 refresh tokens et la reprise. |
| 🟡 warning | code | 5 | `apps/backend/convex/accountDeletion.ts:112-165`, `apps/backend/convex/accountDeletion.test.ts:202-210` | L'inventaire ne voit que les tables portant directement `userId`. `authVerifiers` référence une session, `authRateLimits` garde un identifiant de compte, et le composant rate-limiter persiste des clés utilisateur/e-mail hors du schéma applicatif; ces artefacts ne sont jamais purgés. | Ajouter les relations indirectes et les resets du composant à la purge avant suppression de l'identité, avec un test qui inspecte ces tables. |
| 🟡 warning | code | 1 | `apps/backend/convex/auth.ts:143-158`, `apps/web/src/components/auth-dialog/AuthDialog.tsx:51-56` | Le fournisseur Password crée un utilisateur dont l'e-mail n'est pas vérifié. Convex Auth ne le relie donc pas quand la même personne revient par lien magique/Google/GitHub: droits et projets se retrouvent répartis entre deux comptes. | Réserver cette porte aux fixtures hors production, ou vérifier/relier explicitement l'adresse avant de l'exposer aux utilisateurs. |
| 🟡 warning | code | 6 | `aidd_docs/tasks/2026_08/2026_08_11_migration-convex/environnements.md:411-420` | Une adresse personnelle et le mot de passe valide d'un compte préproduction doté de Licence + Cloud sont versionnés. Le rate limit ne protège pas un secret déjà connu. | Révoquer le compte ou le mot de passe, retirer l'identifiant du dépôt et provisionner des fixtures éphémères ou transmettre le secret hors Git. |
| 🟡 warning | fit | - | `git history: cae1284...d4e04c4` | La branche porte 115 commits et 437 fichiers contre `main`; la migration seule correspond aux 17 commits de `e69671b...d4e04c4`. Une PR ciblant `main` mélangerait toute la fondation SaaS et la migration. | Cibler `feat/saas-foundations` comme base, ou rebaser/séquencer la pile avant ouverture de PR. |
| 🔴 critical | functional | 3 | Critère 3 | Le nettoyage d'une poussée rejetée peut supprimer le blob actuellement retenu. | Corriger le chemin `stale` et ajouter le contre-test du même `blobId`. |
| 🔴 critical | functional | 5 | Critère 2 | Des jetons et artefacts d'authentification peuvent subsister après une suppression annoncée réussie. | Purger les enfants jusqu'à épuisement et les relations indirectes avant le parent. |
| 🔴 critical | functional | 5 | Critère 4 | Une reprise ne peut plus retrouver les jetons rendus orphelins par la suppression prématurée de leur session. | Conserver le parent comme curseur durable tant qu'une page d'enfants existe. |
| 🔴 critical | functional | 5 | Critère 5 | Le test multi-lots ne couvre que 450 assets et ne prouve pas le lot imbriqué session → refresh tokens. | Ajouter un compte avec 101+ jetons enfants et drainer jusqu'à zéro. |

## Verification

| Metric | Value |
| --- | --- |
| Verified | 74% (37/50) |
| Files checked | 141 fichiers du diff; `projects.ts`, `assets.ts`, `accountDeletion.ts`, `auth.ts`, `billing.ts`, `mirror.ts`, schéma, stores/lib cloud, tests associés, plans et mémoire projet |
| Unchecked | Phase 1 critères 1-3 — not-applicable; phase 3 critère 3 — fix; phase 3 critère 7 — not-applicable; phase 4 critère 7 — not-applicable; phase 5 critères 2, 4, 5 — fix; phase 6 critères 2, 4, 6, 7 — not-applicable |
| Unplanned | Porte Password publique et demande de stockage navigateur durable, toutes deux documentées comme écarts; pile de 98 commits antérieurs si la cible est `main` |
