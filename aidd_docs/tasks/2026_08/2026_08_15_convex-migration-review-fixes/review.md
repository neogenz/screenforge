# Review: convex-migration-review-fixes

- **Verdict**: approve
- **Diff**: `feat/saas-foundations...codex/convex-migration-review-fixes`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_15
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Rendre chaque blob possédé et supprimé sans casser une référence

- [x] Supprimer ou remplacer une ligne ne rend jamais illisible une autre ligne qui référence encore le même fichier — `apps/backend/convex/storageReferences.ts:7`, `apps/backend/convex/projects.test.ts:206`.
- [x] Le dernier retrait d'une référence supprime exactement une fois le fichier Storage — `apps/backend/convex/storageReferences.ts:12`, `apps/backend/convex/projects.test.ts:206`.
- [x] Aucune fonction publique n'accepte de `storageId` ou `blobId`; l'ID est créé et consommé côté serveur — `apps/backend/convex/http.ts:211`, `apps/backend/convex/projects.ts:41`, `apps/backend/convex/assets.ts:41`.
- [x] Un upload refusé n'écrit ni ligne ni fichier durable — `apps/backend/convex/http.ts:194`, `apps/backend/convex/http.ts:219`, `apps/backend/convex/http.ts:238`, `apps/backend/convex/http.ts:261`.
- [x] Un projet rejoué avec la même version rend `stale` sans supprimer le blob actif — `apps/backend/convex/projects.test.ts:170`.
- [x] La synchronisation garde ses contrats, reste non bloquante hors réseau et ne charge pas Convex en local-first — `apps/web/src/lib/sync.ts:76`, `apps/web/e2e/boot-shell.spec.ts:138`.
- [x] Deux comptes ne peuvent ni lire ni détruire les octets l'un de l'autre, alias historiques compris — `apps/backend/convex/projects.test.ts:236`, `apps/backend/convex/download.ts:16`.
- [x] Le transport réel accepte 16 MiB et refuse 17 MiB sans orphelin — `apps/web/e2e/sync.spec.ts:259`; gate release vert.

### Phase 2 — Purger entièrement l'identité et ses artefacts

- [x] Une session portant 101 refresh tokens conserve son parent jusqu'au drainage complet — `apps/backend/convex/accountDeletion.ts:107`, `apps/backend/convex/accountDeletion.test.ts:460`.
- [x] Plus d'un lot de codes suit la même propriété sans saut à la reprise — `apps/backend/convex/accountDeletion.ts:145`, `apps/backend/convex/accountDeletion.test.ts:495`.
- [x] Verifiers, rate limits, refresh tokens et codes sont vides après succès — `apps/backend/convex/accountDeletion.test.ts:274`.
- [x] Toute table Convex Auth non classée fait échouer l'inventaire — `apps/backend/convex/accountDeletion.ts:58`, `apps/backend/convex/accountDeletion.test.ts:247`.
- [x] Les limites utilisateur et e-mail sont réinitialisées sans toucher aux limites globales — `apps/backend/convex/limits.ts:111`, `apps/backend/convex/accountDeletion.test.ts:602`.
- [x] Supprimer un compte préserve tout fichier encore référencé par un autre compte — `apps/backend/convex/accountDeletion.ts:92`, `apps/backend/convex/accountDeletion.test.ts:547`.
- [x] Une suppression interrompue puis reprise termine à zéro; une seconde reprise est sans effet — `apps/backend/convex/accountDeletion.test.ts:419`, `apps/backend/convex/accountDeletion.test.ts:434`.
- [x] Un refus Storage conserve ligne, job, `attempts` et `lastError` pour la reprise — `apps/backend/convex/accountDeletion.ts:92`, `apps/backend/convex/accountDeletion.ts:376`, `apps/backend/convex/accountDeletion.test.ts:526`.

### Phase 3 — Réserver Password aux fixtures et révoquer les identifiants publiés

- [x] `test-password` crée et reconnecte une fixture, mais refuse les adresses réelles sans créer d'utilisateur — `apps/backend/convex/auth.ts:146`, `apps/backend/convex/auth.test.ts:68`.
- [x] L'ancien provider `password` est rejeté — `apps/backend/convex/auth.test.ts:55`.
- [x] La boîte expose Google, GitHub et le lien magique, sans contrôle Password — `apps/web/src/components/auth-dialog/AuthDialog.tsx:22`, `assert-frontend.md`.
- [x] Focus, erreurs, fermeture et mode local-first restent intacts — `assert-frontend.md`, `apps/web/e2e/sync.spec.ts:240`, `apps/web/e2e/boot-shell.spec.ts:138`.
- [x] L'ancien compte préproduction est révoqué et l'arbre ne contient plus ses identifiants — `../2026_08_11_migration-convex/environnements.md:411`, `../2026_08_11_migration-convex/phase-6.md:355`.
- [x] Les E2E créent une fixture unique sans mot de passe partagé — `apps/backend/tests/stack.ts:163`.

### Phase 4 — Rendre le gate cloud obligatoire et reproductible

- [x] Le mode strict démarre Convex et le serveur cloud puis exécute tous les scénarios de synchronisation — `apps/web/playwright.config.ts:88`, `apps/web/e2e/global-setup.ts:7`; 18/18 scénarios Cloud passés.
- [x] Un backend indisponible échoue explicitement au lieu de produire un faux vert par skip — `apps/web/e2e/sync.spec.ts:52`.
- [x] La CI et `test:release` utilisent le même chemin cloud strict — `package.json:19`, `.github/workflows/quality.yml:58`.
- [x] La suite rend les ports 3210, 3211, 5198 et 5199 — contrôle post-gate: quatre ports libres.
- [x] Les commandes racine distinguent test rapide et preuve release — `AGENTS.md:51`, `README.md:73`, `aidd_docs/memory/testing.md:30`.
- [x] Le profil local-first prouve l'absence du SDK tandis que le profil cloud prouve le transport réel — `apps/web/e2e/boot-shell.spec.ts:138`, `apps/web/e2e/sync.spec.ts:259`.

### Phase 5 — Fermer par assert, review et boucle corrective

- [x] Unités, types, lint, builds, E2E strict, export et audits sont verts — `pnpm run test:release`: 512 unités, 165 E2E, 2 prélaunch, export 1320×2868 opaque, contrastes et audits verts.
- [x] Aucun scénario Cloud n'est sauté et aucun processus de test ne survit — 18/18 scénarios Cloud passés; seul le bezel Apple externe est sauté; quatre ports libres.
- [x] Les assertions coding et frontend passent; l'architecture ne laisse aucun écart — `assert-frontend.md`, `apps/backend/convex/convex.config.ts:14`, `apps/backend/convex/http.ts:194`, `apps/backend/convex/storageReferences.ts:7`.
- [x] La review conclut `approve` avec zéro finding et zéro critère `fix` — ce rapport.
- [x] Les écarts découverts ont été rendus reproductibles puis corrigés avant le gate final — `apps/web/e2e/motion.spec.ts:11`; répétition ciblée 15/15 puis release verte; codegen Convex rouge puis vert avec l'environnement typé.
- [x] L'ancien compte préproduction ne connecte plus et ses identifiants sont absents — `../2026_08_11_migration-convex/environnements.md:414`.
- [x] La PR cible la pile revue sans mélanger `main` — merge-base `e69671bb8e2efdd9f542e267f453c8f7f47b6eb7`; `feat/saas-foundations` n'est pas encore ancêtre de `main`; aucun conflit détecté avec la cible actuelle.

## Findings

None.

## Verification

| Metric | Value |
| --- | --- |
| Verified | 100% (35/35) |
| Files checked | 150 fichiers du diff; frontières HTTP/Storage, auth, droits, suppression, schéma, sync et stores web, configuration Playwright/CI, tests backend/E2E, documentation et mémoire projet |
| Unchecked | none |
| Unplanned | none |
