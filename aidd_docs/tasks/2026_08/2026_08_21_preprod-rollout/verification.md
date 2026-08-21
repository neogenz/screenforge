---
status: blocked
verified_at: 2026-08-21
---

# Preproduction verification

## Candidate

| Evidence | Result |
| --- | --- |
| Automation pull request | GitHub PR #19 merged into `main`; every Quality and Vercel check passed. |
| Promotion pull request | GitHub PR #20 merged into `preprod` as merge commit `679981e55b53e43bde529121c9ffab602d82acd6`. |
| Tree identity | `origin/main^{tree}` and `origin/preprod^{tree}` both resolve to `d7e3a2d1f24483f95067b89c937fea046c1d7f71`. |
| Hosted gate | GitHub Actions run `32525890982` passed actionlint, security, backend, web, release E2E and `deploy-preproduction`. |

## Provider evidence

### GitHub and Convex

- The `preproduction` Environment accepts only `preprod` and exposes only the
  `CONVEX_DEPLOY_KEY` secret name.
- The active `Protect preprod` ruleset has no bypass, requires pull requests,
  resolved discussions and the five Quality checks, allows merge commits only,
  and prevents deletion and force-push.
- The hosted deployment ran the main-tree guard, current preflight, Convex
  deployment and candidate preflight in that order. Both preflights reported
  ready with no missing or inconsistent configuration.
- The Convex deployment message references the promotion merge commit. No
  production deployment or release tag ran.

### Vercel

- The Git deployment for the promotion merge commit reached `READY` as a
  Preview and updated the stable `preprod` branch alias.
- An anonymous request is redirected to Vercel SSO and returns `no-store`,
  `noindex` and `DENY` framing headers.
- Standard Protection requires Vercel team login. Protection exceptions and
  the OPTIONS allowlist are inactive; protected source maps are active.
- One automation bypass created before this rollout remains present without a
  note. No consumer exists in this repository. It was not revealed or revoked
  because external ownership has not yet been confirmed.

### ScreenForge, Polar and Resend

- The hosted unauthenticated editor remains fully local and shows the Cloud
  offer at 39 USD per year with 100 projects, 128 MiB of project data, 500
  images and 512 MiB of image storage.
- Polar Sandbox contains one public recurring `ScreenForge Cloud` product at
  39 USD per year. Its checkout description is empty, so the four quotas are
  not currently repeated by Polar at checkout.
- Resend contains delivered ScreenForge magic-link events. A fresh event from
  this candidate has not been generated yet.

## Blocking gates

The following checks require an authenticated human session or an explicit
browser-side confirmation before they can be executed safely:

1. Sign in to the Convex dashboard, run three comparable gates, inspect usage
   and enable measured warnings while leaving every disable inactive.
2. Send a fresh magic link to the owner's address, sign in to ScreenForge and
   prove the delivery event in Resend.
3. Add the four Cloud quotas to the Polar Sandbox checkout description and run
   a Sandbox checkout/revocation cycle.
4. Complete the two-client sync, quota, Cloud reset, consent and local-data
   preservation journey.
5. Confirm the owner of the existing Vercel automation bypass, then retain it
   with a note or revoke it with explicit approval.

## Verdict

The automatic preproduction delivery path is validated. Hosted Cloud product
validation remains blocked on the authenticated gates above. Production stays
blocked until a final domain, distinct production secrets and a non-Sandbox
validation exist.
