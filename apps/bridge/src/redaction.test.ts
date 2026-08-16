import { describe, expect, it } from 'vitest'
import { redactDiagnostic } from './redaction.ts'

describe('redaction des diagnostics', () => {
  it('masque secrets et chemins, borne la sortie et conserve le diagnostic ordinaire', () => {
    const sensitive = [
      '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----',
      'token="secret value"',
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature',
      'sk-ant-api03-example',
      '/Users/alice/work/AuthKey_PRIVATE.p8',
      'C:\\Users\\alice\\secret.txt',
    ].join('\n')
    const redacted = redactDiagnostic(sensitive)

    expect(redacted).not.toMatch(/MIIE|secret value|eyJ|api03|alice|PRIVATE/)
    expect(redacted).toContain('[REDACTED]')
    expect(redactDiagnostic('status=ok version=1.2.3')).toBe('status=ok version=1.2.3')
    expect(redactDiagnostic('x'.repeat(10_000))).toHaveLength(2_000)
  })
})
