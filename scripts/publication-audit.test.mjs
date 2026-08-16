import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { auditEntries } from './publication-audit.mjs'

describe('publication audit', () => {
  it('autorise uniquement le fichier env exemple à la racine', () => {
    assert.deepEqual(auditEntries([{ path: '.env.example' }]), [])
    for (const path of ['.env', '.env.local', 'apps/web/.env.example', 'ops/.ENV.PRODUCTION']) {
      assert.ok(auditEntries([{ path }]).some(({ rule }) => rule === 'environment-file'))
    }
  })

  it('refuse les fichiers de credentials sous toute casse et tout sous-dossier', () => {
    for (const path of [
      'ops/AuthKey.P8',
      'docs/public.CRT',
      'nested/id_ed25519',
      'tmp/client-secret.json',
      '.private/notes.md',
    ]) {
      assert.ok(auditEntries([{ path }]).length > 0, path)
    }
  })

  it('traite AIDD comme public et les artifacts comme non fiables', () => {
    assert.deepEqual(
      auditEntries([
        {
          path: 'aidd_docs/proof.md',
          content: 'Variable `POLAR_ACCESS_TOKEN`, état pass, SHA `0123456789abcdef`.',
        },
      ]),
      [],
    )
    assert.ok(
      auditEntries([{ path: 'aidd_docs/proof.md', content: 'capture: /Users/person/report' }])
        .length > 0,
    )
    const token = ['ghp', 'abcdefghijklmnopqrstuvwxyz0123456789'].join('_')
    assert.ok(
      auditEntries([{ path: 'test-results/report.txt', content: token, artifact: true }]).length >
        0,
    )
  })

  it('n’autorise que des fingerprints exacts dans Gitleaks', () => {
    assert.deepEqual(
      auditEntries([
        {
          path: '.gitleaksignore',
          content: '0123456789abcdef0123456789abcdef01234567:file.ts:generic-api-key:4\n',
        },
      ]),
      [],
    )
    assert.ok(
      auditEntries([{ path: '.gitleaksignore', content: 'aidd_docs/**\n' }]).some(
        ({ rule }) => rule === 'broad-gitleaks-ignore',
      ),
    )
  })
})
