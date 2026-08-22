import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { enforceCandidateProductionConfiguration } from './convex-production-config-gate.mjs'
import { enforceConvexPreflight } from './convex-preflight-gate.mjs'

const ROOT = resolve(import.meta.dirname, '..')
const STEP_ORDER = [
  'Check current Convex production configuration',
  'Build immutable production candidate',
  'Deploy staged production candidate',
  'Deploy candidate Convex backend to preproduction',
  'Check candidate Convex preproduction configuration',
  'Gate candidate against production configuration',
  'Deploy Convex production backend',
  'Check candidate Convex production configuration',
  'Smoke test staged candidate',
  'Promote tested candidate',
]
const PREPRODUCTION_STEP_ORDER = [
  'Check current Convex preproduction configuration',
  'Deploy Convex preproduction backend',
  'Check candidate Convex preproduction configuration',
]

/** @param {string} source @param {string} name */
function workflowStep(source, name) {
  const marker = `      - name: ${name}`
  const start = source.indexOf(marker)
  if (start < 0) return ''
  const end = source.indexOf('\n      - name:', start + marker.length)
  return source.slice(start, end < 0 ? undefined : end)
}

/** @param {Record<string, string>} workflows @param {unknown} vercel */
export function auditDeploymentConfig(workflows, vercel, vite = '') {
  const findings = []
  for (const [name, source] of Object.entries(workflows)) {
    if (/\bpull_request_target\s*:/.test(source)) findings.push(`${name}:pull-request-target`)
    if (/\bpull_request\s*:/.test(source) && /secrets\.VERCEL_TOKEN/.test(source)) {
      findings.push(`${name}:vercel-secret-in-pr`)
    }
    if (/\bpull_request\s*:/.test(source) && /secrets\.POSTHOG_PERSONAL_API_KEY/.test(source)) {
      findings.push(`${name}:posthog-secret-in-pr`)
    }
    if (/VITE_[A-Z0-9_]*POSTHOG_(?:PERSONAL|PERSON)_API_KEY/.test(source)) {
      findings.push(`${name}:posthog-secret-public`)
    }
    if (/secrets\.POSTHOG_PERSON_API_KEY/.test(source)) {
      findings.push(`${name}:posthog-person-key-in-workflow`)
    }
  }
  if (/POSTHOG_PERSON_API_KEY/.test(vite)) findings.push('vite:posthog-person-key-public')

  const quality = workflows['quality.yml'] ?? ''
  const preproduction = quality.split('\n  deploy-preproduction:')[1] ?? ''
  if (!/branches:\s*\[[^\]]*\bmain\b[^\]]*\bpreprod\b[^\]]*\]/.test(quality)) {
    findings.push('preproduction:push-trigger')
  }
  if (!/\bpull_request\s*:/.test(quality)) findings.push('preproduction:pull-request-trigger')
  if (!preproduction.includes("github.event_name == 'push'")) {
    findings.push('preproduction:push-only')
  }
  if (!preproduction.includes("github.ref == 'refs/heads/preprod'")) {
    findings.push('preproduction:branch-only')
  }
  if (!/^\s{4}environment: preproduction$/m.test(preproduction)) {
    findings.push('preproduction:environment')
  }
  const needs = preproduction.match(/^\s{4}needs:\s*\[([^\]]+)\]/m)?.[1] ?? ''
  for (const job of ['actionlint', 'security', 'backend', 'web', 'e2e']) {
    if (!new RegExp(`\\b${job}\\b`).test(needs)) findings.push(`preproduction:needs:${job}`)
  }
  if (
    !preproduction.includes(
      'test "$(git rev-parse "$GITHUB_SHA^{tree}")" = "$(git rev-parse \'origin/main^{tree}\')"',
    )
  ) {
    findings.push('preproduction:main-tree-guard')
  }
  const preproductionSecretLines = preproduction
    .split('\n')
    .filter((line) => line.includes('secrets.CONVEX_DEPLOY_KEY'))
  if (
    preproductionSecretLines.length !== 3 ||
    preproductionSecretLines.some(
      (line) => !/^\s{10}CONVEX_DEPLOY_KEY: \$\{\{ secrets\.CONVEX_DEPLOY_KEY \}\}$/.test(line),
    )
  ) {
    findings.push('preproduction:CONVEX_DEPLOY_KEY:scope')
  }
  if (/\bVERCEL_(?:TOKEN|ORG_ID|PROJECT_ID)\b/.test(preproduction)) {
    findings.push('preproduction:vercel-coupling')
  }
  let preproductionPrevious = -1
  for (const step of PREPRODUCTION_STEP_ORDER) {
    const index = preproduction.indexOf(`name: ${step}`)
    if (index < 0 || index <= preproductionPrevious) {
      findings.push(`preproduction:step-order:${step}`)
    }
    preproductionPrevious = index
  }

  const production = workflows['deploy-production.yml'] ?? ''
  if (!/tags:\s*\n\s*- ['"]v\*['"]/.test(production)) findings.push('production:tag-trigger')
  if (/^\s{0,6}branches\s*:/m.test(production)) findings.push('production:branch-trigger')
  if (!production.includes('test "$GITHUB_SHA" = "$(git rev-parse origin/main)"')) {
    findings.push('production:tag-must-match-main-head')
  }
  for (const secret of ['CONVEX_DEPLOY_KEY', 'CONVEX_PREPROD_DEPLOY_KEY', 'VERCEL_TOKEN']) {
    for (const line of production
      .split('\n')
      .filter((candidate) => candidate.includes(`secrets.${secret}`))) {
      if ((line.match(/^\s*/)?.[0].length ?? 0) < 10) findings.push(`production:${secret}:scope`)
    }
  }
  if (!production.includes('--skip-domain')) findings.push('production:missing-skip-domain')
  const preflightCommands = production.match(/convex run preflight:check[^\n]*/g) ?? []
  if (
    preflightCommands.length !== 3 ||
    preflightCommands.some(
      (command) => !command.includes('| node scripts/convex-preflight-gate.mjs'),
    )
  ) {
    findings.push('production:unenforced-convex-preflight')
  }
  const candidateGate =
    'convex env list | node --experimental-strip-types scripts/convex-production-config-gate.mjs'
  const canaryDeploy = workflowStep(production, 'Deploy candidate Convex backend to preproduction')
  const canaryCheck = workflowStep(production, 'Check candidate Convex preproduction configuration')
  const productionGate = workflowStep(production, 'Gate candidate against production configuration')
  const productionDeploy = workflowStep(production, 'Deploy Convex production backend')
  const productionBuild = workflowStep(production, 'Build immutable production candidate')
  if (
    !canaryDeploy.includes('secrets.CONVEX_PREPROD_DEPLOY_KEY') ||
    canaryDeploy.includes('secrets.CONVEX_DEPLOY_KEY') ||
    !canaryDeploy.includes('pnpm run deploy:ci --message "$GITHUB_SHA-canary"') ||
    !canaryCheck.includes('secrets.CONVEX_PREPROD_DEPLOY_KEY') ||
    !canaryCheck.includes(`preflight:check '{"target":"preproduction"}'`)
  ) {
    findings.push('production:missing-convex-canary')
  }
  if (
    !productionGate.includes('secrets.CONVEX_DEPLOY_KEY') ||
    !productionGate.includes('set -o pipefail') ||
    !productionGate.includes(candidateGate)
  ) {
    findings.push('production:missing-candidate-config-gate')
  }
  if (
    !productionDeploy.includes('secrets.CONVEX_DEPLOY_KEY') ||
    productionDeploy.includes('secrets.CONVEX_PREPROD_DEPLOY_KEY')
  ) {
    findings.push('production:wrong-convex-production-target')
  }
  const posthogSecretLines = production
    .split('\n')
    .filter((line) => line.includes('secrets.POSTHOG_PERSONAL_API_KEY'))
  if (
    posthogSecretLines.length !== 1 ||
    !productionBuild.includes(
      'POSTHOG_PERSONAL_API_KEY: ${{ secrets.POSTHOG_PERSONAL_API_KEY }}',
    ) ||
    !productionBuild.includes('VITE_APP_VERSION: ${{ github.ref_name }}') ||
    !productionBuild.includes('VITE_GIT_SHA: ${{ github.sha }}')
  ) {
    findings.push('production:posthog-source-maps-scope')
  }
  let previous = -1
  for (const step of STEP_ORDER) {
    const index = production.indexOf(`name: ${step}`)
    if (index < 0 || index <= previous) findings.push(`production:step-order:${step}`)
    previous = index
  }

  let enabled
  if (vercel && typeof vercel === 'object' && 'git' in vercel) {
    const git = vercel.git
    if (git && typeof git === 'object' && 'deploymentEnabled' in git) {
      enabled = git.deploymentEnabled
    }
  }
  if (
    enabled !== false &&
    !(enabled && typeof enabled === 'object' && 'main' in enabled && enabled.main === false)
  ) {
    findings.push('vercel:main-deployment-enabled')
  }
  return findings
}

function selfTest() {
  const preflight = `pnpm --filter backend exec convex run preflight:check '{"target":"production"}' | node scripts/convex-preflight-gate.mjs`
  const canaryPreflight = `pnpm --filter backend exec convex run preflight:check '{"target":"preproduction"}' | node scripts/convex-preflight-gate.mjs`
  const valid = `on:\n  push:\n    tags:\n      - 'v*'\njobs:\n  validate:\n    steps:\n      - run: test "$GITHUB_SHA" = "$(git rev-parse origin/main)"\n  deploy:\n    steps:\n      - name: Check current Convex production configuration\n        env:\n          CONVEX_DEPLOY_KEY: \${{ secrets.CONVEX_DEPLOY_KEY }}\n        run: ${preflight}\n      - name: Build immutable production candidate\n        env:\n          POSTHOG_PERSONAL_API_KEY: \${{ secrets.POSTHOG_PERSONAL_API_KEY }}\n          VITE_APP_VERSION: \${{ github.ref_name }}\n          VITE_GIT_SHA: \${{ github.sha }}\n      - name: Deploy staged production candidate\n        env:\n          VERCEL_TOKEN: \${{ secrets.VERCEL_TOKEN }}\n        run: vercel --skip-domain\n      - name: Deploy candidate Convex backend to preproduction\n        env:\n          CONVEX_DEPLOY_KEY: \${{ secrets.CONVEX_PREPROD_DEPLOY_KEY }}\n        run: pnpm run deploy:ci --message "$GITHUB_SHA-canary"\n      - name: Check candidate Convex preproduction configuration\n        env:\n          CONVEX_DEPLOY_KEY: \${{ secrets.CONVEX_PREPROD_DEPLOY_KEY }}\n        run: ${canaryPreflight}\n      - name: Gate candidate against production configuration\n        env:\n          CONVEX_DEPLOY_KEY: \${{ secrets.CONVEX_DEPLOY_KEY }}\n        run: |\n          set -o pipefail\n          pnpm --filter backend exec convex env list | node --experimental-strip-types scripts/convex-production-config-gate.mjs\n      - name: Deploy Convex production backend\n        env:\n          CONVEX_DEPLOY_KEY: \${{ secrets.CONVEX_DEPLOY_KEY }}\n      - name: Check candidate Convex production configuration\n        run: ${preflight}\n      - name: Smoke test staged candidate\n      - name: Promote tested candidate\n`
  const quality = `on:\n  push:\n    branches: [main, preprod]\n  pull_request:\njobs:\n  deploy-preproduction:\n    needs: [actionlint, security, backend, web, e2e]\n    if: github.event_name == 'push' && github.ref == 'refs/heads/preprod'\n    environment: preproduction\n    steps:\n      - name: Require the current main tree\n        run: test "$(git rev-parse "$GITHUB_SHA^{tree}")" = "$(git rev-parse 'origin/main^{tree}')"\n      - name: Check current Convex preproduction configuration\n        env:\n          CONVEX_DEPLOY_KEY: \${{ secrets.CONVEX_DEPLOY_KEY }}\n      - name: Deploy Convex preproduction backend\n        env:\n          CONVEX_DEPLOY_KEY: \${{ secrets.CONVEX_DEPLOY_KEY }}\n      - name: Check candidate Convex preproduction configuration\n        env:\n          CONVEX_DEPLOY_KEY: \${{ secrets.CONVEX_DEPLOY_KEY }}\n`
  assert.deepEqual(
    auditDeploymentConfig(
      { 'deploy-production.yml': valid, 'quality.yml': quality },
      { git: { deploymentEnabled: false } },
    ),
    [],
  )
  for (const [needle, changed] of [
    ['scope', valid.replace('          CONVEX_', '      CONVEX_')],
    ['branch-trigger', `${valid}\nbranches: [main]\n`],
    ['missing-skip-domain', valid.replace('--skip-domain', '')],
    ['tag-must-match-main-head', valid.replace('test "$GITHUB_SHA" =', 'test "$GITHUB_SHA" !=')],
    ['step-order', valid.replace('name: Promote tested candidate', 'name: Promote too early')],
    ['unenforced-convex-preflight', valid.replace('| node scripts/convex-preflight-gate.mjs', '')],
    [
      'missing-convex-canary',
      valid.replace('secrets.CONVEX_PREPROD_DEPLOY_KEY', 'secrets.OTHER_KEY'),
    ],
    [
      'missing-candidate-config-gate',
      valid.replace(
        '| node --experimental-strip-types scripts/convex-production-config-gate.mjs',
        '',
      ),
    ],
    [
      'wrong-convex-production-target',
      valid.replace(
        '      - name: Deploy Convex production backend\n        env:\n          CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}',
        '      - name: Deploy Convex production backend\n        env:\n          CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_PREPROD_DEPLOY_KEY }}',
      ),
    ],
    [
      'posthog-source-maps-scope',
      valid.replace('secrets.POSTHOG_PERSONAL_API_KEY', 'secrets.OTHER_KEY'),
    ],
  ])
    assert.ok(
      auditDeploymentConfig(
        { 'deploy-production.yml': changed, 'quality.yml': quality },
        { git: { deploymentEnabled: false } },
      ).some((finding) => finding.includes(needle)),
    )
  assert.ok(
    auditDeploymentConfig(
      {
        'deploy-production.yml': valid,
        'quality.yml': quality,
        'preview.yml': 'on: pull_request:\nenv:\n  VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}',
      },
      { git: { deploymentEnabled: false } },
    ).includes('preview.yml:vercel-secret-in-pr'),
  )
  assert.ok(
    auditDeploymentConfig(
      {
        'deploy-production.yml': valid,
        'quality.yml': quality,
        'preview.yml':
          'on: pull_request:\nenv:\n  POSTHOG_PERSONAL_API_KEY: ${{ secrets.POSTHOG_PERSONAL_API_KEY }}',
      },
      { git: { deploymentEnabled: false } },
    ).includes('preview.yml:posthog-secret-in-pr'),
  )
  assert.equal(
    enforceConvexPreflight('{"ready":true,"missing":[],"inconsistent":[]}'),
    'Convex preflight passed.',
  )
  assert.throws(
    () =>
      enforceConvexPreflight(
        '{"ready":false,"missing":["AUTH_RESEND_KEY"],"inconsistent":["PRODUCTION_REQUIRES_POLAR_PRODUCTION"]}',
      ),
    /missing:AUTH_RESEND_KEY, inconsistent:PRODUCTION_REQUIRES_POLAR_PRODUCTION/,
  )
  assert.throws(
    () => enforceConvexPreflight('{"ready":false,"missing":["secret=value"],"inconsistent":[]}'),
    (error) => error instanceof Error && !error.message.includes('secret=value'),
  )
  assert.equal(
    enforceCandidateProductionConfiguration(
      [
        'ABUSE_KEY_SECRET=secret',
        'AUTH_EMAIL_FROM=ScreenForge <hello@screenforge.example>',
        'AUTH_RESEND_KEY=secret',
        'CHECKOUT_SUCCESS_URL=https://screenforge.example/?checkout=success',
        'CORS_ALLOWED_ORIGINS=https://screenforge.example',
        'POLAR_ACCESS_TOKEN=secret',
        'POLAR_CLOUD_PRODUCT_ID=secret',
        'POLAR_SERVER=production',
        'POLAR_WEBHOOK_SECRET=secret',
        'POSTHOG_HOST=https://eu.posthog.com',
        'POSTHOG_PERSON_API_KEY=secret',
        'POSTHOG_PROJECT_ID=254685',
        'SITE_URL=https://screenforge.example',
      ].join('\n'),
    ),
    'Convex preflight passed.',
  )
  assert.ok(
    auditDeploymentConfig(
      { 'deploy-production.yml': valid, 'quality.yml': quality },
      { git: { deploymentEnabled: false } },
      'const key = process.env.POSTHOG_PERSON_API_KEY',
    ).includes('vite:posthog-person-key-public'),
  )
  for (const [finding, changed] of [
    ['push-trigger', quality.replace('main, preprod', 'main')],
    ['pull-request-trigger', quality.replace('  pull_request:\n', '')],
    ['push-only', quality.replace("github.event_name == 'push' && ", '')],
    ['branch-only', quality.replace(" && github.ref == 'refs/heads/preprod'", '')],
    ['environment', quality.replace('environment: preproduction', 'environment: production')],
    ['needs:actionlint', quality.replace('actionlint, ', '')],
    ['main-tree-guard', quality.replace("origin/main^{tree}')", "origin/preprod^{tree}')")],
    [
      'CONVEX_DEPLOY_KEY:scope',
      quality.replace('          CONVEX_DEPLOY_KEY:', '      CONVEX_DEPLOY_KEY:'),
    ],
    [
      'step-order:Check current',
      quality.replace('name: Check current Convex preproduction configuration', 'name: Check old'),
    ],
    [
      'step-order:Deploy Convex',
      quality.replace('name: Deploy Convex preproduction backend', 'name: Deploy backend'),
    ],
    [
      'step-order:Check candidate',
      quality.replace(
        'name: Check candidate Convex preproduction configuration',
        'name: Check new',
      ),
    ],
    ['vercel-coupling', `${quality}\n    env:\n      VERCEL_TOKEN: nope\n`],
  ]) {
    assert.ok(
      auditDeploymentConfig(
        { 'deploy-production.yml': valid, 'quality.yml': changed },
        { git: { deploymentEnabled: false } },
      ).some((candidate) => candidate.includes(finding)),
      finding,
    )
  }
}

async function main() {
  if (process.argv.includes('--self-test')) selfTest()
  const directory = resolve(ROOT, '.github/workflows')
  const names = (await readdir(directory)).filter((name) => /\.ya?ml$/.test(name))
  const workflows = Object.fromEntries(
    await Promise.all(
      names.map(async (name) => [name, await readFile(resolve(directory, name), 'utf8')]),
    ),
  )
  const vercel = JSON.parse(await readFile(resolve(ROOT, 'vercel.json'), 'utf8'))
  const vite = await readFile(resolve(ROOT, 'apps/web/vite.config.ts'), 'utf8')
  const findings = auditDeploymentConfig(workflows, vercel, vite)
  if (findings.length)
    throw new Error(`Deployment configuration audit failed: ${findings.join(', ')}`)
  console.log('Deployment configuration audit passed.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await main()
