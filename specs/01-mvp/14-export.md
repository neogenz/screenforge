# Task 14: Export — Single + Batch Export at Apple Dimensions

## Context
This is the critical path — the "killer feature" per PRD. Users must export pixel-perfect PNGs at exact Apple dimensions. Batch export generates a ZIP with organized folders. Any dimension mismatch = App Store rejection, so this must be exact.

## Scope
- Implement single screen export at selected dimension
- Implement batch export (multiple screens × multiple dimensions → ZIP)
- Create export dialog UI with screen/dimension selection
- Ensure pixel-exact rendering via Fabric.js multiplier
- Generate ZIP with organized folder structure

## Implementation Details

### Files to Create
- `src/components/export-dialog/ExportDialog.tsx` — export configuration modal
- `src/hooks/use-export.ts` — export + batch logic
- `src/lib/export.ts` — canvas-to-PNG at target dimensions
- `src/lib/zip.ts` — ZIP generation via JSZip

### Export Logic (`lib/export.ts`)
```typescript
async function exportScreen(
  canvas: Canvas,  // import { Canvas } from 'fabric'
  targetWidth: number,
  targetHeight: number
): Promise<Blob> {
  // 1. Calculate multiplier from canvas working size to target size
  const multiplier = targetWidth / canvas.getWidth()

  // 2. Export at exact dimensions (prefer toBlob for large exports)
  const blob = await canvas.toBlob({
    format: 'png',
    multiplier,
    width: canvas.getWidth(),
    height: canvas.getHeight(),
  })

  // 3. Validate output dimensions match target exactly
  return blob
}
```

### Dimension Validation
- After export, verify the PNG dimensions match target EXACTLY
- Use an offscreen canvas or Image to read actual pixel dimensions
- If mismatch, throw error (never silently export wrong dimensions)

### ZIP Structure (`lib/zip.ts`)
```
export/
  6.9/
    01_hero.png
    02_feature_budget.png
  6.7/
    01_hero.png
    02_feature_budget.png
```
File names: `{index}_{screen_name_slugified}.png`

### Export Dialog UI
- **Screen selection**: checkboxes for each screen (default: all)
  - Show screen thumbnails + names
- **Dimension selection**: checkboxes for each display class
  - 6.9" (1320×2868) — checked by default
  - 6.7" (1290×2796)
  - 6.5" (1284×2778)
  - 6.3" (1206×2622)
  - 6.1" (1179×2556)
  - 5.8" (1125×2436)
  - 5.5" (1242×2208)
- **Format**: PNG (only option for MVP)
- **Export button**: shows progress bar during batch
- **Single export**: "Export current screen" quick button

### Progress Tracking
- Batch can be slow (multiple screens × dimensions)
- Show progress: "Exporting screen 3/5 at 6.9"..."
- Allow cancel

### Quality Requirements (from PRD)
- sRGB color space
- PNG-24 (8-bit RGBA)
- Target < 5 MB per file
- Zero upscaling — always render at target resolution via multiplier
- Dimensions must be pixel-exact

## Success Criteria
- [ ] Single export produces PNG at exact selected dimension
- [ ] Exported PNG dimensions are pixel-exact (verified programmatically)
- [ ] Batch export produces ZIP with correct folder structure
- [ ] ZIP contains correct files for selected screens × dimensions
- [ ] File names follow `{index}_{name}.png` pattern
- [ ] Export dialog shows all screens with checkboxes
- [ ] Export dialog shows all dimensions with checkboxes
- [ ] 6.9" dimension is checked by default
- [ ] Progress indicator during batch export
- [ ] Exported files are < 5 MB each (for typical screenshots)
- [ ] Downloads work in browser (Blob → download link)

## Testing & Validation

### Manual Testing Steps
1. Create a screen with text + device + background
2. Export single at 6.9" — open file, verify dimensions are 1320×2868
3. Export single at 6.7" — verify 1290×2796
4. Batch export 2 screens at 2 dimensions — verify ZIP structure
5. Open every exported PNG — verify content renders correctly
6. Check file sizes are reasonable (< 5 MB)

### Edge Cases
- Empty canvas export (should still produce correctly-sized PNG)
- Very complex canvas (many layers) — may be slow
- Browser memory limits with many large exports
- Cancel during batch export

## Dependencies

**Must complete first**:
- Task 02: Dimensions constants (exact pixel values)
- Task 04: Canvas wrapper (Fabric.js `toDataURL`)
- Task 11: Screens bar (screen selection needs screen list)

**Blocks**: None — this is the final output feature

## Related Documentation
- **PRD**: Core Features §7 (Export), Quality Guarantees, File Requirements
- **CLAUDE.md**: Export standards, architecture → `export-dialog/`, `lib/export.ts`, `lib/zip.ts`

---
**Estimated Time**: 3 hours
**Phase**: Core Features (Critical Path)
