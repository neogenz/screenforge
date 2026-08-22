# 02 - Compose

Turn the brief into real layers on the board, one screen and one batch at a time.

## Input

The brief and the project state from connect.

## Output

One applied batch per screen, each a single undo step.

## Process

1. **Recipe.** Pick the matching entry in [workflows.md](../references/workflows.md) and follow the call order it gives.
2. **Palette.** Fix one background, one ink and one accent for the whole set before the first call, and reuse them on every screen.
   - The ink must stay readable on the darkest and the lightest stop of its own background, since a headline is what sells the download.
3. **Files first.** Local images do not travel inside a batch. Call `screenforge_add_image` once per file, with an absolute path under a root granted by the MCP client, before the batch that arranges the screen around it.
   - Only that tool can turn a path into an asset the project accepts. The contract's `add_image` inside `calls` needs an identifier no agent can produce and is refused.
4. **Draft.** Place every layer on the `canvas` returned by project state, deriving a headline box height from its own font size as `lines × fontSize × 1.2` rather than declaring one.
   - A screen holds 24 layers at most. A project holds 10 App Store screens or 8 Google Play phone screens.
   - Neighbouring screens must not repeat the same composition, or the set reads as one screen printed six times.
5. **Apply.** Send one `screenforge_apply` per screen, opening with `set_background` and closing with the topmost layer, and name each screen with `add_screen` when it is a new one.
   - The batch is all or nothing. A refusal at the sixth call leaves nothing behind, so fix that call and resend the whole batch.
   - The refusal names the failing argument and the sub-schema it violated. Read both, look the value up in [tools.md](../references/tools.md), and correct rather than guess.
6. **Hand over.** Go to verify once every screen has been applied, never after each single call.

## Test

| Case                                         | Pass                                                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| A three screen brief is composed             | three `screenforge_apply` calls succeed and `get_project_state` shows three screens carrying layers   |
| A batch naming an icon outside the catalogue | the whole batch is refused, the project is unchanged, and the refusal carries the accepted values     |
| A user capture given as an absolute path     | `screenforge_add_image` with role `screenshot` puts a compatible phone frame carrying it on the board |
