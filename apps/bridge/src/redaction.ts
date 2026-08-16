import { homedir } from 'node:os'

const DEFAULT_LIMIT = 2_000

function escaped(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Nettoie toute donnée issue d'un processus avant HTTP, console ou capture. */
export function redactDiagnostic(value: unknown, limit = DEFAULT_LIMIT): string {
  const text = value instanceof Error ? value.message : String(value)
  const home = homedir()
  return text
    .replace(/-----BEGIN [^-\r\n]+-----[\s\S]*?-----END [^-\r\n]+-----/g, '[REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]+\b/g, '[REDACTED]')
    .replace(
      /\b(?:sk-(?:ant|or)-[A-Za-z0-9_-]+|gh[oprsu]_[A-Za-z0-9_]+|xox[baprs]-[A-Za-z0-9-]+)\b/gi,
      '[REDACTED]',
    )
    .replace(
      /\b([A-Za-z_]*(?:key|token|secret|password|issuer)[A-Za-z_]*)\s*[:=]\s*(?:"[^"]*"|'[^']*'|\S+)/gi,
      '$1=[REDACTED]',
    )
    .replace(/\S+\.p8\b/gi, '[REDACTED]')
    .replace(new RegExp(escaped(home), 'g'), '[REDACTED_PATH]')
    .replace(/\/(?:Users|home)\/[^/\s]+(?:\/[^\s]*)?/g, '[REDACTED_PATH]')
    .replace(/[A-Za-z]:\\Users\\[^\\\s]+(?:\\[^\s]*)?/gi, '[REDACTED_PATH]')
    .slice(0, limit)
    .trim()
}
