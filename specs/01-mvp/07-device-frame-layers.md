# Task 07: Device Frame Layers — iPhone Mockups + Screenshot Slot

## Context
Device frames are the signature feature — users place iPhone mockups with their app screenshots inside. PRD requires 3 iPhone models for MVP (16 Pro Max, 16 Pro, 16) with color variants, orientation control, and a screenshot slot where users drop their actual app screenshots.

## Scope
- Create/source iPhone SVG frame assets (3 models × color variants)
- Implement device frame layer on Fabric.js canvas (SVG frame + image slot)
- Create device picker UI (model, color, orientation)
- Implement screenshot slot (drag & drop or file picker to insert screenshot into frame)
- Device frame controls: scale, position, rotation, shadow

## Implementation Details

### Files to Create
- `src/assets/device-frames/` — SVG files for each device + color
- `src/components/device-picker/DevicePicker.tsx` — device selection UI
- `src/components/canvas/DeviceFrameObject.ts` — custom Fabric.js object or group for device frame

### Device Assets Required
| Device | Colors |
|---|---|
| iPhone 16 Pro Max | Natural Titanium, Black Titanium, White Titanium, Desert Titanium |
| iPhone 16 Pro | Natural Titanium, Black Titanium, White Titanium, Desert Titanium |
| iPhone 16 | Black, White, Pink, Teal, Ultramarine |

Each SVG should:
- Be a flat vector frame (no raster images)
- Have a clearly defined inner screen area (for screenshot placement)
- Support both portrait and landscape orientation (or rotate programmatically)

### Canvas Integration
- Device frame = Fabric.js Group containing:
  1. Frame SVG (loaded via `loadSVGFromURL()` or `FabricImage.fromURL()` — named imports from fabric)
  2. Screenshot image (clipped to screen area)
- Screenshot insertion:
  - User drops image → clip to inner screen rect
  - Scale to fit/cover the screen area
  - Maintain aspect ratio

### Device Picker Controls
- Model dropdown: iPhone 16 Pro Max / 16 Pro / 16
- Color variant: visual swatches
- Orientation: portrait / landscape toggle
- Screenshot: file input or drag & drop zone
- Shadow: toggle + blur, color, offset controls
- Position presets: top / middle / bottom / custom

### Adding Device to Canvas
- Click device model → creates frame at canvas center
- Default: portrait, no screenshot, medium shadow

## Success Criteria
- [ ] 3 iPhone models render as SVG frames on canvas
- [ ] Can switch between color variants — frame updates
- [ ] Can toggle portrait/landscape orientation
- [ ] Can insert a screenshot into the device frame (file picker)
- [ ] Screenshot clips to the screen area of the frame
- [ ] Can drag, resize, and rotate the entire device frame
- [ ] Shadow control works (toggle, blur, color)
- [ ] Device frame data persists in canvas store
- [ ] Multiple device frames can coexist on one canvas

## Testing & Validation

### Manual Testing Steps
1. Add iPhone 16 Pro Max — verify frame renders
2. Switch to Black Titanium — verify color change
3. Toggle to landscape — verify rotation
4. Insert screenshot via file picker — verify it clips to screen
5. Drag and resize the device — verify it works as a unit
6. Add second device — verify both work independently

### Edge Cases
- Screenshot aspect ratio doesn't match device screen ratio (scale to cover, crop)
- Very large screenshot file (> 10 MB image)
- SVG loading failure (show placeholder)
- Rotating a device with screenshot inside

## Dependencies

**Must complete first**:
- Task 04: Canvas wrapper

**Blocks**:
- Task 08: Properties panel (device frame properties section)
- Task 13: Templates (use device frames)

## Related Documentation
- **PRD**: Core Features §4 (Device Frames)
- **CLAUDE.md**: Architecture → `device-picker/`, `assets/device-frames/`

---
**Estimated Time**: 3 hours
**Phase**: Core Features
