# Vérifications d'intégration

Ce journal conserve uniquement des identifiants Git publics et des liens vers
les contrôles GitHub. Il ne contient ni secret, ni identifiant fournisseur, ni
donnée utilisateur.

## Phase 1 — Point de reprise préproduction

- Candidat `main` : `38d5ca997bb5429a9dc0733f910d46dd594f5984`
- PR de promotion : [#25](https://github.com/neogenz/screenforge/pull/25)
- Merge commit `preprod` : `aacb3c137cb6e06ebab60bc43847c528cf4e16a1`
- Tree commun `main` / `preprod` : `c3bfc37e5b2132c8e65e86d9080a134ad99087af`
- Pipeline post-merge : [Quality 32574817049](https://github.com/neogenz/screenforge/actions/runs/32574817049)
- Vercel : déploiement du candidat prêt et alias stable `preprod` actualisé
- Verdict : sécurité, actionlint, web, backend, E2E release, preflight Convex avant/après déploiement et déploiement préproduction verts
