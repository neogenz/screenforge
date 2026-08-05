<div align="center">

# ScreenForge

**The App Store screenshot studio for indie developers — pixel-exact, fast, local-first.**

[![Quality](https://github.com/neogenz/screenforge/actions/workflows/quality.yml/badge.svg)](https://github.com/neogenz/screenforge/actions/workflows/quality.yml)
[![Version](https://img.shields.io/badge/version-0.1.0-blue?style=flat-square)](https://github.com/neogenz/screenforge)
[![License](https://img.shields.io/badge/license-proprietary-red?style=flat-square)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev)
[![Fabric.js](https://img.shields.io/badge/Fabric.js-7-FF6B35?style=flat-square)](https://fabricjs.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![pnpm](https://img.shields.io/badge/pnpm-10-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io)

</div>

---

## Overview

ScreenForge is a local-first web app for designing and exporting iPhone App Store screenshots. Everything runs in your browser — projects are stored locally in IndexedDB, nothing ever leaves your machine. Exports are pixel-exact (1320 × 2868 for the 6.9" class) and pass App Store Connect validation out of the box.

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

## Export guarantees

- **Pixel-exact** — 1320 × 2868 px (iPhone 6.9" portrait), validated against Apple's spec
- **App Store compliant** — PNG-24, opaque, sRGB, under 5 MB per file
- **Verifiable** — `npm run validate:export -- <file.zip>` checks any export against App Store rules

## Tech stack

| Layer | Choice |
|---|---|
| Build | Vite 8 |
| UI | React 19 + TypeScript |
| Canvas | Fabric.js 7 |
| State | Zustand 5 |
| Styling | Tailwind CSS 4 (CSS-first) |
| Storage | IndexedDB via `idb` |
| Testing | Vitest + Playwright |
| Export | JSZip |

## Getting started

**Prerequisites:** Node.js 22+, pnpm 10+

```bash
pnpm install
pnpm dev
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` | Type-check + production build |
| `pnpm test` | Unit tests + typecheck + lint |
| `pnpm test:e2e` | Playwright E2E tests |
| `pnpm test:release` | Full release gate (tests, build, E2E, audits) |
| `pnpm validate:export -- <file.zip>` | Validate an exported ZIP against App Store rules |
| `pnpm audit:contrast` | Design-system contrast audit (4.5:1 minimum) |
| `pnpm audit:scale` | Spacing scale audit |
| `pnpm probe:visual` | Capture visual probes (dark/light, density 2) |

## Project structure

```
src/
  components/    UI primitives, canvas, panels, editors
  stores/        Zustand stores (canvas, project, history, ui, toast)
  hooks/         Canvas lifecycle, keyboard, export, fonts
  assets/        Device frames, templates, gradient presets
  lib/           Dimensions, storage, export, ZIP, helpers
  types/         Shared TypeScript types
```

## License

Proprietary — all rights reserved.
