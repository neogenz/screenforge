import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(import.meta.dirname, '..')
const STEP_ORDER = [
  'Check current Convex production configuration',
  'Deploy staged production candidate',
  'Deploy Convex production backend',
  'Check candidate Convex production configuration',
  'Smoke test staged candidate',
  'Promote tested candidate',
]

/** @param {Record<string, string>} workflows @param {unknown} vercel */
export function auditDeploymentConfig(workflows, vercel) {
  const findings = []
  for (const [name, source] of Object.entries(workflows)) {
    if (/\bpull_request_target\s*:/.test(source)) findings.push(`${name}:pull-request-target`)
    if (/\bpull_request\s*:/.test(source) && /secrets\.VERCEL_TOKEN/.test(source)) {
      findings.push(`${name}:vercel-secret-in-pr`)
    }
  }

  const production = workflows['deploy-production.yml'] ?? ''
  if (!/tags:\s*\n\s*- ['"]v\*['"]/.test(production)) findings.push('production:tag-trigger')
  if (/^\s{0,6}branches\s*:/m.test(production)) findings.push('production:branch-trigger')
  for (const secret of ['CONVEX_DEPLOY_KEY', 'VERCEL_TOKEN']) {
    for (const line of production
      .split('\n')
      .filter((candidate) => candidate.includes(`secrets.${secret}`))) {
      if ((line.match(/^\s*/)?.[0].length ?? 0) < 10) findings.push(`production:${secret}:scope`)
    }
  }
  if (!production.includes('--skip-domain')) findings.push('production:missing-skip-domain')
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
  const valid = `on:\n  push:\n    tags:\n      - 'v*'\njobs:\n  deploy:\n    steps:\n      - name: Check current Convex production configuration\n        env:\n          CONVEX_DEPLOY_KEY: \${{ secrets.CONVEX_DEPLOY_KEY }}\n      - name: Deploy staged production candidate\n        env:\n          VERCEL_TOKEN: \${{ secrets.VERCEL_TOKEN }}\n        run: vercel --skip-domain\n      - name: Deploy Convex production backend\n      - name: Check candidate Convex production configuration\n      - name: Smoke test staged candidate\n      - name: Promote tested candidate\n`
  assert.deepEqual(
    auditDeploymentConfig(
      { 'deploy-production.yml': valid },
      { git: { deploymentEnabled: false } },
    ),
    [],
  )
  for (const [needle, changed] of [
    ['scope', valid.replace('          CONVEX_', '      CONVEX_')],
    ['branch-trigger', `${valid}\nbranches: [main]\n`],
    ['missing-skip-domain', valid.replace('--skip-domain', '')],
    ['step-order', valid.replace('name: Promote tested candidate', 'name: Promote too early')],
  ])
    assert.ok(
      auditDeploymentConfig(
        { 'deploy-production.yml': changed },
        { git: { deploymentEnabled: false } },
      ).some((finding) => finding.includes(needle)),
    )
  assert.ok(
    auditDeploymentConfig(
      {
        'deploy-production.yml': valid,
        'preview.yml': 'on: pull_request:\nenv:\n  VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}',
      },
      { git: { deploymentEnabled: false } },
    ).includes('preview.yml:vercel-secret-in-pr'),
  )
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
  const findings = auditDeploymentConfig(workflows, vercel)
  if (findings.length)
    throw new Error(`Deployment configuration audit failed: ${findings.join(', ')}`)
  console.log('Deployment configuration audit passed.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await main()
