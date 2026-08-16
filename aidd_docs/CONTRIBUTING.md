# Contributing to this project's AI context

How to add or change the context the AI relies on here. For authoring AIDD skills, agents, rules, and templates, see the framework guide: <https://github.com/ai-driven-dev/framework/blob/main/CONTRIBUTING.md>.

## Changing project memory

Add or edit a file under `aidd_docs/memory/`. See [`memory/README.md`](memory/README.md) for what belongs there and how it loads.

## Adding AI content (skills, rules, agents, commands, hooks)

- Use the generator skills (`aidd-context:04-skill-generate` through `08-hook-generate`, and `10-learn` for memory or rules). They scaffold the right shape and write to the right place for each tool you use.
- Open a pull request for anything that changes how the AI behaves on this project. The team reviews it like any code change.

## House conventions

- Everything under `aidd_docs/` is public, versioned project context. Never put secrets, customer data, personal filesystem paths, or raw logs there.
- Put sensitive local notes under the ignored `.private/` directory and never reference them from versioned content.
- Memory records durable, current project facts; task directories contain scoped plans and sanitized evidence; generated rules or skills are reserved for cross-cutting behavior.
