import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CONTENT_FONTS,
  createAiTools,
  DEVICE_MODEL_IDS,
  ICON_IDS,
  SHAPE_IDS,
  validateAgainst,
  type ToolCall,
} from '@screenforge/project-format'
import { ADD_IMAGE_SCHEMA } from './tools/add-image.ts'

/**
 * Le skill agent est une copie datée, et c'est ce test qui la date.
 *
 * `references/tools.md` recopie les schémas du contrat parce qu'un agent lit un
 * fichier, pas un module TypeScript. Une copie sans lecteur automatique dérive
 * au premier outil ajouté — et la dérive prend la forme la plus coûteuse qui
 * soit : un agent qui suit consciencieusement une documentation fausse et se
 * fait refuser chaque appel sans savoir pourquoi.
 *
 * Ce test ne vérifie pas la prose. Il vérifie les seules choses qu'un ajout au
 * contrat rend fausses en silence : la liste des outils et les catalogues
 * fermés dans lesquels ils piochent.
 */

const TOOLS_DOC = fileURLToPath(
  new URL('../skills/screenforge-mcp/references/tools.md', import.meta.url),
)
const SKILL_DIR = fileURLToPath(new URL('../skills/screenforge-mcp', import.meta.url))

const { AI_TOOLS, validateToolCall } = createAiTools({
  deviceModels: DEVICE_MODEL_IDS,
  shapeIds: SHAPE_IDS,
  iconIds: ICON_IDS,
  fonts: CONTENT_FONTS,
})

/** Ceux que le démon ajoute par-dessus le contrat partagé. */
const DAEMON_ONLY = [
  'apply',
  'get_thumbnail',
  'refresh_screenshots',
  'save_template',
  'list_templates',
] as const

describe('documentation du skill agent', () => {
  it('dérive la planche de l’état du projet', async () => {
    const files = (await readdir(SKILL_DIR, { recursive: true })).filter((file) =>
      file.endsWith('.md'),
    )
    const doc = (
      await Promise.all(files.map((file) => readFile(join(SKILL_DIR, file), 'utf8')))
    ).join('\n')
    expect(doc).not.toMatch(/440\s*(?:by|[×x])\s*956/i)
    expect(doc).toContain('screenforge_get_project_state.canvas.width')
    expect(doc).toContain('screenforge_get_project_state.canvas.height')
  })

  it('nomme chaque outil publié', async () => {
    const doc = await readFile(TOOLS_DOC, 'utf8')
    const published = [...AI_TOOLS.map((tool) => tool.name), ...DAEMON_ONLY]
    const missing = published.filter((name) => !doc.includes(`\`${name}\``))
    expect(missing).toEqual([])
  })

  it('annonce le bon compte', async () => {
    const doc = await readFile(TOOLS_DOC, 'utf8')
    /* `add_image` du contrat est remplacé par celui du démon, pas ajouté. */
    const published = new Set([...AI_TOOLS.map((tool) => tool.name), ...DAEMON_ONLY])
    expect(doc).toContain(`The ${published.size} tools`)
  })

  it('recopie les catalogues fermés en entier', async () => {
    const doc = await readFile(TOOLS_DOC, 'utf8')
    const catalog = [...DEVICE_MODEL_IDS, ...SHAPE_IDS, ...ICON_IDS, ...CONTENT_FONTS]
    const missing = catalog.filter((value) => !doc.includes(`\`${value}\``))
    expect(missing).toEqual([])
  })

  /* Un exemple faux est pire qu'un exemple absent : l'agent le suit à la lettre
     et se fait refuser chaque appel sans rien à corriger dans son raisonnement. */
  it('donne des exemples que le contrat accepte', async () => {
    const blocks = fencedJson(await readFile(TOOLS_DOC, 'utf8'))
    expect(blocks.length).toBeGreaterThan(0)

    for (const block of blocks) {
      if ('calls' in block) {
        for (const call of block.calls as ToolCall[]) {
          expect(`${call.tool} : ${validateToolCall(call) ?? 'ok'}`).toBe(`${call.tool} : ok`)
        }
      } else {
        expect(validateAgainst(ADD_IMAGE_SCHEMA, block)).toBeNull()
      }
    }
  })
})

function fencedJson(doc: string): Record<string, unknown>[] {
  return [...doc.matchAll(/```json\n([\s\S]*?)```/g)].map(
    (match) => JSON.parse(match[1] ?? '') as Record<string, unknown>,
  )
}
