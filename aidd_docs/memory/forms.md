# Forms

## Approach

- There is no form or schema-validation library; editor values use controlled React state and native inputs wrapped by primitives in `src/components/ui/`.
- Domain constraints live at their boundaries: numeric primitives clamp values, project ZIP and IndexedDB records share `project-validation.ts`, and feature handlers validate files or colors before store updates.

## Conventions

- Use existing primitives rather than feature-local inputs; expose inline labels and French `aria-label` values used by E2E tests.
- Commit high-frequency numeric edits through the existing coalesced store update path so one gesture remains one undo step.
- Keep invalid input local, display concise inline `role="alert"` feedback, and disable or show loading state during async submission.
- File inputs may remain visually hidden but must be triggered by labelled controls and clear their value after selection.
- File validation completes before mutating the active project; invalid archives and images keep the current session intact and surface a concise error.
