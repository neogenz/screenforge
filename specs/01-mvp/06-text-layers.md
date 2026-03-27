# Task 06: Text Layers — Full Typography Controls + Google Fonts

## Context
Text is the most-used layer type. Users add headlines, descriptions, and feature callouts. PRD requires full typography control: font family (Google Fonts), size, weight, color, alignment, line height, letter spacing, shadow, gradient fill, text transform, and opacity.

## Scope
- Implement text layer creation on canvas (Fabric.js IText/Textbox)
- Create Google Fonts picker with on-demand loading
- Create text styling controls (all typography properties)
- Implement text shadow and gradient fill
- Wire text properties to canvas store

## Implementation Details

### Files to Create
- `src/components/text-editor/TextEditor.tsx` — typography control panel
- `src/hooks/use-fonts.ts` — Google Fonts API loader (on-demand)
- `src/components/text-editor/FontPicker.tsx` — searchable font family picker

### Fabric.js Text Integration
- Use `Textbox` from fabric (named import: `import { Textbox } from 'fabric'`) for multi-line text with wrapping
- Properties map:
  - `fontFamily` → `textObj.fontFamily`
  - `fontSize` → `textObj.fontSize`
  - `fontWeight` → `textObj.fontWeight`
  - `fill` → `textObj.fill` (solid color or gradient)
  - `textAlign` → `textObj.textAlign`
  - `lineHeight` → `textObj.lineHeight` (Fabric uses multiplier, not px)
  - `charSpacing` → `textObj.charSpacing` (Fabric uses 1/1000 em units)
  - `shadow` → `textObj.shadow` (use `new Shadow({ ... })` from fabric)
  - `opacity` → `textObj.opacity`

### Google Fonts Loading (`use-fonts`)
- Fetch font list from Google Fonts API (cache in memory)
- Load font on-demand when selected: inject `<link>` or use `FontFace` API
- Show font preview in picker using the font itself
- Popular fonts pinned at top: Inter, Roboto, Open Sans, Montserrat, Poppins, Playfair Display, etc.

### Text Editor Controls
- Font family: searchable dropdown with preview
- Font size: numeric input + drag-to-adjust
- Font weight: dropdown or slider (100–900)
- Color: reuse ColorPicker from Task 05
- Alignment: 3-button group (left/center/right)
- Line height: numeric input
- Letter spacing: numeric input
- Text transform: dropdown (none/uppercase/lowercase/capitalize)
- Text shadow: toggle + offset X/Y, blur radius, color
- Gradient fill: toggle + reuse GradientEditor from Task 05
- Opacity: slider 0–100%

### Adding Text to Canvas
- Click "Add Text" → creates new Textbox at canvas center
- Default text: "Your text here"
- Default font: project globals font or Inter 48px bold

## Success Criteria
- [ ] Can add text layer to canvas
- [ ] Text is editable inline (double-click to edit on canvas)
- [ ] Can change font family — font loads from Google Fonts and applies
- [ ] Font picker shows font preview in the font itself
- [ ] Font size, weight, color, alignment all update live on canvas
- [ ] Line height and letter spacing adjust correctly
- [ ] Text shadow renders on canvas when enabled
- [ ] Gradient fill renders on text when enabled
- [ ] Text transform (uppercase etc.) applies
- [ ] Opacity slider works
- [ ] Text properties persist in canvas store

## Testing & Validation

### Manual Testing Steps
1. Add text layer — verify it appears centered
2. Double-click to edit inline — type new text
3. Change font to "Playfair Display" — verify it loads and applies
4. Adjust size to 72px — verify
5. Set alignment to right — verify
6. Enable shadow — verify visual
7. Enable gradient fill — verify
8. Set text transform to uppercase — verify

### Edge Cases
- Font that fails to load (fallback to system font)
- Very long text (should wrap in Textbox)
- Font weight not available for selected font (use closest available)
- Zero letter spacing vs negative letter spacing

## Dependencies

**Must complete first**:
- Task 04: Canvas wrapper
- Task 05: Color picker + gradient editor (reused for text color/fill)

**Blocks**:
- Task 08: Properties panel (text properties section)

## Related Documentation
- **PRD**: Core Features §1 (Text layer), §2 (Text Styling)
- **CLAUDE.md**: Architecture → `text-editor/`, `use-fonts.ts`

---
**Estimated Time**: 3 hours
**Phase**: Core Features
