# Project Brief

## What it is

- ScreenForge is a local-first browser editor for indie developers creating App Store iPhone, iPad and Apple Watch or Google Play phone screenshot sets.
- It designs layered screens and exports store-ready PNG files with the whole render running in the browser.
- Two offers: Local is free with the complete editor and unlimited clean PNG/ZIP exports; Cloud is the USD 39/year managed account, synchronization, Convex storage and backup service sold through Polar as Merchant of Record.

## Why it exists

- Existing screenshot tools are recurring-cost SaaS, manual general-purpose design tools, or inflexible developer automation.
- The critical outcome is an opaque, pixel-exact set for its immutable target: one of eight App Store dimensions or Google Play phone 1080×1920.

## Domain language

| Term | Meaning |
| ---- | ------- |
| Project | One app's screenshot set, one immutable store target, globals, shared layout layers, and up to that target's limit. |
| Screen | One ordered store screenshot with its own background and layers. |
| Layout layer | A layer shared across every screen in a project. |
| Device frame | A target-compatible phone, tablet, or watch mockup containing an app screenshot; may use an original generated frame or a user-imported Apple bezel. |
| Asset | Binary image payload stored outside the layer graph and referenced by ID. |
| Entitlement | The annual Cloud sync/storage right. It is recomputed server-side from the authenticated account and the Polar mirror; Local never needs one. |
| Locale variant | One store language of a project: the same layers with translated text, measured for overflow before export. |
| Release | A frozen, rendered batch of screenshots. Publication consumes a release, never the live project. |
| Store target | The immutable project destination: iPhone 6.9-inch, iPad 13-inch, one of six Apple Watch portrait dimensions, or Google Play phone. It drives board ratio, compatible frames/templates, limits, validation, release, and export. |

## Key features

- Layered Fabric canvas with text, device, image, shape, and background editing.
- Multi-screen project editing with templates, globals, shared layers, undo/redo, and keyboard commands.
- Local persistence plus portable project import/export.
- Validated single or batch PNG export in an organized ZIP.
- Platform-compatible built-in templates and original frames; licensed Apple resources are obtained from Apple and imported locally, never bundled or redistributed.
- Locale variants of a project with text measurement and overflow findings before export.
- Frozen releases: render once, verify, diff against the live project, restore or publish to App Store Connect through the optional local bridge.
- Optional agent authoring: an MCP daemon lets a coding agent compose screens in the running editor. Copy can also come from a local Claude Code, a bring-your-own-key provider, or the built-in deterministic builder — the default, which sends nothing anywhere.
- Optional account (magic link and SSO) with cloud sync of projects and assets, and self-service account deletion.
- Optional EU-hosted analytics and diagnostics, off until consented.
