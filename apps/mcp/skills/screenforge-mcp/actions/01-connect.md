# 01 - Connect

Reach the ScreenForge tab and read the project it has open.

## Input

The user's request, and whatever files they named.

## Output

The current project state, or a stop naming why no editor answered.

## Process

1. **Read.** Call `screenforge_get_project_state`, which returns the project name, the artboard size, the globals, and every screen with its layers.
   - Refused with no editor connected: tell the user to open ScreenForge and turn on "Connexion MCP" in the top bar, then stop. Nothing downstream works until a tab answers.
   - Refused with the editor connected but nothing pushed yet: wait a moment and read once more.
   - Refused for any other cause: read it against [pitfalls.md](../references/pitfalls.md) before retrying.
2. **Count.** Note `target`, `canvas`, `globals.deviceModel`, how many screens exist against the target cap (10 for App Store, 8 for Google Play phone), and which already carry layers.
   - A fresh project opens with one empty screen. Compose on that one first rather than adding a screen that pushes the last past the cap.
   - Screens the user already composed are theirs. Ask before touching one instead of overwriting it.
3. **Pin the brief.** Ask once for the app name, the audience and the tone when the request names none of the three, and decide everything else yourself.
   - The user brought captures: note their absolute paths now, since [02-compose.md](02-compose.md) needs them before its first batch.

## Test

| Case                                                 | Pass                                                                    |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `screenforge_get_project_state` with a tab connected | it returns `target`, `canvas` and `screens` with at least one entry     |
| The same call with no tab connected                  | it errors naming "Connexion MCP" and the run stops instead of composing |
| A project already at its target's screen cap         | the run composes on the existing screens and adds none                  |
