# 03 - Verify

Look at what was actually laid down, and correct it before showing it to the user.

## Output

One rendered screen per composed screen, and the corrections applied to them.

## Process

1. **Render.** Call `screenforge_get_thumbnail` on every screen that was composed, at a width where the headline is readable.
   - It renders in the tab, on a throwaway canvas. It writes nothing, costs no undo step, and moves no selection, so calling it after each batch is free.
   - The daemon cannot render this itself. Google fonts, device frames and the user's captures live in the tab alone.
2. **Read the report, then the image.** The first block of the answer is what the tab measured on that board: overflow, off-board text, cropped device, contrast, overlapping texts, empty band — each line naming its layer and its number. Fix what is measured before you judge anything by eye.
   - The report is not a verdict. A composition that overflows on purpose is legitimate, and the tool is read-only. It tells you what it measured; you decide.
   - "Aucun défaut mesuré" means the six checks found nothing, not that the board is good. That is what the image is for.
3. **Read the image.** For what no measurement catches: a headline landing on the device chrome, an accent fighting the capture, a composition that is merely dull.
4. **Correct.** Send the fixes as one `screenforge_apply` of `update_layer` calls per screen, then loop back to step 1 on that screen.
   - A patch only accepts the properties its layer type declares. `content` on a shape or `iconId` on a text is refused.
   - An overlap between two texts is almost always a headline that was cut into fragments. Merge it back into one layer with `emphasis` rather than nudging the pieces apart.
   - Two rounds is usually enough. A third means the composition is wrong, not the numbers, so go back to compose and pick another recipe.
5. **Show.** Tell the user what is on each screen and what remains their call, and say that the export to PNG is done from the app.

## Test

| Case                                             | Pass                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| `screenforge_get_thumbnail` on a composed screen | it returns a measured report, then an image block                               |
| A board with no measured defect                  | the report says so in one line, it is never an empty block                      |
| A board with a defect                            | the answer is still not an error: a report is a statement, not a refusal        |
| The same call repeated ten times                 | `get_project_state` is unchanged and the user's undo stack has not grown        |
| A headline overflowing its box                   | one `update_layer` batch fixes it and the next render shows it inside the board |
