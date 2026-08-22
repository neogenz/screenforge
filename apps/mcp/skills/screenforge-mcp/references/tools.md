# Tools

The 19 tools the ScreenForge MCP server publishes, copied on 2026-08-16 from
`@screenforge/project-format` 0.1.0.

The schemas below are a dated copy. The server is authoritative: it builds every
schema from `packages/project-format/src/ai-tools.ts` and closes every
enumeration on `packages/project-format/src/catalog-ids.ts`, and the browser
revalidates each call against that same object on arrival. `node
scripts/mcp-live-probe.mjs` speaks real JSON-RPC to the real binary and prints
what it actually publishes; `apps/mcp/src/skill-doc.test.ts` fails when a
registered tool is missing from this file.

Every name below carries the `screenforge_` prefix, because an agent sees the
tools of all its servers flat.

## The board

| Fact                   | Value                                                            |
| ---------------------- | ---------------------------------------------------------------- |
| Artboard               | 440 wide by 956 tall, in board units                             |
| Export                 | 1320 by 2868, derived, never addressed by a call                 |
| Coordinates `x` `y`    | -440 to 880, so a layer may overflow the board but not escape it |
| Sizes `width` `height` | 4 to 1912                                                        |
| `rotation`             | -360 to 360 degrees, around the layer centre                     |
| `opacity`              | 0 to 1                                                           |
| Colours                | `#rrggbb` exactly, six hex digits, no shorthand and no alpha     |
| Screens per project    | 10                                                               |
| Layers per screen      | 24                                                               |
| Calls per batch        | 200                                                              |

## Reading

| Tool                | Arguments                                                | Returns                                                                 |
| ------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `get_project_state` | none                                                     | name, canvas, globals, every screen with its layers, layout layers      |
| `get_screen`        | `screenId` required                                      | one screen, its rank, its background, its layers                        |
| `get_thumbnail`     | `screenId` optional, `maxWidth` 200 to 1320, default 640 | a measured report, then a PNG image block                               |
| `list_templates`    | none                                                     | id, name, description, source, layerCount, createdAt per saved template |

A layer read back carries `id`, `type`, `name`, `x`, `y`, `width`, `height`,
`visible`, `locked`, plus `content` on a text and `slot` with `hasScreenshot` on
a device frame. Image bytes never come back this way. `hasScreenshot` is a
boolean, and `get_thumbnail` is the only tool that returns pixels.

### What `get_thumbnail` measures

The first block is the screen id and size, then either "Aucun défaut mesuré sur
cette planche." or one line per defect, each naming its layer and its number.
The image follows. Read the report **before** looking at the image: a PNG shows
clipped text, which looks like a choice, and it cannot show you that a 215 px
box is holding five lines.

| Measure        | Threshold                                                   |
| -------------- | ----------------------------------------------------------- |
| Text overflow  | measured height above the layer's own `height`              |
| Off-board text | a text box leaving 440 by 956, on any side                  |
| Cropped device | under 70 % of the device frame on the board                 |
| Contrast       | under 4.5:1 against **every** stop of the screen background |
| Overlap        | two **text** layers whose boxes intersect                   |
| Empty band     | over a quarter of the board's height with nothing in it     |

These are the rules the repository's own generator holds itself to, minus one
notch on the device: it composes at 90 %, and 70 % is where a frame stops being
tightly cropped and starts being truncated.

Two things it deliberately does not flag, because both are legitimate
composition: a shape sitting under a headline, and a decorative accent bleeding
off the edge. Nothing here is an error — the tool is read-only and states what
it measured. A composition that overflows on purpose is yours to keep.

## Writing

`apply` is the entry point for all of these. Each also exists as a standalone
tool, useful for a single correction and wasteful for anything else.

| Tool                     | Required                                | Optional                                                                                                           |
| ------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `apply`                  | `calls`                                 | —                                                                                                                  |
| `declare_plan`           | `screens`                               | `summary` up to 400 chars                                                                                          |
| `add_screen`             | —                                       | `name` up to 60 chars                                                                                              |
| `set_background`         | `background`                            | `screenId`                                                                                                         |
| `add_text`               | `content` up to 400 chars               | `screenId`, geometry, `fontFamily`, `fontSize` 8 to 240, `fontWeight` 100 to 900, `color`, `textAlign`, `emphasis` |
| `add_shape`              | `shapeType`                             | `screenId`, geometry, `fill`                                                                                       |
| `add_icon`               | `iconId`                                | `screenId`, geometry, `color`, `strokeWidth` 0.5 to 6                                                              |
| `add_device`             | —                                       | `screenId`, geometry, `deviceModel`, `slot`, `assetId`, `screenshotWidth`, `screenshotHeight`                      |
| `add_image`              | `path`, `role`                          | `screenId`, `layerId`, `name`, `slot`, `deviceModel`, geometry                                                     |
| `update_layer`           | `layerId`, `patch`                      | —                                                                                                                  |
| `delete_layer`           | `layerId`                               | —                                                                                                                  |
| `assign_screenshot_slot` | `layerId`, `slot`                       | —                                                                                                                  |
| `place_screenshot_asset` | `layerId`, `assetId`, `width`, `height` | —                                                                                                                  |
| `refresh_screenshots`    | `directory`                             | `manifest`                                                                                                         |
| `save_template`          | `name` up to 60 chars                   | `description` up to 200 chars, `screenId`                                                                          |

`screenId` defaults to the last screen `add_screen` created in this batch, and
to the active screen when the batch created none.

`add_image` is the one tool whose arguments are not the shared contract's: it
takes an absolute path under a root granted by the MCP client (or
`SCREENFORGE_MCP_ASSET_ROOTS`), reads the file on the machine running the daemon, and
turns it into a call the project accepts. `role` is `image` for a logo or
`screenshot` for a capture, which lands in an iPhone frame. Give `layerId` to
fill a frame that already exists, keeping the crop the user set on it. Refused
with its cause named: a relative path, an extension outside PNG, JPEG and SVG, a
missing file, more than 16 MB, or an SVG offered as a screenshot.

`refresh_screenshots` is the whole "I re-exported my captures" gesture: give it
the absolute path of an authorized flat directory of PNG or JPEG files, and every device
frame whose `slot` matches a filename gets its new capture. Nothing else moves —
not the geometry, not the role, not the crop the user set — and the whole
delivery is one write and one undo step.

The matching is the app's own: filename without extension becomes the role, a
leading `01-` rank is stripped as well, and a `manifest` of `{ "role":
"filename.png" }` overrides it for exports named after timestamps. One file may
serve several frames; two files claiming one role is an ambiguity, so neither is
placed and the report says which. The report also names every frame with no
role, every role with no file, and every file nobody took — a count of successes
that hides the rest is a lie by omission, and you cannot see the filmstrip.

Refused, each with its cause: a relative path, a path that is a file (use
`add_image` for one capture), a missing directory, a directory with no PNG or
JPEG, or more than 40 captures. Frames with no `slot` are never matched; give
them one with `assign_screenshot_slot` first.

`save_template` freezes a screen's layout in the browser library, images
included and device screenshot excluded, for reuse in any project from the
template picker. A name already taken is refused, not suffixed. The library
holds 30.

## Patchable properties

`update_layer` accepts only what the target layer's own type declares. Anything
else is refused, because a property the renderer ignores would produce a layer
that validates and never appears.

| Type           | Accepts, on top of `name` `x` `y` `width` `height` `rotation` `opacity` `visible`   |
| -------------- | ----------------------------------------------------------------------------------- |
| `text`         | `content`, `fontFamily`, `fontSize`, `fontWeight`, `color`, `textAlign`, `emphasis` |
| `shape`        | `shapeType`, `fill`                                                                 |
| `icon`         | `iconId`, `color`                                                                   |
| `image`        | nothing more                                                                        |
| `device-frame` | `deviceModel`                                                                       |

Identifiers, `zIndex` and the lock are never patchable. They belong to a
dedicated tool or to nobody.

## Emphasis

A headline is one layer. To put one word in the accent colour, name the word —
never cut the text into pieces and align them by hand.

`emphasis` is an array of up to 4 entries, each `{ "text": 1 to 80 chars,
"color": "#rrggbb" }`. It works on `add_text` and inside an `update_layer`
patch. Each passage is looked up verbatim in `content`, at its **first**
occurrence only, and the browser converts it into per-character colours itself.

Three rules that decide what you get back:

- A passage that is not in `content` refuses the **whole batch**, and the
  message names the passage it looked for and the content it read. Nothing is
  written, so an emphasis is never silently lost.
- On `update_layer`, colours are recomputed from the **final** content. Sending
  a new `content` without `emphasis` drops the colours instead of leaving them
  on columns of a text that no longer exists.
- Emphasis is not a layer property. You cannot read it back on `get_screen`; you
  re-send it with the content it belongs to.

```json
{
  "calls": [
    {
      "tool": "add_text",
      "args": {
        "content": "Chaque euro, à sa place",
        "x": 32,
        "y": 105,
        "width": 376,
        "height": 158,
        "fontSize": 44,
        "fontWeight": 700,
        "color": "#ffffff",
        "emphasis": [{ "text": "à sa place", "color": "#3b82f6" }]
      }
    }
  ]
}
```

## Backgrounds

`type` is required and decides which other keys apply.

| `type`            | Keys                                              |
| ----------------- | ------------------------------------------------- |
| `solid`           | `color`                                           |
| `linear-gradient` | `stops` up to 6, `angle` 0 to 360                 |
| `radial-gradient` | `stops` up to 6, `centerX` and `centerY` 0 to 100 |

A stop is `{ "offset": 0 to 1, "color": "#rrggbb" }`.

## Device models

`iphone-17-pro-max`, `iphone-17-pro`, `iphone-17`, `iphone-air`,
`iphone-16-plus`, `iphone-16`, `iphone-16e`, `iphone-16-pro-max`,
`iphone-16-pro`, `tablet-slate`, `tablet-studio`, `watch-halo`,
`watch-compact`.

The active project's immutable profile filters this catalogue: iPhone tools
accept the iPhone identifiers, iPad accepts the two `tablet-*` identifiers, and
Watch accepts the two `watch-*` identifiers. The two `iphone-16-pro*` entries
are legacy, kept so older projects still render.

## Shapes

`rectangle`, `rounded-rect`, `circle`, `line`, `triangle`, `diamond`, `arch`,
`ring`, `star`, `burst`, `spark`, `blob`, `arrow`, `wave`.

## Icons

`check`, `circle-check-big`, `shield-check`, `lock`, `key`, `star`, `heart`,
`thumbs-up`, `sparkles`, `flame`, `crown`, `award`, `zap`, `trending-up`,
`chart-column`, `activity`, `target`, `search`, `settings`, `bell`, `camera`,
`play`, `download`, `send`, `calendar`, `clock`, `wallet`, `credit-card`,
`gift`, `users`, `map-pin`, `globe`, `cloud`, `rocket`, `lightbulb`,
`message-circle`.

Drawn as strokes in a box of 24, scaled to the layer.

## Fonts

`Space Grotesk`, `Archivo`, `Inter`, `Roboto`, `Open Sans`, `Montserrat`,
`Poppins`, `Lato`, `Playfair Display`, `Oswald`, `Raleway`, `Nunito`,
`Merriweather`, `Source Sans 3`, `PT Sans`, `Ubuntu`, `Rubik`, `Work Sans`,
`Quicksand`, `Barlow`, `DM Sans`, `Noto Sans`, `Fira Sans`, `Mulish`,
`Josefin Sans`, `Inconsolata`, `Karla`, `Cabin`, `Libre Baskerville`,
`EB Garamond`, `Crimson Text`, `Cormorant Garamond`, `Zilla Slab`, `Rokkitt`,
`Arvo`, `Bitter`, `Exo 2`, `Titillium Web`, `Anton`, `Bebas Neue`,
`Righteous`, `Pacifico`, `Dancing Script`, `Lobster`, `Caveat`, `Sacramento`,
`Great Vibes`, `Satisfy`, `Comfortaa`, `Fredoka One`, `Varela Round`.

Loaded on demand by the tab. `Space Grotesk` is what a new text takes.

## A batch, in full

```json
{
  "calls": [
    { "tool": "add_screen", "args": { "name": "Suivi des dépenses" } },
    {
      "tool": "set_background",
      "args": {
        "background": {
          "type": "linear-gradient",
          "angle": 165,
          "stops": [
            { "offset": 0, "color": "#101114" },
            { "offset": 1, "color": "#1d2430" }
          ]
        }
      }
    },
    {
      "tool": "add_text",
      "args": {
        "content": "Chaque euro, à sa place",
        "x": 32,
        "y": 105,
        "width": 376,
        "height": 158,
        "fontFamily": "Space Grotesk",
        "fontSize": 44,
        "fontWeight": 700,
        "color": "#ffffff",
        "textAlign": "center"
      }
    },
    {
      "tool": "add_shape",
      "args": {
        "shapeType": "blob",
        "x": -40,
        "y": 320,
        "width": 520,
        "height": 520,
        "fill": "#3b82f6",
        "opacity": 0.28,
        "rotation": -8
      }
    },
    {
      "tool": "add_device",
      "args": {
        "deviceModel": "iphone-17-pro",
        "x": 88,
        "y": 296,
        "width": 264,
        "height": 574,
        "slot": "accueil"
      }
    }
  ]
}
```

## A capture, then the screen around it

`add_image` runs on its own, before the batch, because a path is not a call the
contract carries.

```json
{
  "path": "/Users/moi/captures/accueil.png",
  "role": "screenshot",
  "deviceModel": "iphone-17-pro",
  "x": 88,
  "y": 296,
  "width": 264,
  "height": 574,
  "slot": "accueil"
}
```

Give `width` and `height` together or neither. A frame sized on one axis alone
stretches, since nothing recomputes the other from the model's aspect ratio,
which is close to 0.46 across the whole range.

Filling a frame already on the board, keeping its crop:

```json
{ "path": "/Users/moi/captures/accueil-v2.png", "role": "screenshot", "layerId": "layer-7f3a" }
```

A logo, left to the size the mouse import would give it:

```json
{ "path": "/Users/moi/marque/logo.svg", "role": "image", "x": 32, "y": 32 }
```
