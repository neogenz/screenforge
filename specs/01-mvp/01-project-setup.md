# Task 01: Project Setup — Vite + React 19 + Tailwind v4 + Dependencies

## Context
Foundation for the entire app. Every other task depends on this. Must match PRD tech stack exactly: Vite, React 19, TypeScript, Tailwind CSS v4 (CSS-first config), Zustand, Fabric.js v6, Lucide React, idb, JSZip.

## Scope
- Scaffold Vite + React 19 + TypeScript project
- Install all dependencies from PRD tech stack
- Configure Tailwind v4 with CSS-first theming (`@theme` block)
- Set up `cn()` utility (clsx + tailwind-merge)
- Create base app shell with editor layout skeleton (toolbar, left panel, canvas area, right panel, bottom bar)
- Configure ESLint + TypeScript strict mode

## Implementation Details

### Files to Create
- `package.json` — all dependencies
- `vite.config.ts` — Vite config
- `tsconfig.json` + `tsconfig.app.json` — strict TypeScript
- `eslint.config.js` — ESLint flat config
- `index.html` — entry point
- `src/main.tsx` — React root
- `src/App.tsx` — editor layout shell (5-panel grid)
- `src/index.css` — Tailwind v4 imports + `@theme` block with design tokens
- `src/lib/utils.ts` — `cn()` helper

### Key Dependencies
```json
{
  "react": "^19",
  "react-dom": "^19",
  "fabric": "^6",
  "zustand": "^5",
  "lucide-react": "latest",
  "idb": "latest",
  "jszip": "latest",
  "clsx": "latest",
  "tailwind-merge": "latest",
  "class-variance-authority": "latest"
}
```

### Design Tokens (in `@theme`)
- Color palette in OKLCH: `--color-background`, `--color-surface`, `--color-primary`, `--color-text`, `--color-border`, `--color-muted`
- Dark mode via `@custom-variant dark`
- Spacing scale: 4px increments
- Font: system-ui default, Google Fonts loaded on-demand later

### Layout Structure
```
+------------------------------------------------------------------+
|  Toolbar (h-12, fixed top)                                       |
+----------+---------------------------------------+---------------+
|  Layers  |  Canvas Area                          |  Properties   |
|  (w-60)  |  (flex-1, bg-neutral)                 |  (w-72)       |
|          |                                       |               |
+----------+---------------------------------------+---------------+
|  Screens Bar (h-24, fixed bottom)                                |
+------------------------------------------------------------------+
```

## Success Criteria
- [ ] `npm run dev` starts without errors
- [ ] `npm run build` produces clean production build
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run lint` passes
- [ ] App renders the 5-panel layout skeleton with placeholder text in each panel
- [ ] Tailwind classes work (visible styling)
- [ ] `cn()` utility works for conditional class merging
- [ ] Dark mode toggle works via class strategy

## Testing & Validation

### Manual Testing Steps
1. Run `npm run dev`, open browser
2. Verify 5-panel layout renders correctly
3. Resize browser — layout should not break
4. Check browser console for zero errors

### Edge Cases
- Ensure Fabric.js v6 imports don't cause SSR issues (it's browser-only)
- Verify Tailwind v4 CSS-first config works (no `tailwind.config.ts`)

## Dependencies

**Must complete first**: None (this is the foundation)

**Blocks**:
- Task 02: TypeScript types
- Task 03: Zustand stores
- All subsequent tasks

## Related Documentation
- **PRD**: Tech Stack section, UI Layout section
- **CLAUDE.md**: Tailwind v4, React 19 standards

---
**Estimated Time**: 1.5 hours
**Phase**: Foundation
