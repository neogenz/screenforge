---
objective: "Fermer tous les constats de la review Convex, rendre les preuves cloud obligatoires et obtenir une review finale approuvée sans régression local-first ni export."
status: implemented
---

# Plan: corrections complètes de la migration Convex

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Corriger l'isolation Storage, la suppression de compte, l'authentification de fixture, les secrets publiés et le gate de release, puis itérer jusqu'à une review approuvée. |
| **Source** | Demande utilisateur du 2026-08-15 et [`../2026_08_11_migration-convex/review.md`](../2026_08_11_migration-convex/review.md) |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Rendre chaque blob possédé et supprimé sans casser une référence | [`phase-1.md`](./phase-1.md) |
| 2 | Purger entièrement l'identité et ses artefacts | [`phase-2.md`](./phase-2.md) |
| 3 | Réserver Password aux fixtures et révoquer les identifiants publiés | [`phase-3.md`](./phase-3.md) |
| 4 | Rendre le gate cloud obligatoire et reproductible | [`phase-4.md`](./phase-4.md) |
| 5 | Fermer par assert, review et boucle corrective | [`phase-5.md`](./phase-5.md) |

## Resources

| Source | Verified |
| --- | --- |
| https://docs.convex.dev/file-storage/upload-files | Une HTTP action peut authentifier, recevoir le `Blob`, appeler `ctx.storage.store()` et ne jamais exposer le `storageId` au client; la limite documentée de 20 MiB couvre les assets plafonnés à 16 MiB. |
| https://docs.convex.dev/functions/http-actions | Une HTTP action dispose de `auth`, `storage` et `runMutation`; CORS et préflight restent à déclarer explicitement. |
| https://docs.convex.dev/file-storage/serve-files | Les fichiers privés doivent continuer à être servis par des HTTP actions qui réévaluent l'autorisation à chaque lecture. |
| https://docs.convex.dev/production/state/limits | Les limites de fonction, document, HTTP et stockage restent compatibles avec 4 MiB de projet, 16 MiB d'asset et des purges bornées. |
| https://docs.convex.dev/auth/convex-auth | Convex Auth est bêta et supporte mot de passe, lien magique et OAuth; une porte non vérifiée réservée aux fixtures ne doit pas devenir une identité utilisateur. |

## Decisions

| Decision | Why |
| --- | --- |
| Les uploads projet et asset passent par des HTTP actions authentifiées qui stockent puis appellent une mutation interne. | Le serveur crée lui-même l'ID Storage et ne peut plus lire, rattacher ou supprimer un ID fourni par un autre client. |
| Toute suppression de fichier consulte des indexes globaux de références avant `ctx.storage.delete()`. | Les anciennes lignes aliasées restent sûres pendant la transition et une suppression ne casse jamais une autre ligne, même d'un autre compte. |
| Le fournisseur devient `test-password`, limité à `@screenforge.test`, et disparaît de l'interface. | Les E2E gardent une session automatisable sans permettre à une adresse réelle de se fragmenter entre Password et une identité vérifiée. |
| `test:release` démarre un backend Convex local et interdit les skips cloud. | Une release verte doit prouver le transport réel, pas seulement les chemins local-first et les tests simulés. |
| La branche de correction cible `feat/saas-foundations` tant que cette base n'est pas fusionnée. | Le diff de migration compte 17 commits sur cette base, contre 115 commits et 437 fichiers s'il cible directement `main`. |
| La livraison boucle sur implémentation, tests, assert et review jusqu'à `approved`. | Un gate vert ne suffit pas à fermer les constats de sécurité et de cohérence; la review finale doit constater zéro écart corrigeable. |
