---
objective: "Publier un monorepo canonique où Local est gratuit et complet, où Cloud est le seul service payant et où aucun secret ni contournement client ne permet un write Convex, sans rendre le dépôt public avant le gate explicite GO PUBLIC."
status: in-progress
---

# Plan: Local gratuit, Cloud payant et monorepo public sûr

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Corriger le modèle commercial, fermer les findings sécurité, préparer le dépôt public et prouver Local hors ligne ainsi que l’autorisation Cloud côté serveur. |
| **Source** | Rectification utilisateur du 2026-08-16, audit de branche précédent et documentation officielle vérifiée. |

## État de reprise

Les phases produit 1 à 5 sont livrées. Le gate `GO PUBLIC` a ensuite été reçu :
le dépôt canonique est public et ses rulesets `main` et `v*`, secret scanning et
push protection sont actifs. La publication par tag est en place, sans tag v1
créé.

Les preuves fournisseur qui restaient ouvertes (Convex préproduction, Resend,
Polar Sandbox, Preview Vercel, sauvegarde et restauration) sont désormais
pilotées par le plan
[`2026_08_16_cloud-prelaunch-validation`](../2026_08_16_cloud-prelaunch-validation/plan.md).
Le présent plan reste `in-progress` jusqu'à la clôture de cette validation; il
ne faut pas dupliquer ses preuves externes ici.

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Remplacer les droits Local payants par Local gratuit et Cloud seul | [`phase-1.md`](./phase-1.md) |
| 2 | Borner et durcir toutes les écritures Cloud | [`phase-2.md`](./phase-2.md) |
| 3 | Réécrire la landing, le pricing et le compte | [`phase-3.md`](./phase-3.md) |
| 4 | Fermer les findings web et bridge | [`phase-4.md`](./phase-4.md) |
| 5 | Rendre le dépôt et les documents publiables sans secret | [`phase-5.md`](./phase-5.md) |
| 6 | Relier CI, releases et publication au gate GO PUBLIC | [`phase-6.md`](./phase-6.md) |
| 7 | Asserter, tester, reviewer et itérer jusqu’au vert | [`phase-7.md`](./phase-7.md) |

## Resources

| Source | Verified |
| --- | --- |
| [GitHub — Creating rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository) | Les rulesets de branches et tags sont disponibles sur un dépôt public avec GitHub Free; ils ne le sont pas sur ce dépôt privé sans offre supérieure. |
| [GitHub — Setting repository visibility](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility) | Rendre le dépôt public expose aussi l’historique Actions, les logs et les artifacts et autorise les forks; le preflight doit donc les couvrir avant le changement. |
| [GitHub — Secret scanning scope](https://docs.github.com/en/code-security/reference/secret-security/secret-scanning-scope) et [Push protection](https://docs.github.com/en/code-security/concepts/secret-security/push-protection) | Secret scanning est automatique et gratuit sur les dépôts publics; push protection bloque les secrets supportés mais ne remplace pas Gitleaks ni le contrôle des fichiers. |
| [Gitleaks — Official repository](https://github.com/gitleaks/gitleaks) | Le CLI officiel couvre l’historique Git, les fichiers et stdin et peut être placé en pre-commit et en CI. |
| [Vite — Env Variables and Modes](https://vite.dev/guide/env-and-mode.html) | Toute variable `VITE_*` est incluse dans le bundle client; elle ne peut contenir aucun secret. |
| [Convex — Authentication](https://docs.convex.dev/auth/overview), [File Storage](https://docs.convex.dev/file-storage/overview) et [Environment Variables](https://docs.convex.dev/production/environment-variables) | Authentification et autorisation doivent être refaites dans les fonctions; les fichiers vivent dans le stockage Convex et les secrets restent dans les variables propres au déploiement. |
| [Polar — Setup Webhooks](https://polar.sh/docs/integrate/webhooks/endpoints) et [Handle deliveries](https://polar.sh/docs/integrate/webhooks/delivery) | Le webhook brut doit être signé et traité comme une frontière publique; la lecture du corps doit aussi être bornée avant parsing. |
| [Vercel — Response headers](https://vercel.com/docs/headers/response-headers) et [Production checklist](https://vercel.com/docs/production-checklist) | Les headers bloquants et leurs réponses déployées doivent être vérifiés avant production. |

## Decisions

| Decision | Why |
| --- | --- |
| ScreenForge garde un seul monorepo canonique destiné à devenir public; aucun miroir privé du code n’est créé. | Deux dépôts dérivent, doublent les gates et ne protègent pas le service. La valeur payante repose sur l’exploitation Cloud et les contrôles serveur. |
| Local est une capacité universelle du binaire : éditeur, exports propres illimités et ZIP ne lisent plus aucun entitlement, compteur ou interrupteur commercial. | Un client public est modifiable; tout contrôle Local serait artificiel et contredirait le produit demandé. |
| Cloud est le seul entitlement et le seul produit Polar. Toute création, mise à jour, synchronisation ou upload Convex exige une session propriétaire et Cloud actif côté serveur. | Une falsification de React, Zustand ou localStorage ne traverse pas une fonction Convex qui recalcule elle-même le droit. |
| Une suppression explicite de ses données ou de son compte reste possible après expiration, sans permettre création ni mise à jour. | La sortie et l’effacement des données ne doivent pas devenir un moyen de rétention commerciale; ce chemin destructif reste authentifié et limité. |
| Les anciens champs Licence/Local sont retirés des capacités immédiatement, puis supprimés du schéma après vérification et migration non destructive des lignes existantes. | Les garder comme droits entretient deux modèles; les supprimer sans regarder les données pourrait casser un déploiement existant. |
| Le prix Cloud reste le prix existant de 39 USD par an jusqu’à décision commerciale contraire; Local est affiché à 0. | Le changement demandé porte sur les offres, pas sur le montant Cloud. Polar et toutes les surfaces doivent néanmoins être comparés avant vente réelle. |
| Les quotas Cloud cumulés sont des constantes serveur uniques et les totaux sont recalculés transactionnellement depuis les lignes bornées, sans table de compteurs dérivée. | Le volume maximal reste petit; une somme indexée évite la dérive, la réparation et une seconde source de vérité. |
| Les documents `aidd_docs/` restent versionnés et sont traités comme du contenu public; les preuves brutes ou sensibles vont dans `.private/`, ignoré. | Un document de travail n’est pas une enclave secrète. Gitleaks et le contrôle de publication doivent scanner les documents comme le code. |
| Un moteur bridge recevant du texte non fiable n’est annoncé que s’il peut être lancé sans aucun outil local; Codex est désactivé si le protocole installé ne sait pas imposer cette barrière. | Un cwd temporaire, un prompt et un sandbox read-only n’empêchent pas la lecture de fichiers. La sécurité prime sur la parité des moteurs. |
| Aucun changement de visibilité n’est autorisé avant le texte exact `GO PUBLIC`, même si tous les autres gates sont verts. | Le changement publie immédiatement code, historique, logs et artifacts; son irréversibilité pratique exige un checkpoint humain distinct. |
| La licence du dépôt et les mentions commerciales/légales doivent être validées avant `GO PUBLIC`; le plan n’invente pas une licence juridique. | Public ne signifie pas automatiquement open source et les droits de réutilisation concurrents sont une décision juridique séparée de l’architecture. |
