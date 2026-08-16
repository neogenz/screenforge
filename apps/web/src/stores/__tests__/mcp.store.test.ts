import { describe, expect, it } from 'vitest'
import { projectMcpSteps, type McpConnectionStep, type McpStatus } from '@/stores/mcp.store'

describe('projectMcpSteps', () => {
  it.each<[McpStatus, McpConnectionStep]>([
    ['off', 'daemon'],
    ['connecting', 'daemon'],
    ['connecting', 'editor'],
    ['live', 'ready'],
    ['error', 'daemon'],
    ['error', 'editor'],
    ['error', 'ready'],
  ])('garde un seul jalon actif ou fautif pour %s/%s', (status, step) => {
    const projection = Object.values(projectMcpSteps(status, step))
    expect(projection.filter((value) => value === 'active' || value === 'error')).toHaveLength(1)
  })
})
