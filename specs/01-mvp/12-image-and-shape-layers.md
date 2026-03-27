# Task 12: Image & Shape Layers

## Context
PRD requires image layers (import PNG/JPEG/SVG, crop, resize, opacity, shadow) and shape layers (rectangle, circle, rounded rect with fill, stroke, gradient, shadow). These complement text and device frames to give users full creative control.

## Scope
- Implement image layer: import files, display on canvas, resize, opacity, shadow
- Implement shape layer: rectangle, circle, rounded rect with fill/stroke/gradient/shadow
- Create shape picker (type + options)
- Wire to canvas store

## Implementation Details

### Image Layer
- Import via file picker or drag & drop onto canvas
- Supported formats: PNG, JPEG, SVG
- Use `FabricImage.fromURL()` for raster, `loadSVGFromString()` for SVG (named imports from fabric)
- Controls: resize (maintain aspect with Shift), opacity, drop shadow
- Store image data as base64 in layer state (for persistence)

### Shape Layer
- Types: rectangle, circle, rounded rectangle
- Rectangle: `new Rect({ ... })`
- Circle: `new Circle({ ... })`
- Rounded rect: `new Rect({ rx, ry, ... })`

### Shape Properties (in properties panel)
- Fill: solid color or gradient (reuse ColorPicker/GradientEditor)
- Stroke: color + width
- Border radius (for rounded rect): numeric input
- Shadow: toggle + blur, color, offset
- Opacity: slider

### Files to Create/Modify
- `src/components/canvas/ImageLayerHandler.ts` — image import + Fabric object creation
- `src/components/canvas/ShapeLayerHandler.ts` — shape creation helpers
- `src/components/properties-panel/ImageSection.tsx` — image controls (if not done in Task 08)
- `src/components/properties-panel/ShapeSection.tsx` — shape controls (if not done in Task 08)

### Adding Layers
- Image: "Add Image" button in layers panel → file dialog → place at center
- Shape: "Add Shape" button → dropdown (rect/circle/rounded rect) → place at center
- Default shape: 200×200 blue rectangle

## Success Criteria
- [ ] Can import PNG/JPEG image and display on canvas
- [ ] Can import SVG and display on canvas
- [ ] Image respects opacity and shadow controls
- [ ] Can add rectangle, circle, rounded rectangle shapes
- [ ] Shape fill works with solid color and gradient
- [ ] Shape stroke works (color + width)
- [ ] Rounded rect border radius adjusts
- [ ] Shadow works on shapes
- [ ] All layer data persists in canvas store
- [ ] Image data persists (base64) for save/load

## Testing & Validation

### Manual Testing Steps
1. Import a PNG — verify it appears on canvas
2. Resize image with Shift held — verify aspect ratio locked
3. Adjust image opacity — verify
4. Add rectangle — verify it appears
5. Change fill to gradient — verify
6. Add stroke — verify
7. Change to circle — verify
8. Adjust rounded rect radius — verify

### Edge Cases
- Very large image files (should still work, just larger base64)
- SVG with embedded fonts or external references
- Shape with zero stroke width (no stroke)
- Transparent fill on shapes

## Dependencies

**Must complete first**:
- Task 04: Canvas wrapper
- Task 05: Color picker + gradient editor (reused for fill/stroke)

**Blocks**: None

## Related Documentation
- **PRD**: Core Features §1 (Image layer, Shape layer)
- **CLAUDE.md**: Architecture → canvas components

---
**Estimated Time**: 2 hours
**Phase**: Core Features
