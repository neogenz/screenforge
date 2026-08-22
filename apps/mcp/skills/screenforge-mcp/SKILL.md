---
name: screenforge-mcp
description: Composes App Store screenshots in the running ScreenForge editor through its local MCP server. Use when the user wants App Store listing visuals or wants an agent to drive ScreenForge. Not for exporting the PNGs, which happens in the app.
argument-hint: brief | reference shot | own captures
---

# ScreenForge MCP

```mermaid
flowchart LR
  ask([screenshots asked]) --> connect --> compose --> verify
  verify -- corrections --> compose
  verify --> keep --> done([listing on the board])
```

## Actions

Run the flow above. Read only the next action file.

| Action  | Does                                         |
| ------- | -------------------------------------------- |
| connect | reach the open editor and read its project   |
| compose | pick a recipe and apply one batch per screen |
| verify  | render each screen and correct what it shows |
| keep    | save the layouts worth reusing as templates  |

## Transversal rules

- Write through `screenforge_apply`. One batch per screen is one validated transaction and one Ctrl+Z; the same calls sent loose are that many writes the user has to undo one by one.
- Never invent an identifier. Device models, shapes, icons and fonts are closed lists, and a value outside them is refused before it reaches the project.
- The project belongs to the user. Read it before writing, add rather than replace, and never delete a layer this run did not create.
- Every call can be refused, and the refusal names its cause and the expected sub-schema. Correct the call from what it says instead of retrying it unchanged.
- Before writing geometry, read `screenforge_get_project_state.canvas.width` and
  `screenforge_get_project_state.canvas.height`. Use those board units and the
  active ratio, never the export pixels in `profile.width` and `.height`.
- Write the user's copy in the user's own language. The board is a real listing, not a demo.
