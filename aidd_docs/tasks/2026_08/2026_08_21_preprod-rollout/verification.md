---
status: blocked
verified_at: 2026-08-22
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
  39 USD per year. Its checkout repeats the four quotas, the local-first
  guarantee, the yearly billing interval and the tax calculation.
- A new Sandbox checkout completed with Polar's test payment method. The
  signed customer-state webhook granted Cloud, an immediate Sandbox
  cancellation removed it, and the owner's pre-existing complimentary grant
  was then restored unchanged.
- A fresh magic link from this candidate was delivered to the owner and its
  successful delivery is visible in Resend. No address, token or signed URL is
  retained in this document.

### Convex usage limits

- Daily usage was inspected after the hosted checkout and sync journey.
- The dashboard currently disables every warning-threshold control for this
  development deployment and exposes only disable thresholds. A temporary,
  non-reachable Function calls disable value was used solely to confirm that
  it does not unlock warnings, then deleted immediately.
- Every daily and monthly disable threshold is inactive. No hard limit can
  disable this deployment.

## Blocking gates

The following checks still require another client, a destructive-action
confirmation or a provider capability:

1. Complete the two-client sync, quota, Cloud reset, consent and local-data
   preservation journey.
2. Enable measured Convex warnings once the provider exposes warning controls
   for this deployment; do not substitute a disable threshold.
3. Confirm the owner of the existing Vercel automation bypass, then retain it
   with a note or revoke it with explicit approval.

## Verdict

The automatic delivery path, hosted authentication email and complete Polar
Sandbox entitlement lifecycle are validated. Full preproduction validation
remains blocked on the two-client destructive journey, provider warning
support and the unowned Vercel bypass. Production stays blocked until a final
domain, distinct production secrets and a non-Sandbox validation exist.
