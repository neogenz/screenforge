# Workflows

Five recipes. Each is a call order, not a template to copy verbatim.

## Compositions that hold

These six are the layouts ScreenForge's own generator lays down. Read
`canvas.width` as `W` and `canvas.height` as `H` from the current
`get_project_state`; set `S = W / 440` and the text gutter `G = 0.073W`. The
ratios below therefore hold on iPhone, iPad and Watch instead of carrying one
profile's coordinates into another.

| Archetype          | Headline                                            | Device target                                             | Reads as                                   |
| ------------------ | --------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------ |
| plein-cadre        | y `0.11H`, size `44S`, centred, 3 lines             | centred, top `0.31H`, width up to `0.60W`, no tilt        | device whole, centred                      |
| bord-coupe         | y `0.11H`, size `42S`, left, 3 lines                | centre `0.375W`, top `0.32H`, width up to `0.59W`, tilt 2 | device offset, whole                       |
| carte              | y `0.11H`, size `42S`, centred, 3 lines             | centred, top `0.31H`, width up to `0.59W`, no tilt        | device resting, headline above             |
| bas-ancre          | y `0.66H`, size `50S`, centred, 3 lines             | centred, top `-0.20H`, width up to `0.80W`, no tilt       | device cut by the top, words at the bottom |
| texte-sur-appareil | y `0.05H`, size `52S`, weight 800, centred, 3 lines | centred, top `0.16H`, width up to `0.82W`, tilt 4         | headline over the device, on a pill        |
| mur                | y `0.30H`, size `64S`, weight 800, left, 4 lines    | none                                                      | words alone, full bleed                    |

Headline `x` is `G` and `width` is `W - 2G`; on `mur`, use `0.82W - 2G`.
Height is derived, never declared: `lines × fontSize × 1.2`.

Device targets are maxima, not permission to stretch a frame. Insert the
profile-compatible default without `width` or `height`, read its resulting
dimensions from `get_project_state`, then scale both by the same factor during
verification. Cap that factor until stacked text and device no longer collide
and at least `0.075H` remains below a whole frame. Recompute a centred `x` as
`(W - width) / 2`; the offset recipe uses `0.375W - width / 2`.

Rank 0 takes plein-cadre, the only visual most people will ever see. From four
screens up the last takes mur. The rest cycle through plein-cadre, carte and
bord-coupe, which mechanically keeps two neighbours from matching and puts three
distinct compositions on the board from three screens up.

## A listing from a brief

The user describes the app and has no captures ready.

1. `get_project_state`, to know how many screens exist and which are empty.
2. Decide the count with the user, then fix one palette for the whole set.
3. Per screen, one `apply` carrying `add_screen`, `set_background`, `add_text`,
   the accent shapes, then `add_device`.
4. Leave the device frames empty and say so. Batch refresh fills them in the app
   when the captures exist, and an empty frame is honest where an invented
   screenshot is not.
5. `get_thumbnail` per screen, correct, then save what worked.

## Reproducing a reference

The user points at a screenshot they like and wants theirs to look like it.

1. Read the reference and name what it is made of: the background, where the
   headline sits, how much of the device is on the board, what the accents do.
   Structure, not pixels.
2. Match it to the closest row of the table above and calculate it from the
   current `W` and `H`.
   A recipe that already holds beats a measurement guessed off an image.
3. `add_image` per file the user gave, before the batch.
4. `apply` the screen, `get_thumbnail`, and compare against the reference by
   composition, not by pixel. The fonts, the device model and the copy are the
   user's, so a pixel match would mean the wrong thing was copied.
5. Two correction rounds at most. Say what does not transfer instead of chasing
   it.

## A coherent campaign

Several screens that must read as one set.

1. One palette, one font family, one headline weight, across every screen.
2. Walk the rota above rather than picking per screen. Neighbouring screens
   differing is what makes a set a set.
3. `assign_screenshot_slot` on every device frame, with a stable role name per
   screen. That is what lets the user refresh all the captures at once later,
   and what makes a release replayable.
4. `declare_plan` first when the set is large, so the user reads the headlines
   before anything lands on their board.
5. One `apply` per screen, all of them, then verify the whole set in one pass.
   A set is judged together.

## New captures, same listing

The user re-exported their screenshots and wants them in, without the
composition moving. This is the one recipe that touches no layout at all.

1. `get_project_state`, to read the `slot` on every device frame. A frame with
   no role will never be matched.
2. If roles are missing, `assign_screenshot_slot` on each, one `apply`. Choose
   names the user's filenames already use, so this stays a one-call gesture next
   time.
3. `refresh_screenshots` with the absolute path of the directory. One write, one
   undo step, every crop preserved.
4. Read the report before saying it worked. It names the frames that got
   nothing, the roles two files fought over, and the files nobody took — none of
   which the count of placed captures would reveal.
5. `get_thumbnail` on the screens that changed. A new capture of a different
   aspect ratio can sit differently inside the same crop.

Use `add_image` with a `layerId` instead when there is exactly one capture to
swap. Below two or three files, naming the frame is faster than naming a
directory.

## The template cycle

1. `list_templates` at the start of a session. A layout that worked last month
   is a better starting point than a fresh guess.
2. Compose and verify as usual.
3. `save_template` on the two or three screens whose layout would serve another
   listing, naming what the layout does rather than what this app sells.
4. Tell the user the names. Applying a template is a click in "Modèles de mise
   en page", not a tool call, and the library follows the browser rather than
   the project.
