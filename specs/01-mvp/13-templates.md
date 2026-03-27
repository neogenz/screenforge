# Task 13: Templates — Pre-Built Screenshot Layouts

## Context
Templates let users start from a professional layout instead of a blank canvas. PRD specifies 5 templates: Hero, Feature, Side-by-side, Full Bleed, and Minimal. Templates are fully editable after applying — they just pre-populate layers.

## Scope
- Define 5 template layouts as JSON configurations
- Create template picker modal/dialog
- Implement template application (creates layers from template definition)
- Generate template thumbnails for the picker

## Implementation Details

### Files to Create
- `src/assets/templates/` — template JSON definitions + thumbnail images
- `src/components/template-picker/TemplatePicker.tsx` — template gallery modal

### Template Definitions
Each template = a JSON that defines layers to create:

```typescript
interface TemplateDefinition {
  id: string
  name: string
  description: string
  thumbnail: string  // static preview image
  layers: TemplateLayer[]
  background: Background
}

interface TemplateLayer {
  type: LayerType
  // All properties needed to create the layer
  // Positions are relative (percentages) so they scale to any dimension
}
```

### 5 Templates

**1. Hero** — Large title + tilted device with screenshot
- Background: gradient (e.g., blue → purple)
- Text layer: large bold title (top 30%)
- Device frame: iPhone tilted ~15°, positioned bottom-right

**2. Feature** — Text at top + device centered below
- Background: solid dark color
- Text layer: feature headline (top 20%)
- Text layer: subtitle/description (below headline)
- Device frame: centered, bottom 60%

**3. Side-by-side** — Two devices + descriptive text
- Background: gradient
- Text layer: centered headline (top 15%)
- Device frame 1: left side, slightly smaller
- Device frame 2: right side, slightly smaller

**4. Full Bleed** — Screenshot fills entire frame, text overlay
- Background: none (screenshot IS the background)
- Image layer: full-canvas screenshot
- Gradient overlay: dark gradient at bottom (for text readability)
- Text layer: white text at bottom

**5. Minimal** — Small device + large bold text
- Background: clean solid color
- Text layer: very large bold text (left 60%)
- Device frame: small, right side

### Template Picker UI
- Modal overlay
- Grid of template thumbnails (2-3 columns)
- Template name + description below each
- Click to apply
- "Apply to current screen" or "Create new screen with template"
- Warning if current screen has content (will replace)

### Application Logic
1. User selects template
2. Clear current screen layers (or create new screen)
3. Create layers from template definition
4. Set background from template
5. Layers are fully editable after creation

## Success Criteria
- [ ] Template picker opens as modal
- [ ] All 5 templates show with thumbnails and descriptions
- [ ] Clicking a template applies it to the canvas
- [ ] Applied template has correct layers (text, device, etc.)
- [ ] All layers are fully editable after applying
- [ ] Template positions/sizes are proportional to canvas dimensions
- [ ] Can apply template to existing screen (replaces content)
- [ ] Can apply template as new screen

## Testing & Validation

### Manual Testing Steps
1. Open template picker — verify 5 templates visible
2. Apply "Hero" template — verify gradient bg, title, tilted device
3. Edit the title text — verify fully editable
4. Move the device — verify fully movable
5. Apply "Minimal" template — verify it replaces content
6. Apply to new screen — verify new screen created

### Edge Cases
- Apply template to screen with existing content (confirm dialog)
- Template with missing font (fallback gracefully)
- Apply template then undo (should restore previous state)

## Dependencies

**Must complete first**:
- Task 05: Background editor (template backgrounds use gradients)
- Task 06: Text layers (templates contain text)
- Task 07: Device frame layers (templates contain devices)
- Task 09: Layers panel (to see template layers)

**Blocks**: None

## Related Documentation
- **PRD**: Core Features §5 (Templates)
- **CLAUDE.md**: Architecture → `template-picker/`, `assets/templates/`

---
**Estimated Time**: 2.5 hours
**Phase**: Integration
