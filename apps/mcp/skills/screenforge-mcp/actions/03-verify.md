# 03 - Verify

Look at what was actually laid down, and correct it before showing it to the user.

## Output

One rendered screen per composed screen, and the corrections applied to them.

## Process

1. **Render.** Call `screenforge_get_thumbnail` on every screen that was composed, at a width where the headline is readable.
   - It renders in the tab, on a throwaway canvas. It writes nothing, costs no undo step, and moves no selection, so calling it after each batch is free.
   - The daemon cannot render this itself. Google fonts, device frames and the user's captures live in the tab alone.
2. **Read the image.** Check each render for the four defects a plan cannot predict, since they only exist once the text has wrapped and the font has loaded.
   - A headline that overflows its box, runs off the board, or lands on the device chrome.
   - A headline whose colour drops under 4.5 to 1 against the background actually painted behind it.
   - A band of bare background taller than a quarter of the screen.
   - A device with less than 70 percent of itself on the board, unless the crop is deliberate.
3. **Correct.** Send the fixes as one `screenforge_apply` of `update_layer` calls per screen, then loop back to step 1 on that screen.
   - A patch only accepts the properties its layer type declares. `content` on a shape or `iconId` on a text is refused.
   - Two rounds is usually enough. A third means the composition is wrong, not the numbers, so go back to compose and pick another recipe.
4. **Show.** Tell the user what is on each screen and what remains their call, and say that the export to PNG is done from the app.

## Test

| Case                                             | Pass                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| `screenforge_get_thumbnail` on a composed screen | it returns an image block plus the screen id and its rendered size              |
| The same call repeated ten times                 | `get_project_state` is unchanged and the user's undo stack has not grown        |
| A headline overflowing its box                   | one `update_layer` batch fixes it and the next render shows it inside the board |
