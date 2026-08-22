# Project Brief

## What it is

- ScreenForge is a local-first browser editor for indie developers creating App Store iPhone and Google Play phone screenshot sets.
- It designs layered screens and exports store-ready PNG files with the whole render running in the browser.
- Two offers: Local is free with the complete editor and unlimited clean PNG/ZIP exports; Cloud is the USD 39/year managed account, synchronization, Convex storage and backup service sold through Polar as Merchant of Record.

## Why it exists

- Existing screenshot tools are recurring-cost SaaS, manual general-purpose design tools, or inflexible developer automation.
- The critical outcome is an opaque, pixel-exact set for its immutable target: App Store 1320×2868 or Google Play phone 1080×1920.

## Domain language

| Term | Meaning |
| ---- | ------- |
| Project | One app's screenshot set, immutable store target, globals, shared layout layers, and up to that target's limit. |
| Screen | One ordered store screenshot with its own background and layers. |
| Layout layer | A layer shared across every screen in a project. |
| Device frame | A target-compatible phone mockup containing an app screenshot: generated iPhone, generic Android, or a locally imported bezel. |
| Asset | Binary image payload stored outside the layer graph and referenced by ID. |
| Entitlement | The annual Cloud sync/storage right. It is recomputed server-side from the authenticated account and the Polar mirror; Local never needs one. |
| Production profile | `app-store-iphone`: 1320×2868, 10 files under `6.9/`; `google-play-phone`: 1080×1920, 8 files under `phone/`. |

## Key features

- Layered Fabric canvas with text, device, image, shape, and background editing.
- Multi-screen project editing with templates, globals, shared layers, undo/redo, and keyboard commands.
- Local persistence plus portable project import/export.
- Validated single or batch PNG export in an organized ZIP.
- Optional account (magic link and SSO) with cloud sync of projects and assets, and self-service account deletion.
