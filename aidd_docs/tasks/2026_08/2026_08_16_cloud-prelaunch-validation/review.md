# Review: Branche Cloud pré-lancement et clarté des projets

- **Verdict**: changes-requested
- **Diff**: `origin/main@8c6c532...codex/cloud-prelaunch-plan`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_18
- **Findings**: 0 critical, 8 warning, 0 minor

## Phases

### Phase Cloud 1 — Runbook et preflight expurgé

- [x] Une configuration complète renvoie `ready`; chaque absence ou combinaison dangereuse connue bloque le preflight sans exposer de valeur secrète. — `apps/backend/convex/preflight.ts:40`, `apps/backend/convex/preflight.test.ts:15`
- [x] Les documents décrivent Local gratuit et l’unique produit Cloud avec les commandes actuelles, sans secret ni donnée personnelle dans la preuve. — `aidd_docs/tasks/2026_08/2026_08_11_migration-convex/environnements.md:259`, `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/verification.md:3`

### Phase Cloud 2 — Convex, Resend et compte propriétaire

- [x] Un lien magique réel a atteint uniquement le destinataire autorisé et aucune donnée d’authentification n’est publiée. — `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/verification.md:14`, `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/verification.md:34`
- [x] Le compte propriétaire possède Cloud comme client complémentaire sans rôle administrateur ni mutation accessible au navigateur. — `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/verification.md:15`, `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/verification.md:34`
- [x] Local reste complet sans Convex et les refus anonyme, droit révoqué et état client falsifié n’écrivent pas dans Cloud. — `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/verification.md:28`, `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/verification.md:38`
- [x] Différer conserve zéro projet distant, l’ajout explicite envoie exactement les projets listés et les commits post-connexion restent automatiques. — `apps/web/e2e/sync.spec.ts:1440`, `apps/web/e2e/sync.spec.ts:1490`, `apps/web/e2e/sync.spec.ts:1503`

### Phase Cloud 3 — Polar Sandbox et entitlements réels

- [x] Polar Sandbox contient un seul produit Cloud, un webhook borné à la préproduction et un preflight vert. — `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/verification.md:16`, `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/verification.md:55`
- [ ] Un paiement Sandbox accorde Cloud, la relivraison reste idempotente et la dérogation propriétaire reste indépendante; l’annulation et l’échéance restent à observer. — `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/verification.md:16`, `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/phase-3.md:65`
- [x] Les payloads absents, altérés ou trop grands sont refusés sans mutation ni donnée sensible, et aucune API client n’expose le miroir. — `apps/backend/convex/billing.test.ts:240`, `apps/backend/convex/polar.ts:176`

### Phase Cloud 4 — Previews Vercel par pull request

- [ ] Chaque PR interne éligible reçoit une Preview protégée tandis que `main`, les forks non autorisés et la production restent hors du chemin. — sous-plan et matrice encore `pending`; `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/verification.md:17`
- [ ] La Preview ne contient que des valeurs frontend publiques et vise uniquement Convex préproduction avec un compte de test. — aucune preuve de variables, bundle, logs ou parcours Preview; `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/phase-4.md:93`
- [ ] Local puis Cloud fonctionnent sur la PR témoin sans tag ni changement production, avec une matrice unique expurgée. — browser QA Preview et preuve de non-déploiement non consignées; `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/phase-4.md:102`

### Phase Cloud 5 — Gate final Cloud

- [ ] Tous les gates automatisés et l’export critique sont verts sur le même SHA frontend, backend, Preview et preuve. — les gates UX sont consignés, mais aucun SHA Preview commun n’est prouvé; `aidd_docs/tasks/2026_08/2026_08_17_project-switcher-clarity/verification.md:18`
- [ ] Local, auth, propriétaire, sync et entitlement Polar gouvernent les writes depuis la Preview malgré une falsification client. — Polar et la Preview restent à valider; `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/verification.md:16`
- [ ] Une sauvegarde est restaurée dans une cible séparée, comparée puis supprimée avec ses fixtures. — matrice `à valider`; `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/verification.md:18`
- [ ] Aucun finding bloquant ne reste et toute correction est retestée par un cycle complet vert. — le correctif catalogue est présent, mais le gate complet final reste à rejouer sur le SHA Preview; `apps/web/src/lib/storage.ts:315`

### Phase Cloud 6 — Gates domaine et production

- [x] Sans `GO DOMAIN`, aucun achat ni DNS n’est modifié; la partie postérieure au gate reste non applicable. — `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/phase-6.md:59`, `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/verification.md:19`
- [ ] Polar production, son produit, son webhook et le compte propriétaire production sont distincts de Sandbox. — not-applicable avant `GO DOMAIN`; `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/phase-6.md:68`
- [x] Sans `GO PRODUCTION`, aucun tag ni paiement réel n’est créé et le workflow de production reste borné aux tags `v*`. — `.github/workflows/deploy-production.yml:3`, `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/verification.md:19`

### Phase Projets 1 — Vocabulaire et états de disponibilité

- [x] Les termes visibles décrivent la disponibilité de la copie sans redéfinir les offres Local et Cloud. — `apps/web/src/lib/sync.ts:438`, `aidd_docs/memory/design.md:27`
- [x] Un catalogue mixte est classé sans appel réseau ni écriture locale ou distante. — `apps/web/src/lib/sync.ts:460`, `apps/web/src/lib/sync.ts:480`
- [x] Une modification locale postérieure au dernier accusé affiche `À synchroniser`. — `apps/web/src/lib/sync.ts:471`, `apps/web/src/lib/__tests__/sync.test.ts:142`
- [x] Les tests refusent d’annoncer Cloud sans accusé et prouvent que la lecture ne crée pas de record. — `apps/web/src/lib/__tests__/sync.test.ts:142`, `apps/web/src/lib/__tests__/sync.test.ts:161`

### Phase Projets 2 — Sélecteur structuré

- [x] Le projet courant, ses actions et les autres projets sont visuellement séparés. — `apps/web/src/components/project-switcher/ProjectSwitcher.tsx:192`, `apps/web/src/components/project-switcher/ProjectSwitcher.tsx:223`
- [x] Chaque autre projet annonce son nom complet, sa disponibilité et sa date aux technologies d’assistance. — `apps/web/src/components/project-switcher/ProjectSwitcher.tsx:263`, `apps/web/e2e/project-file.spec.ts:589`
- [x] Le nom courant reste éditable et importer, télécharger et ouvrir conservent leurs garanties. — `apps/web/src/components/project-switcher/ProjectSwitcher.tsx:102`, `apps/web/src/components/project-switcher/ProjectSwitcher.tsx:113`, `apps/web/src/components/project-switcher/ProjectSwitcher.tsx:131`, `apps/web/src/components/project-switcher/ProjectSwitcher.tsx:145`
- [x] À largeur compacte et avec un nom long, les actions et témoins restent accessibles sans chevauchement. — `apps/web/e2e/project-file.spec.ts:573`, `aidd_docs/tasks/2026_08/2026_08_17_project-switcher-clarity/verification.md:30`
- [x] Le panneau fonctionne au clavier et restaure le focus après Échap ou sélection. — `apps/web/e2e/project-file.spec.ts:552`, `apps/web/e2e/project-file.spec.ts:603`
- [x] Une erreur de catalogue laisse toujours le projet courant utilisable et propose une reprise explicite. — `apps/web/src/lib/storage.ts:315`, `apps/web/src/lib/__tests__/storage.test.ts:425`

### Phase Projets 3 — Dialogue de consentement et quality gate UX

- [x] Le dialogue explique quels projets sont concernés, leur destination et la conservation locale. — `apps/web/src/components/migrate-dialog/MigrateProjectsDialog.tsx:114`, `apps/web/src/components/migrate-dialog/MigrateProjectsDialog.tsx:140`, `apps/web/src/components/migrate-dialog/MigrateProjectsDialog.tsx:187`
- [x] Les actions nomment leur résultat et la destination Cloud sans libellé générique. — `apps/web/src/components/migrate-dialog/MigrateProjectsDialog.tsx:103`, `apps/web/src/components/migrate-dialog/MigrateProjectsDialog.tsx:118`
- [x] La liste statique n’a aucune affordance d’input, de bouton ou de sélection. — `apps/web/src/components/migrate-dialog/MigrateProjectsDialog.tsx:158`, `apps/web/e2e/sync.spec.ts:1448`
- [x] Noms longs, pluriel, chargement et erreur restent lisibles à 200 % de zoom. — `apps/web/src/components/migrate-dialog/MigrateProjectsDialog.tsx:128`, `apps/web/e2e/sync.spec.ts:1457`, `apps/web/e2e/sync.spec.ts:1530`
- [x] Différer n’ajoute rien et l’action primaire traite exactement les fixtures listées. — `apps/web/e2e/sync.spec.ts:1479`, `apps/web/e2e/sync.spec.ts:1490`
- [x] Les deux passes visuelles, les audits contraste/échelle, Impeccable et la gate de release sont consignés verts. — `aidd_docs/tasks/2026_08/2026_08_17_project-switcher-clarity/verification.md:14`, `aidd_docs/tasks/2026_08/2026_08_17_project-switcher-clarity/verification.md:30`
- [x] La vérification ne mute ni ne supprime de donnée utilisateur réelle. — `aidd_docs/tasks/2026_08/2026_08_17_project-switcher-clarity/verification.md:3`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 warning | functional | Cloud 3 | `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/phase-3.md:65` | Achat, relivraison et dérogation sont validés, mais l’annulation et la transition d’échéance ne sont pas encore observées. | Terminer le cycle Sandbox avec confirmation humaine et consigner uniquement les statuts expurgés. |
| 🟡 warning | functional | Cloud 4 | `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/verification.md:17` | La Preview interne protégée, le refus fork et l’absence de déploiement `main` ne sont pas prouvés. | Exécuter le sous-plan Vercel sur la PR témoin et un fork contrôlé. |
| 🟡 warning | functional | Cloud 4 | `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/phase-4.md:93` | La séparation des variables publiques Preview et des secrets serveur n’a pas de preuve versionnée. | Auditer variables, bundle, logs et artifacts de la Preview puis consigner uniquement les noms et statuts. |
| 🟡 warning | functional | Cloud 4 | `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/phase-4.md:102` | Local et Cloud n’ont pas été validés sur la Preview et la production inchangée n’est pas attestée. | Exécuter le browser QA Preview et comparer la production avant/après sans tag. |
| 🟡 warning | functional | Cloud 5 | `aidd_docs/tasks/2026_08/2026_08_17_project-switcher-clarity/verification.md:18` | Les gates sont consignés, mais pas sur un SHA commun frontend/backend/Preview/preuve. | Rejouer le gate complet sur le SHA Preview final et inscrire ce SHA dans la matrice Cloud. |
| 🟡 warning | functional | Cloud 5 | `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/verification.md:16` | Le parcours Preview ne démontre pas encore que l’entitlement Polar gouverne tous les writes. | Rejouer Local, auth, sync et falsification client après les phases Polar et Vercel. |
| 🟡 warning | functional | Cloud 5 | `aidd_docs/tasks/2026_08/2026_08_16_cloud-prelaunch-validation/verification.md:18` | Sauvegarde, restauration isolée, comparaison et suppression de cible sont absentes. | Effectuer le drill Convex dans une cible jetable et ne publier que les compteurs expurgés. |
| 🟡 warning | functional | Cloud 5 | `apps/web/src/lib/storage.ts:315` | La corrective catalogue reste incomplète et le cycle final ne peut pas être fermé. | Corriger le timestamp, ajouter la régression puis repasser le gate complet et la review. |

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 75.0% (27/36) |
| Files checked | `apps/backend/convex/preflight.ts`, `apps/backend/convex/preflight.test.ts`, `apps/web/src/lib/sync.ts`, `apps/web/src/lib/storage.ts`, `apps/web/src/components/project-switcher/ProjectSwitcher.tsx`, `apps/web/src/components/migrate-dialog/MigrateProjectsDialog.tsx`, `apps/web/src/components/toolbar/TopBar.tsx`, `apps/web/src/components/ui/dialog.tsx`, `apps/web/src/lib/__tests__/sync.test.ts`, `apps/web/src/lib/__tests__/storage.test.ts`, `apps/web/e2e/project-file.spec.ts`, `apps/web/e2e/semantics.spec.ts`, `apps/web/e2e/sync.spec.ts`, plans, phases, mémoires et matrices modifiés |
| Unchecked     | Polar lifecycle — fix; Preview routing — fix; Preview secrets — fix; Preview Local/Cloud — fix; same-SHA release gate — fix; Preview entitlement — fix; backup restore — fix; final corrective cycle — fix; Polar production before `GO DOMAIN` — not-applicable |
| Unplanned     | none |
