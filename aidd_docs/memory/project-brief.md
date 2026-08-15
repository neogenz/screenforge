# Project Brief

## What it is

- ScreenForge is a local-first browser editor for indie developers creating iPhone App Store screenshot sets.
- It designs layered screens and exports App Store-ready PNG files with the whole render running in the browser.
- Two paid plans sold through Polar as Merchant of Record: Local ($49 once, clean unlimited exports and ZIP on one machine) and standalone Cloud ($39/year, the complete editor plus projects, assets and settings synced through Convex). The free trial is an entry path, not a third offer.

## Why it exists

- Existing screenshot tools are recurring-cost SaaS, manual general-purpose design tools, or inflexible developer automation.
- The critical outcome is an opaque, pixel-exact 1320 × 2868 iPhone screenshot set accepted by App Store Connect.

## Domain language

| Term | Meaning |
| ---- | ------- |
| Project | One app's screenshot set, globals, shared layout layers, and up to 10 screens. |
| Screen | One ordered App Store screenshot with its own background and layers. |
| Layout layer | A layer shared across every screen in a project. |
| Device frame | An iPhone mockup containing an app screenshot; may use a generated frame or user-imported Apple bezel. |
| Asset | Binary image payload stored outside the layer graph and referenced by ID. |
| Entitlement | What an account may use: `licence` is the compatibility field for Local capabilities and `cloud` is the annual sync right. Cloud grants Local capabilities while active without requiring a Local purchase; a separate Local grant remains perpetual. Mirrored from Polar, never computed from payment history. |
| Production profile | The fixed iPhone 6.9-inch portrait output at 1320 × 2868. |

## Key features

- Layered Fabric canvas with text, device, image, shape, and background editing.
- Multi-screen project editing with templates, globals, shared layers, undo/redo, and keyboard commands.
- Local persistence plus portable project import/export.
- Validated single or batch PNG export in an organized ZIP.
- Optional account (magic link and SSO) with cloud sync of projects and assets, and self-service account deletion.
