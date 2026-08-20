# Contributing to ScreenForge

Thanks for helping make ScreenForge better. Bug reports, documentation fixes
and focused pull requests are welcome.

## Before you start

- Use the bug or feature issue form and check for an existing issue first.
- Small fixes can go straight to a pull request. Discuss larger features before
  implementation so neither side spends time on incompatible scope.
- Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).
  Never put credentials, customer data or exploit details in an issue.

## Development setup

ScreenForge requires Node.js 24 and pnpm 10. Run every command from the
repository root.

```bash
pnpm install
pnpm dev
```

Local mode needs no account, backend or environment variables. Cloud work uses
the documented variables in `.env.example`; real values belong only in the
secret store that consumes them.

Before your first commit, install the pinned secret scanner:

```bash
pnpm setup:gitleaks
```

## Project guardrails

- Local remains complete and usable without Convex, an account or a network.
- App Store exports stay pixel-exact, opaque PNG-24 and within the supported
  dimensions in `apps/web/src/lib/dimensions.ts`.
- The editor UI is concise French; the public landing stays equivalent in
  English and French.
- Reuse the existing UI primitives, Zustand stores and shared project format.
- Never commit secrets, private provider output, customer data or personal
  paths. Public AIDD documents follow the same rule.

See `AGENTS.md` for the detailed architecture and coding conventions.

## Verification

Run the narrowest relevant check while iterating, then before opening a pull
request run:

```bash
pnpm test
pnpm build
```

Changes to export, storage, Cloud, release or browser behavior should also pass
the complete gate:

```bash
pnpm test:release
```

## Pull requests

- Keep the change focused and explain the user-visible reason.
- Use a Conventional Commit title such as `fix: preserve local project consent`.
- Add or update the smallest test that would catch a regression.
- Update public documentation when behavior, setup or constraints change.
- Confirm that no generated output or sensitive data entered the diff.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
