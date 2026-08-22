# PRD — ScreenForge

> Local-first web app for designing and exporting iPhone, iPad, and Apple Watch App Store screenshots.
> Local is free; the operated Cloud sync and storage service is paid.

---

## Problem

Creating App Store screenshots requires either:

- **Paid SaaS** (AppScreens.com ~$15/mo, Previewed, Screenshots.pro) for basic drag & drop
- **Figma/Sketch** — manual, no batch export at exact Apple dimensions
- **Xcode screenshot automation** — developer-only, no design flexibility

None respect indie devs' time or budget.

## Solution

A **local-first web app** (Vite + React + Fabric.js) running in the browser. ScreenForge exports App Store-ready portrait PNGs for one immutable iPhone, iPad, or Apple Watch profile per project.

## Product model

- **Local — free:** complete editor, unlimited clean PNG and ZIP exports, projects and assets stored in IndexedDB, no account, connection, Convex deployment or entitlement required.
- **Cloud — USD 39/year:** everything in Local plus customer account, synchronization, projects, source images and settings stored in Convex, and managed backups.
- Local contains no artificial paywall. Every Cloud write derives the user from the authenticated server session and requires an active server-side Cloud entitlement.

---

## Scope

**iPhone, iPad, and Apple Watch portrait screenshots.** No landscape iPad, Mac, Apple TV, or Vision Pro output.

---

## Apple App Store Screenshot Specifications

### iPhone and iPad primary targets

ScreenForge produces the largest portrait target selected for iPhone or iPad and relies on App Store Connect for the supported smaller-size scaling paths. Optional and historical iPad targets are intentionally omitted.

### Production profiles

| ScreenForge profile   | Platform                 |     Dimensions | App Store Connect type  |
| --------------------- | ------------------------ | -------------: | ----------------------- |
| `iphone-6.9`          | iPhone 6.9-inch portrait | 1320 × 2868 px | `APP_IPHONE_69`         |
| `ipad-13`             | iPad 13-inch portrait    | 2064 × 2752 px | `APP_IPAD_PRO_3GEN_129` |
| `watch-ultra-422x514` | Apple Watch Ultra        |   422 × 514 px | `APP_WATCH_ULTRA`       |
| `watch-ultra-410x502` | Apple Watch Ultra        |   410 × 502 px | `APP_WATCH_ULTRA`       |
| `watch-series-10`     | Apple Watch Series 10    |   416 × 496 px | `APP_WATCH_SERIES_10`   |
| `watch-series-7`      | Apple Watch Series 7     |   396 × 484 px | `APP_WATCH_SERIES_7`    |
| `watch-series-4`      | Apple Watch Series 4     |   368 × 448 px | `APP_WATCH_SERIES_4`    |
| `watch-series-3`      | Apple Watch Series 3     |   312 × 390 px | `APP_WATCH_SERIES_3`    |

All profiles are portrait and allow 1–10 screenshots. A project chooses exactly one profile at creation; every screen, template, release snapshot, validation result, and export in that project keeps it. Projects created before the profile field existed migrate to `iphone-6.9` without changing layer coordinates.

Sources: [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/) and [upload/scaling guidance](https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots/).

### File Requirements

| Spec                | Requirement                                               |
| ------------------- | --------------------------------------------------------- |
| **Format**          | PNG (recommended) or JPEG                                 |
| **Color space**     | sRGB (recommended) or Display P3                          |
| **Bit depth**       | 8-bit RGB                                                 |
| **Transparency**    | Forbidden; every exported PNG is opaque                   |
| **Max file size**   | 50 MB per screenshot (aim for < 5 MB)                     |
| **Min screenshots** | 1                                                         |
| **Max screenshots** | 10 per device class                                       |
| **Aspect ratio**    | Must match EXACTLY — off by even a few pixels = rejection |

### Design Rules (Apple Review Guidelines + rejection data)

| Rule                      | Detail                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Accuracy**              | Screenshots must show REAL app functionality. Fabricated data = rejection (Guideline 2.3.7)             |
| **Status bar**            | Include it — shows realistic context                                                                    |
| **Device frames**         | Allowed and encouraged. Use a current generated frame or a current Apple Product Bezel imported locally |
| **Text overlays**         | Allowed. Must be accurate. No hyperbolic claims ("best app ever")                                       |
| **Language**              | Text must match a language your app actually supports                                                   |
| **No ratings/badges**     | Don't show App Store ratings or award badges                                                            |
| **No misleading content** | Don't show features behind paywalls without indicating cost                                             |
| **Consistent design**     | All screenshots should share a coherent design language                                                 |
| **No upscaled images**    | Blurry / upscaled screenshots get rejected                                                              |

### Common Rejection Reasons (sourced from r/iOSProgramming, Apple Developer Forums, 2024-2026)

1. **Guideline 2.3.7** — Screenshots don't match actual app functionality
2. **Dimension mismatch** — Wrong pixel dimensions for the declared device class
3. **Misleading features** — Showing features that don't exist or are paywalled
4. **Outdated screenshots** — Don't reflect current app version
5. **Language mismatch** — Text in screenshot doesn't match app's supported localizations
6. **Fabricated data** — Fake balances, fake reviews, unrealistic content

---

## Core Features

### 1. Canvas Editor

Layer-based design surface:

| Layer Type       | Capabilities                                                                                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Text**         | Font family, size, weight, color, alignment, line height, letter spacing, shadow, gradient fill                                                                      |
| **Device Frame** | Platform-compatible mockup with screenshot inside. Original built-in frames rotate freely; imported Apple bezels keep their official orientation and scale uniformly |
| **Image**        | Import PNG/JPEG/SVG, crop, resize, opacity, shadow                                                                                                                   |
| **Shape**        | Rectangle, circle, rounded rect — fill, stroke, gradient, shadow                                                                                                     |
| **Background**   | Solid color, linear/radial gradient, image fill                                                                                                                      |

**Interactions:**

- Drag & drop repositioning
- Resize handles (aspect ratio lock via Shift)
- Rotation
- Multi-select + group
- Layer reordering (front/back)
- Snap-to-grid + smart guides
- Undo/Redo (Cmd+Z / Cmd+Shift+Z)
- Copy/paste layers (Cmd+C / Cmd+V)
- Zoom (Cmd+scroll, pinch)
- Delete layer (Backspace/Delete)

### 2. Text Styling

- **Font family** — system fonts + Google Fonts picker (on-demand loading)
- **Font size** — numeric input, drag to adjust
- **Font weight** — 100-900 slider
- **Color** — solid color picker + gradient fill option
- **Alignment** — left, center, right
- **Line height** — numeric
- **Letter spacing** — numeric
- **Text shadow** — toggle + offset, blur, color
- **Text transform** — uppercase, lowercase, capitalize, none
- **Opacity** — 0-100%

### 3. Background Designer

- **Solid color** — color picker with hex/rgb input
- **Linear gradient** — angle control + unlimited color stops
- **Radial gradient** — center point + color stops
- **Preset gradients** — curated collection (20+) for quick start
- **Image background** — import + opacity/blur/fit

### 4. Device Frames

Built-in mockups are filtered by the project's immutable platform:

| Platform    | Built-in catalogue                                                  |
| ----------- | ------------------------------------------------------------------- |
| iPhone      | Current generated iPhone catalogue plus legacy render compatibility |
| iPad        | Two original, neutral tablet silhouettes: Ardoise and Studio        |
| Apple Watch | Two original, neutral watch silhouettes: Halo and Compacte          |

[Apple Design Resources](https://developer.apple.com/design/resources/) and Product Bezels are optional user-provided files. The user obtains them directly from Apple and accepts the [Apple Design Resources License](https://developer.apple.com/support/downloads/terms/apple-design-resources/Apple-Design-Resources-License-20230621-English.pdf) before local import. ScreenForge stores them only in the current project's local IndexedDB assets. No Apple PNG, PSD, DMG, UI kit, or derived asset is downloaded, bundled, hosted, or redistributed by ScreenForge.

**Controls:**

- Device color variant (Silver, Black, Natural Titanium, etc.)
- Orientation (portrait / landscape)
- Sizing (contain / cover / fit)
- Position (top / middle / bottom / custom drag)
- Shadow (drop shadow with color, blur, offset)
- Screenshot slot (drag & drop or file picker to insert the actual app screenshot)

### 5. Templates

Pre-built layouts:

| Template         | Description                                           |
| ---------------- | ----------------------------------------------------- |
| **Hero**         | Large title + tilted device with screenshot           |
| **Feature**      | Text at top + device centered below                   |
| **Side-by-side** | Two devices + descriptive text                        |
| **Full bleed**   | Screenshot fills entire frame, text overlay at bottom |
| **Minimal**      | Small device + large bold text                        |

Fully editable after applying.

### 6. Project Management

- **Project** = one app and one immutable App Store profile. Contains up to 10 screens (App Store max).
- **Screens** = ordered list, thumbnails at bottom
- **Duplicate screen** — copy as starting point
- **Globals** — shared settings across all screens:
  - Default font family + weight + color
  - Default background
  - Default device type + color variant
- Globals propagate to new screens. Existing screens can override.

### 7. Export

**Single export:**

- Current screen as an opaque portrait PNG at the project's exact profile dimensions

**Batch export (the killer feature):**

- Select screens (checkboxes, default: all)
- Fixed target: the project's immutable iPhone, iPad, or Apple Watch portrait profile
- Format: PNG (default)
- Output: ZIP with organized folders

**Output structure:**

```
watch-series-10/
  01_hero.png
  02_feature_budget.png
  03_feature_year.png
  04_feature_templates.png
  05_feature_expense.png
```

**Quality guarantees:**

- Renders at exact target resolution via Fabric.js `multiplier` / `toBlob()` — zero upscaling
- sRGB color space
- PNG-24 (8-bit RGB, no alpha channel)
- Optimized to < 5 MB per file
- Dimensions are pixel-exact — tested against Apple's accepted values

---

## Tech Stack

| Layer       | Choice                                             | Why                                                                              |
| ----------- | -------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Build**   | Vite                                               | Fast HMR, zero config                                                            |
| **UI**      | React 19 + TypeScript                              | Best ecosystem for canvas editors                                                |
| **Canvas**  | Fabric.js v7                                       | IText, drag/resize/rotate, groups, high-DPI export, `toBlob()` for large exports |
| **State**   | Zustand                                            | Lightweight, undo/redo via history middleware                                    |
| **Styling** | Tailwind CSS v4                                    | Rapid UI for editor panels                                                       |
| **Storage** | IndexedDB (via idb)                                | Local is complete without a backend                                              |
| **Cloud**   | Convex                                             | Authenticated sync, managed storage, entitlements and billing boundary           |
| **Fonts**   | Google Fonts API                                   | On-demand font loading                                                           |
| **Icons**   | Lucide React                                       | Clean icon set                                                                   |
| **Export**  | Fabric.js `toDataURL({ multiplier })` / `toBlob()` | Pixel-perfect at any resolution, `toBlob()` preferred for large exports          |
| **ZIP**     | JSZip                                              | Client-side ZIP for batch export                                                 |

### Not Angular

Standalone tool, not part of Pulpe. React has better canvas editor ecosystem.

### Not Electron

Web-first on localhost. Electron later if needed.

---

## Architecture

```
src/
  components/
    canvas/              # Fabric.js canvas wrapper + interactions
    toolbar/             # Top bar: save, undo, redo, zoom, export
    layers-panel/        # Left: layer list, reorder, visibility
    properties-panel/    # Right: selected layer properties
    screens-bar/         # Bottom: screen thumbnails
    background-editor/   # Background config
    device-picker/       # Device selection + config
    text-editor/         # Typography controls
    template-picker/     # Template gallery modal
    export-dialog/       # Export config + batch
    color-picker/        # Reusable color + gradient picker
    gradient-editor/     # Color stop editor
  stores/
    canvas.store.ts      # Layers, selection, active screen
    project.store.ts     # Project metadata, screens, globals
    history.store.ts     # Undo/redo command stack
    ui.store.ts          # Panel states, zoom, active tool
  hooks/
    use-canvas.ts        # Fabric.js lifecycle + events
    use-keyboard.ts      # Shortcut handling
    use-export.ts        # Export + batch logic
    use-fonts.ts         # Google Fonts loader
  assets/
    device-frames/       # Original generated frames, catalogued by platform
    templates/           # Template definitions (JSON + thumbnail)
    gradients.ts         # Preset gradient definitions
  lib/
    dimensions.ts        # Closed App Store profile catalogue and exact targets
    storage.ts           # IndexedDB read/write
    export.ts            # Canvas-to-PNG at target dimensions
    zip.ts               # ZIP generation
  types/
    index.ts             # Layer, Screen, Project, ExportConfig types
```

---

## UI Layout

```
+------------------------------------------------------------------+
|  [Save] [Undo] [Redo]  |  Globals  Background  Export   | Zoom % |
+----------+---------------------------------------+---------------+
|          |                                       |               |
|  Layers  |                                       |  Properties   |
|          |         Canvas                        |               |
|  [+] Add |         (design surface)              |  [Text]       |
|          |                                       |  Font: Inter  |
|  > Title |                                       |  Size: 48     |
|  > Device|                                       |  Weight: 700  |
|  > BG    |                                       |  Color: #1a1a |
|          |                                       |  Align: center|
|          |                                       |               |
+----------+---------------------------------------+---------------+
|  [1]  [2]  [3]  [4]  [5]  [+]                                   |
+------------------------------------------------------------------+
     ^ screen thumbnails (click to switch, drag to reorder)
```

---

## MVP Scope

**In:**

- Canvas editor with text, device frame, image, shape, background layers
- Full text styling (Google Fonts, size, weight, color, shadow, gradient)
- Background designer (solid + gradients + presets)
- Generated platform-compatible frames, including two original iPad and two original Watch designs, plus local import of user-provided Apple Product Bezel PNGs
- Platform-compatible pre-built templates, including one iPad and one Apple Watch composition
- Batch export at the selected profile's exact dimensions (opaque PNG, ZIP)
- Project autosave/load (IndexedDB) + portable `.screenforge.zip` backup/import
- Globals (shared font, background, device across screens)
- Undo/redo + keyboard shortcuts

**Out (v2):**

- Localization / multi-language batch export
- Older iPhone frames (15, 14, SE)
- Image backgrounds with blur
- Real-time multi-user collaboration
- JPEG export
- App Preview video poster frames

---

## Success Criteria

1. Reproduce the 5 Pulpe App Store screenshots in < 30 minutes
2. Exported PNGs pass App Store Connect upload without rejection
3. Dimensions are pixel-exact for every supported iPhone, iPad, and Apple Watch profile
4. Text rendering matches AppScreens.com quality
5. Local works with zero Convex calls and retains every editor/export capability
6. Projects persist across browser sessions and reopen from a portable local backup
7. No client-side falsification can authorize a Cloud write

---

## Open Questions (resolved)

| Question             | Decision                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Device frame assets? | Keep generated SVG fallbacks; official Apple PNGs are supplied and stored locally by each user, never bundled         |
| Font loading?        | On-demand via Google Fonts API with preview picker                                                                    |
| Project format?      | IndexedDB for autosave; versioned `.screenforge.zip` with `project.json` and referenced binary assets for portability |
