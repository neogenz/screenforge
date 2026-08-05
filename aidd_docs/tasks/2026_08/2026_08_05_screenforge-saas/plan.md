---
objective: "ScreenForge devient un SaaS : comptes SSO, sync cloud des projets, abonnement Stripe, sans toucher au chemin critique d'export pixel-exact."
status: pending
---

# Plan: ScreenForge SaaS — auth, sync cloud, billing

## Overview

| Field      | Value                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------- |
| **Goal**   | Ajouter une couche SaaS (Supabase + backend Hono + Stripe) autour de l'éditeur local-first     |
| **Source** | [`brainstorm.md`](./brainstorm.md) (2026-08-05)                                                |

## Phases

| #   | Phase                                          | File                         |
| --- | ---------------------------------------------- | ---------------------------- |
| 1   | Fondations monorepo + tooling Supabase         | [`phase-1.md`](./phase-1.md) |
| 2   | Auth SSO + schéma DB + RLS                     | [`phase-2.md`](./phase-2.md) |
| 3   | Sync cloud (projets + assets)                  | [`phase-3.md`](./phase-3.md) |
| 4   | Backend Hono + billing Stripe                  | [`phase-4.md`](./phase-4.md) |
| 5   | Quotas, compte & migration anonyme → compte    | [`phase-5.md`](./phase-5.md) |

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
