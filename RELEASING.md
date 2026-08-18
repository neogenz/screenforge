# Releasing ScreenForge

ScreenForge has one version and one production path. Do not create or move a
`v*` tag manually and do not deploy production from a branch.

## Prerequisites

- `main` accepts squash merges only and requires the Quality checks.
- The release GitHub App is installed only on this repository. Its client ID is
  stored as `RELEASE_APP_CLIENT_ID`; its private key is stored as
  `RELEASE_APP_PRIVATE_KEY`.
- The GitHub `production` Environment allows only `v*` tags. It contains
  `VERCEL_TOKEN` and `CONVEX_DEPLOY_KEY` secrets plus `VERCEL_ORG_ID`,
  `VERCEL_PROJECT_ID` and `PRODUCTION_URL` variables.
- Vercel production contains only public browser configuration such as
  `VITE_CONVEX_URL`. Auth, billing and email secrets stay in Convex.
- Gitleaks, `pnpm run audit:publication` and `pnpm run audit:dependencies`
  pass on all refs, dependencies and public output.

The root `pnpm.overrides` entries are deliberate supply-chain patches for the
pinned Vercel CLI tree. Remove one only after both the dependency audit and a
real `vercel build --prod` pass without it.

## Release

1. Merge conventional pull requests into `main` (`feat`, `fix`, `perf`,
   `refactor`, `docs`, `test`, `build`, `ci` or `chore`).
2. Review the single Release Please pull request: version, `CHANGELOG.md`, CI
   and absence of obsolete Local-paid wording.
3. Merge that pull request only after every required check is green. Release
   Please creates the immutable tag and GitHub Release.
4. Follow `Deploy Production`: tag provenance and the complete release gate run
   without production secrets; only the second job may enter the production
   Environment.
5. The workflow checks the currently deployed Convex configuration, builds one
   staged Vercel deployment, deploys Convex, checks the candidate backend,
   smoke-tests the staged URL, promotes that exact build and audits the public
   headers. Each provider credential exists only in the steps that call it.

The workflow is serialized. Rerunning a failed job is safe before promotion. Do
not create a replacement tag for the same version; fix the cause and release a
new patch.

## Recovery

- If staged smoke tests fail, no production domain moves.
- If the post-promotion check fails, the workflow runs Vercel Instant Rollback
  and then remains red. Verify the restored production before a patch release.
- Convex changes follow expand/contract compatibility and are never rolled back
  automatically. Prefer a forward fix; restore data only through the separately
  tested backup procedure.
- If the Convex candidate fails after deployment, do not promote Vercel. Apply a
  compatible forward fix; use the tested backup/restore runbook only for data
  recovery. A Vercel rollback never restores the backend.
- Never paste provider output, environment values or customer data into issues,
  release notes, Actions logs or AIDD documents.
