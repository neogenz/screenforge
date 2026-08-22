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

## Phase 2 — PostHog et documents légaux

- PR intégrée : [#23](https://github.com/neogenz/screenforge/pull/23)
- Tête réconciliée et revue : `f6e7fd5ed85d70fa622285cfc24927dc04b70d56`
- Pipeline de PR : [Quality 32577512732](https://github.com/neogenz/screenforge/actions/runs/32577512732)
- Squash merge `main` : `aa4e7f1b6addc3f69d87b9b7e671a8fb1183416a`
- Pipeline post-merge : [Quality 32578357651](https://github.com/neogenz/screenforge/actions/runs/32578357651)
- Verdict : publication, sécurité, actionlint, web, backend, Vercel et E2E release verts sur la PR puis sur `main`
- Activation : analytics toujours fail-closed; la confirmation de rétention fournisseur reste un prérequis opérateur distinct du code intégré
