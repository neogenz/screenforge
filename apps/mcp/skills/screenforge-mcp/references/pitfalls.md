# Pitfalls

Each refusal names its cause. This maps the cause to the fix.

## Refusals

| What comes back                                              | Why                                                                                          | Fix                                                                      |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Aucun éditeur ScreenForge connecté                           | no tab is paired                                                                             | ask the user to open ScreenForge and turn on "Connexion MCP", then stop  |
| L'éditeur est connecté mais n'a pas encore poussé son projet | the stream opened, the state has not arrived                                                 | read once more after a moment                                            |
| L'éditeur a été remplacé par un autre onglet                 | a second tab paired and evicted the first                                                    | re-read the state, since the new tab may hold another project            |
| L'éditeur n'a pas répondu en 60 s                            | the tab stalled or slept                                                                     | re-read the state before replaying, the batch may or may not have landed |
| valeur hors catalogue                                        | an id outside the closed lists                                                               | take the value from `tools.md`, never from memory                        |
| propriété inconnue                                           | a key the schema does not declare                                                            | drop it, nothing accepts undeclared properties                           |
| format invalide on a colour                                  | a shorthand, an alpha, or a name                                                             | write `#rrggbb`, six hex digits                                          |
| Appel N refusé                                               | one call in the batch failed                                                                 | the whole batch was dropped, fix that call and resend all of it          |
| Campagne pleine                                              | the project holds 10 screens                                                                 | compose on existing screens                                              |
| 24 calques au plus                                           | the screen is full                                                                           | merge or drop layers                                                     |
| Image refusée                                                | a relative path, an unknown extension, a missing file, over 16 MB, or an SVG as a screenshot | the message names which, each is a different correction                  |
| Passage absent du texte                                      | an `emphasis` passage is not in the `content` it was sent with                               | the message quotes both, copy the passage out of the content itself      |

## A headline is one layer

Cutting a headline into several text layers to colour one word is the most
expensive mistake in this vocabulary, and it does not look like a mistake while
you make it. Measured on a real session: 18 text layers for 4 headlines, two of
them overlapping by 78 px on the same screen.

The symptom is that you cannot see it. Each fragment is placed by hand, so the
spacing is right only at the size and font you assumed; the first re-word, the
first font fallback, the first box resize breaks the alignment, and the render
shows a headline that reads as one broken sentence.

Use `emphasis` instead. One layer, one line of copy, colours that follow the
text when it changes. If a passage cannot be expressed that way — a different
size, a line break in the middle — that is a real second layer, not a fragment
of the first, and it deserves its own box rather than a hand-placed offset.

## Batch or nothing

A batch is one validated transaction and one undo step. The same calls sent one
by one are that many writes on the user's project, and a failure halfway leaves
half a screen behind. Batch per screen: it is the unit a user thinks in, and the
unit they will want to undo.

`get_thumbnail`, `get_project_state`, `get_screen` and `list_templates` write
nothing and cost no undo step. Call them freely.

## `add_image` is not a batch call

`apply` accepts `add_image` in its enumeration, and the page refuses it there.
The contract's version needs an asset identifier the browser already holds, and
an agent has no way to produce one. Use the standalone `screenforge_add_image`
with an absolute path, and let it register the file. Run it before the batch
that arranges the screen around the image.

## The closed catalogue

Device models, shapes, icons and fonts are enumerations. An unknown value is
refused before it reaches the project, with the accepted values attached to the
refusal. There is no free-form path, no SVG, no font URL and no Fabric JSON
anywhere in the vocabulary, by design: an agent that goes wrong can at worst put
a text in the wrong place.

## Board units, not export pixels

Every coordinate is on the 440 by 956 artboard. The export is 1320 by 2868 and
is derived at render time. A headline placed at y 300 thinking in export pixels
lands a third of the way down a board it should have crossed at the top.

## Structure, not pixels

When copying a reference, what transfers is the composition: where the headline
sits, how much device is visible, what the accents do. What does not transfer is
the font, the device model, the exact crop and the copy, which are the user's.
Chasing a pixel match means copying the wrong thing, and the render is the only
place to judge either.

## The state is a snapshot

`get_project_state` is served from what the tab last pushed, not fetched on
demand. The tab pushes on connect, after every agent write, and after the user's
own edits, grouped. It never carries image bytes: a device frame reports
`hasScreenshot` as a boolean, and `get_thumbnail` is the only way to see pixels.

## One tab

The last tab to pair evicts the previous one, and the evicted tab's in-flight
calls come back as errors. Two tabs sharing the batches would give the agent a
project that contradicts itself between calls.
