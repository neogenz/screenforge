---
objective: "ScreenForge devient un SaaS : comptes SSO, sync cloud des projets, licence et add-on vendus via Merchant of Record, sans toucher au chemin critique d'export pixel-exact."
status: reviewed
---

# Plan: ScreenForge SaaS — auth, sync cloud, billing

> **La couche serveur de ce plan a été remplacée le 2026-08-11.** Supabase
> (Auth, Postgres, RLS, Storage) et le service `apps/api` ont laissé la place à
> un déploiement Convex unique — voir
> [`../2026_08_11_migration-convex/plan.md`](../2026_08_11_migration-convex/plan.md).
> Ce qui est décrit ici et **reste vrai** : l'offre (Licence perpétuelle, Cloud
> annuel), les règles de vente, le palier gratuit et son filigrane, le
> Merchant of Record. Ce qui ne l'est plus : chaque mention de RLS, de
> `service_role`, de PostgREST, de bucket Storage ou de route Hono.

## Overview

| Field      | Value                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------- |
| **Goal**   | Ajouter une couche SaaS (Supabase + backend Hono + Polar) autour de l'éditeur local-first      |
| **Source** | [`brainstorm.md`](./brainstorm.md) (2026-08-05)                                                |
| **Offre**  | [`../2026_08_06_offre-commerciale/pricing.md`](../2026_08_06_offre-commerciale/pricing.md) — autorité sur les paliers, les prix et les règles de vente |

> **Réaligné le 2026-08-07.** Le plan d'origine vendait un abonnement mensuel Pro
> via Stripe direct. `pricing.md`, écrit le lendemain, a remplacé ce modèle par
> trois paliers — Gratuit, Licence 49 $ une fois, Cloud +39 $/an — et a tranché
> pour un Merchant of Record dès la première vente. Les phases 3, 4 et 5 portent
> la mise à jour ; les phases 1 et 2 sont inchangées, l'auth et le schéma ne
> dépendant pas du modèle de vente.

## Paliers vendus

| Palier      | Prix           | Compte  | Export                       | Sync cloud |
| ----------- | -------------- | ------- | ---------------------------- | ---------- |
| **Gratuit** | 0 $            | inutile | 3 par projet, filigrané      | non        |
| **Licence** | 49 $ une fois  | requis  | illimité, sans filigrane     | non        |
| **Cloud**   | +39 $/an       | requis  | illimité, sans filigrane     | oui        |

Deux règles de vente en découlent, et elles sont dans le code, pas dans la page
tarifs : **le Cloud exige la Licence** (sans quoi un an d'add-on à 39 $ achète ce
que la Licence à 49 $ achète), et **la Licence est perpétuelle** — elle ne porte
pas de date de fin, seul le Cloud en a une.

## Phases

| #   | Phase                                                   | File                         |
| --- | ------------------------------------------------------- | ---------------------------- |
| 1   | Fondations monorepo + tooling Supabase                  | [`phase-1.md`](./phase-1.md) |
| 2   | Auth SSO + schéma DB + RLS                              | [`phase-2.md`](./phase-2.md) |
| 3   | Sync cloud (projets + assets) — réservée au palier Cloud | [`phase-3.md`](./phase-3.md) |
| 4   | Backend Hono + vente via Polar (Merchant of Record)     | [`phase-4.md`](./phase-4.md) |
| 5   | Filigrane et quota d'export, compte & migration anonyme | [`phase-5.md`](./phase-5.md) |
| 6   | Corrections de revue et validation finale               | [`phase-6.md`](./phase-6.md) |

Les cinq phases initiales sont livrées. La phase 6 ferme les écarts établis par
la revue statique du 2026-08-09 contre `main`, puis rejoue les contrôles de
release. Ce qui restera ensuite hors du dépôt concerne trois
comptes tiers qui n'appartiennent qu'au propriétaire du projet, plus les deux
préalables commerciaux ci-dessous.

1. **Applications OAuth Google et GitHub** (phase 2, critère 3). Le code du SSO
   est en place et le lien magique fonctionne ; les deux fournisseurs demandent
   des applications créées sous l'identité du propriétaire.
2. **Compte Polar** : produits Licence et Cloud, bénéfice de licence,
   `POLAR_ACCESS_TOKEN` et `POLAR_WEBHOOK_SECRET`. La réception est testée avec
   des charges signées réelles ; ce qui reste à établir est la forme exacte du
   `customer.state_changed` d'un achat véritable (phase 4, critères 3, 5, 7).
3. **Déploiement de `apps/api` sur Railway**, puis le webhook Polar pointé sur
   `<url publique>/billing/webhook` (phase 4, tasks 5.1 et 5.2).

## Bloquants avant d'encaisser

Nommés par [`pricing.md` §8](../2026_08_06_offre-commerciale/pricing.md), hors
périmètre technique de ce plan mais préalables à l'ouverture de la phase 4 :

1. **Mentions légales, CGV et politique de confidentialité.** Aucune page
   n'existe. Un studio n'ouvre pas un dossier fournisseur sur un `mailto:`.
2. **L'éditeur est uniquement en français** alors que la vitrine est bilingue :
   sa seule action aboutie dépose un visiteur anglophone dans une UI qu'il n'a
   pas choisie.

## Resources

| Source                                                                                  | Verified                                                                                     |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| https://supabase.com/docs/guides/auth/social-login                                      | SSO Google/GitHub supportés nativement ; provider tokens non stockés en DB                    |
| https://supabase.com/docs/guides/database/postgres/row-level-security                   | RLS obligatoire sur schéma exposé ; policies `(select auth.uid()) = user_id` + index `user_id` ; rôle `anon` ≠ utilisateur anonyme |
| https://supabase.com/pricing                                                            | Free : 50k MAU, pause après 7 j d'inactivité ; Pro ~25 $ + compute — déjà payé par l'utilisateur |
| https://hono.dev/docs/                                                                   | Hono multi-runtime (Workers, Node, Railway…), <14 kB, mode RPC `hc` typé avec zod            |
| https://developers.cloudflare.com/workers/platform/pricing/                              | Workers Paid 5 $/mois ; assets statiques gratuits/illimités ; R2 egress gratuit               |
| https://www.better-auth.com/docs/plugins/stripe                                         | Plugin Stripe de better-auth documenté — écarté car conflit avec Supabase Auth/RLS            |
| https://neon.com/pricing + https://neon.com/docs/auth/overview                          | Neon mature (Databricks) avec auth managée — écarté : abonnement Supabase existant            |
| https://polar.sh/docs/merchant-of-record/introduction                                   | Polar est bien Merchant of Record : TVA, GST et sales tax US portées par lui, enregistrements et déclarations comprises — vérifié 2026-08-07 |
| https://polar.sh/docs/features/products                                                 | Achat unique et abonnement sont le même objet produit ; intervalles jour/semaine/mois/an ; bénéfices automatiques dont **clés de licence** — vérifié 2026-08-07 |
| https://polar.sh/docs/integrate/customer-state                                          | `customer state` : abonnements actifs + bénéfices accordés en **un seul appel**, et un webhook `customer.state_changed` qui couvre création, changement d'abonnement et octroi/révocation — vérifié 2026-08-07 |
| https://polar.sh/docs/integrate/webhooks/endpoints                                      | Webhooks conformes à la spec Standard Webhooks, validation de signature fournie par les SDK — vérifié 2026-08-07 |

## Decisions

| Decision                                                                  | Why                                                                                                      |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Supabase (Auth + Postgres + RLS + Storage) comme socle SaaS               | Abonnement déjà payé, SSO éprouvé, sécurité déclarative RLS adaptée au dev 100 % IA, plus gros corpus IA  |
| Backend Hono séparé pour TOUTE la logique métier (billing, quotas)        | Portabilité, code versionné/testable ; zéro trigger métier en DB (choix utilisateur contre le lock-in)   |
| Client → PostgREST en direct pour le CRUD simple, → Hono pour les écritures soumises à règle métier | Évite un proxy API systématique ; la RLS reste le dernier rempart sur le chemin direct                   |
| Pas de router : auth/compte via dialogs (pattern `ui.store` flags)        | L'app est mono-écran ; le pattern Dialog + flag existe déjà, zéro nouvelle dépendance                     |
| Sync = document JSON entier + last-write-wins (`updatedAt`), assets binaires dans Supabase Storage | Le projet est déjà un document auto-contenu ; pas de besoin temps réel ; jamais de base64 en DB          |
| L'app reste 100 % fonctionnelle hors-ligne et sans compte                 | Usage personnel préservé ; la couche cloud est additive, jamais bloquante                                 |
| Déploiement API sur Railway                                               | Outillage déjà en place (MCP Railway) ; Hono multi-runtime permet de changer d'hébergeur sans réécriture |
| **Polar (Merchant of Record) et non Stripe direct** — décision du 2026-08-07, remplace le billing Stripe du plan initial | `pricing.md` §6.2 : le passage au dollar coûte 2 % de conversion à un compte Stripe français, ce qui ramène l'écart avec un MoR à 0,37 $ par vente — 37 $ pour cent ventes, contre des déclarations OSS dans vingt-sept pays. Et changer de prestataire après acquisition coûte des licences à re-délivrer |
| **Deux droits distincts, pas un plan** : `licence` perpétuelle et `cloud` annuel | Un achat unique et un abonnement n'ont pas la même forme — la Licence n'a pas de fin de période, le Cloud si. Une colonne `plan text` unique ne peut pas porter « a payé une fois, et est abonné depuis mars » |
| **Le miroir de droits se reconstruit depuis `customer.state_changed`**, jamais depuis une séquence d'événements | Polar sert l'état complet du client en un appel ; écouter `order.paid` puis `subscription.canceled` pour reconstituer cet état à la main, c'est réimplémenter une machine que le fournisseur expose déjà, et se désynchroniser au premier webhook perdu |
| **La limite du palier gratuit porte sur l'export, pas sur le nombre de projets** | `pricing.md` : Gratuit = 3 exports filigranés par projet, projets locaux illimités. Le stockage local ne coûte rien, donc le limiter ne défend aucune marge — seul l'export distingue les paliers |
