---
objective: "ScreenForge publishes concise bilingual legal terms and operator information, linked from the landing page and visible before Cloud checkout."
status: implemented
---

# Plan: ScreenForge legal pages

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Publish clear CGU/CGV and legal notices without inventing operator or commercial facts. |
| **Source** | User request in this task, 22 August 2026 |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Publish legal terms and purchase links | [`phase-1.md`](./phase-1.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://www.kmu.admin.ch/fr/obligations-legales-les-lois-suisses-et-europeennes-sur-le-e-commerce | Swiss online-sale identity, ordering and confirmation requirements; no general Swiss withdrawal right |
| https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=Celex%3A32011L0083 | EU distance-contract information and withdrawal rights |
| https://eur-lex.europa.eu/eli/dir/2000/31/oj | EU provider identity and contact requirements |
| https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32019L0770 | Mandatory digital-service conformity remedies |
| https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32008R0593 | Mandatory consumer protections remain despite a choice of Swiss law |
| https://polar.sh/legal/checkout-buyer-terms | Polar Merchant of Record, renewal, cancellation and refund roles |

## Decisions

| Decision | Why |
| -------- | --- |
| One bilingual terms page combines CGU, CGV and legal notices | The existing privacy policy already uses this static bilingual pattern; separate pages would duplicate facts and links. |
| ScreenForge terms govern the product while Polar terms govern checkout and payment | Polar is the Merchant of Record and already owns invoices, taxes, payment and the customer portal. |
