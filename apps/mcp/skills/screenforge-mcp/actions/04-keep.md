# 04 - Keep

Save the compositions that worked, so the next project does not start from nothing.

## Output

The layouts worth reusing, stored in the browser library, and their names told to the user.

## Process

1. **Read the library.** Call `screenforge_list_templates` to see what is already saved on this browser, across every project.
   - It carries names and layer counts, never layers. Reuse happens in the app, from "Modèles de mise en page".
2. **Choose.** Save the screens whose composition would serve another listing, not every screen of this one.
   - Two or three per set. A library of thirty near-identical entries is a library nobody reads, and thirty is the cap.
3. **Save.** Call `screenforge_save_template` per chosen screen, with a name that says what the layout does rather than what this app sells.
   - A name already taken is refused, not suffixed. Pick another name or ask the user which of the two to keep.
   - The template carries its images, a logo included, but never the device screenshot, which belongs to this listing alone.
4. **Report.** Name the saved templates to the user and say they are reusable from the template picker in any project on this browser.

## Test

| Case                                             | Pass                                                                              |
| ------------------------------------------------ | --------------------------------------------------------------------------------- |
| `screenforge_save_template` on a composed screen | `screenforge_list_templates` then shows it with its layer count and source `ai`   |
| The same name saved twice                        | the second call is refused naming the taken name, and the library still holds one |
| The tab is reloaded                              | `screenforge_list_templates` still returns the saved template                     |
