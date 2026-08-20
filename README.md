<div align="center">

# ScreenForge

**The App Store screenshot studio for indie developers — pixel-exact and local-first.**

[![Quality](https://github.com/neogenz/screenforge/actions/workflows/quality.yml/badge.svg)](https://github.com/neogenz/screenforge/actions/workflows/quality.yml)
[![Version](https://img.shields.io/badge/version-0.1.0-blue?style=flat-square)](https://github.com/neogenz/screenforge)
[![License](https://img.shields.io/badge/license-AGPL--3.0--or--later-blue?style=flat-square)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev)
[![Fabric.js](https://img.shields.io/badge/Fabric.js-7-FF6B35?style=flat-square)](https://fabricjs.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![pnpm](https://img.shields.io/badge/pnpm-10-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io)

</div>

---

## Overview

ScreenForge is a local-first web app for designing and exporting iPhone App Store screenshots. Local is free: the complete editor, unlimited clean exports and ZIPs run in the browser with projects in IndexedDB. The optional paid Cloud service adds an account, synchronization, managed storage and backups for projects, source images and settings.

Local never requires Convex, a connection, an account or an entitlement. Cloud writes are authorized by the Convex backend from the authenticated session and an active server-side Cloud entitlement; changing or rebuilding the frontend cannot grant that access.

See [CLOUD.md](CLOUD.md) for the operated Cloud architecture and a concrete
walkthrough of the Resend, Polar, Convex and synchronization flows.

## Features

- **Real-time canvas editor** — Fabric.js-powered, with snapping guides, precise transforms and a floating selection toolbar
- **Official iPhone device frames** — current models and colors, ready to drop your screenshots into
- **Templates & gradients** — curated starting points to ship a coherent screenshot set in minutes
- **Typography** — Google Fonts loaded on demand, full text styling controls
- **Batch export** — one click, App Store-ready ZIP
- **Undo/redo** — full history with smart burst coalescing
- **Command palette** — every action at ⌘K
- **Autosave** — projects persisted locally via IndexedDB
- **Dark & light themes** — true-neutral OKLCH design system

## Plans

| Plan      | Price         | Included                                                                  |
| --------- | ------------- | ------------------------------------------------------------------------- |
| **Local** | Free          | Complete editor, unlimited clean PNG/ZIP exports, local projects/assets   |
| **Cloud** | USD 39 / year | Everything in Local plus account, sync, Convex storage and managed backup |

## Export guarantees

- **Pixel-exact** — 1320 × 2868 px (iPhone 6.9" portrait), validated against Apple's spec
- **App Store compliant** — PNG-24, opaque, sRGB, under 5 MB per file
- **Verifiable** — `npm run validate:export -- <file.zip>` checks any export against App Store rules

## Tech stack

| Layer   | Choice                     |
| ------- | -------------------------- |
| Build   | Vite 8                     |
| UI      | React 19 + TypeScript      |
| Canvas  | Fabric.js 7                |
| State   | Zustand 5                  |
| Styling | Tailwind CSS 4 (CSS-first) |
| Storage | IndexedDB via `idb`        |
| Cloud   | Convex (optional service)  |
| Testing | Vitest + Playwright        |
| Export  | JSZip                      |

## Getting started

**Prerequisites:** Node.js 24, pnpm 10

```bash
pnpm install
pnpm dev
```

No environment variable or backend is needed for Local. Copy `.env.example` only when working on the operated Cloud service; never commit a real `.env` file.

Before contributing, install the pinned official Gitleaks binary with
`pnpm run setup:gitleaks`. The pre-commit hook scans forbidden filenames, the
staged diff and AIDD documents before formatting. Secrets belong only in the
GitHub, Convex, Vercel, Polar or Resend secret store that consumes them;
`.private/` is available for sensitive local notes and is ignored by Git.

## Scripts

| Command                              | Description                                       |
| ------------------------------------ | ------------------------------------------------- |
| `pnpm dev`                           | Start the dev server                              |
| `pnpm build`                         | Type-check + production build                     |
| `pnpm test`                          | Unit tests + typecheck + lint                     |
| `pnpm test:e2e`                      | E2E local; omits cloud when Convex is stopped     |
| `pnpm test:e2e:release`              | E2E strict; starts Convex and forbids cloud skips |
| `pnpm test:release`                  | Full strict gate (tests, builds, E2E, audits)     |
| `pnpm test:release-tag`              | Self-test the canonical SemVer tag contract       |
| `pnpm verify:release-tag vX.Y.Z`     | Match a release tag to the root package version   |
| `pnpm validate:export -- <file.zip>` | Validate an exported ZIP against App Store rules  |
| `pnpm audit:contrast`                | Design-system contrast audit (4.5:1 minimum)      |
| `pnpm audit:dependencies`            | Fail on any known dependency vulnerability        |
| `pnpm audit:scale`                   | Spacing scale audit                               |
| `pnpm audit:publication`             | Audit tracked files and public AIDD content       |
| `pnpm probe:visual`                  | Capture visual probes (dark/light, density 2)     |

## Project structure

```
apps/
  web/       React editor and bilingual landing page
  backend/   Convex auth, entitlements, sync, storage and billing boundary
  bridge/    Optional loopback-only local publishing bridge
scripts/     Release, security and export audits
aidd_docs/   Versioned plans and project memory; secrets are forbidden here
```

## Releases

Production is released only from an immutable `vMAJOR.MINOR.PATCH` tag created
by the approved Release Please pull request. A tag first runs the complete
release gate without production secrets, then builds a staged Vercel candidate,
deploys the compatible Convex backend, smoke-tests the candidate and promotes
the same build. See [RELEASING.md](RELEASING.md) for the operator runbook.

## License

Copyright © 2026 Maxime De Sogus.

ScreenForge is free software licensed under the
[GNU Affero General Public License v3.0 or later](LICENSE). You may run,
study, modify and redistribute it under that licence. A modified version
offered over a network must make its corresponding source available to its
users. The managed ScreenForge Cloud subscription pays for the operated
account, synchronization, storage and backups; it does not restrict Local.

Third-party works redistributed in this repository keep their own licence and
notices: see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
