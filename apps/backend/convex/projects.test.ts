import { describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { MAX_PROJECT_BLOB_BYTES } from './media'
import { cloudAccount, testConvex } from './test.helpers'

/**
 * Le point dur de la migration, mesuré plutôt qu'affirmé.
 *
 * Convex plafonne un document à 1 MiB, `data jsonb` ne plafonnait rien, et le
 * modèle produit régulièrement des projets au-dessus : vingt releases portent
 * vingt-et-une copies du graphe. Le premier test construit ce cas et **vérifie
 * la taille** avant de pousser — sans cette mesure il prouverait seulement
 * qu'un petit JSON fait l'aller-retour, ce qui n'était pas la question.
 *
 * Ce que le simulateur ne rejoue pas : le POST vers l'URL de téléversement
 * (`convex-test` rend une URL factice), donc les octets sont déposés par
 * `ctx.storage.store`. Le plafond de document lui-même n'est pas appliqué non
 * plus — c'est le déploiement réel qui le dira, et `phase-6.md` le prévoit.
 */

/** Un écran plausible : c'est son poids qui compte, pas sa validité. */
function screen(index: number) {
  return {
    id: `screen-${index}`,
    name: `Écran ${index + 1}`,
    background: {
      type: 'gradient',
      angle: 135,
      stops: [
        { offset: 0, color: '#0f172a' },
        { offset: 1, color: '#1e293b' },
      ],
    },
    layers: Array.from({ length: 24 }, (_, rank) => ({
      id: `layer-${index}-${rank}`,
      type: rank % 3 === 0 ? 'text' : 'shape',
      text: 'Concevez vos captures App Store sans quitter le navigateur.',
      left: 120 + rank,
      top: 240 + rank * 90,
      width: 1080,
      height: 132,
      angle: 0,
      opacity: 1,
      fontFamily: 'Inter',
      fontSize: 64,
      fontWeight: 600,
      fill: '#f8fafc',
      textAlign: 'center',
      shadow: { color: 'rgba(0, 0, 0, 0.24)', blur: 24, offsetX: 0, offsetY: 12 },
    })),
  }
}

/** `{ name, screens, layoutLayers, globals }` : le projet moins son identité. */
function snapshot() {
  return {
    name: 'ScreenForge',
    screens: Array.from({ length: 10 }, (_, index) => screen(index)),
    layoutLayers: [],
    globals: { deviceModel: 'iphone-16-pro-max', deviceColor: 'natural-titanium' },
  }
}

/** Le pire cas prévu par le modèle : 20 releases figées et 12 variantes. */
function heavyProject() {
  return {
    ...snapshot(),
    id: 'project-lourd',
    updatedAt: 1_770_000_000_000,
    releases: Array.from({ length: 20 }, (_, rank) => ({
      id: `release-${rank}`,
      createdAt: 1_760_000_000_000 + rank,
      locale: 'fr-FR',
      snapshot: snapshot(),
    })),
    locales: Array.from({ length: 12 }, (_, rank) => ({
      locale: `loc-${rank}`,
      overrides: Object.fromEntries(
        Array.from({ length: 40 }, (_, key) => [
          `layer-${key}`,
          'Concevez vos captures App Store sans quitter le navigateur.',
        ]),
      ),
    })),
  }
}

/** Les octets, puis la ligne : l'ordre du client, tenu par le test aussi. */
async function push(
  t: ReturnType<typeof testConvex>,
  userId: Id<'users'>,
  row: { projectId: string; name: string; updatedAt: number },
  payload: unknown,
) {
  const as = t.withIdentity({ subject: userId })
  await as.mutation(api.projects.beginProjectPush, {})
  const blobId = await t.run((ctx) =>
    ctx.storage.store(new Blob([JSON.stringify(payload)], { type: 'application/json' })),
  )
  const outcome = await as.mutation(api.projects.pushProject, { ...row, blobId })
  return { outcome, blobId }
}

/** Le fichier est-il encore là ? C'est la seule question qu'un orphelin pose. */
async function stored(t: ReturnType<typeof testConvex>, blobId: Id<'_storage'>) {
  return (await t.run((ctx) => ctx.db.system.get(blobId))) !== null
}

describe('un projet trop gros pour un document', () => {
  it('fait l’aller-retour entier au-dessus de 1 MiB', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    const project = heavyProject()
    const json = JSON.stringify(project)

    /* La mesure d'abord : si elle passait sous le plafond, tout le reste du
       test ne dirait plus rien du problème qu'il est censé couvrir. */
    expect(new Blob([json]).size).toBeGreaterThan(1024 * 1024)

    const { outcome } = await push(
      t,
      userId,
      { projectId: project.id, name: project.name, updatedAt: project.updatedAt },
      project,
    )
    expect(outcome).toBe('accepted')

    const response = await t.withIdentity({ subject: userId }).fetch(`/project-blob/${project.id}`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(project)
  })
})

describe('dernier écrivain gagne', () => {
  it('garde la version la plus récente, quel que soit l’ordre d’arrivée', async () => {
    for (const order of [
      [100, 200],
      [200, 100],
    ]) {
      const t = testConvex()
      const userId = await cloudAccount(t)
      await Promise.all(
        order.map((updatedAt) =>
          push(t, userId, { projectId: 'p', name: `v${updatedAt}`, updatedAt }, { updatedAt }),
        ),
      )
      const rows = await t.withIdentity({ subject: userId }).query(api.projects.listProjects, {})
      expect(rows).toEqual([{ projectId: 'p', name: 'v200', updatedAt: 200 }])
    }
  })

  it('refuse une version plus ancienne sans laisser son blob derrière elle', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    const recent = await push(
      t,
      userId,
      { projectId: 'p', name: 'récent', updatedAt: 200 },
      { v: 2 },
    )
    const ancien = await push(
      t,
      userId,
      { projectId: 'p', name: 'ancien', updatedAt: 100 },
      { v: 1 },
    )

    expect(ancien.outcome).toBe('stale')
    /* Le refus est le cas fréquent — deux navigateurs qui poussent le même
       cycle — donc un octet laissé ici serait payé à chaque fois. */
    expect(await stored(t, ancien.blobId)).toBe(false)
    expect(await stored(t, recent.blobId)).toBe(true)
  })

  it('refuse aussi l’égalité, pour ne pas réécrire ce qui est déjà là', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    await push(t, userId, { projectId: 'p', name: 'un', updatedAt: 100 }, { v: 1 })
    const rejoué = await push(t, userId, { projectId: 'p', name: 'deux', updatedAt: 100 }, { v: 2 })
    expect(rejoué.outcome).toBe('stale')
    expect(await stored(t, rejoué.blobId)).toBe(false)
  })

  it('refuse un blob au-dessus du plafond et ne le garde pas', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    const as = t.withIdentity({ subject: userId })
    await as.mutation(api.projects.beginProjectPush, {})
    const blobId = await t.run((ctx) =>
      ctx.storage.store(new Blob([new Uint8Array(MAX_PROJECT_BLOB_BYTES + 1)])),
    )

    const outcome = await as.mutation(api.projects.pushProject, {
      projectId: 'p',
      name: 'p',
      updatedAt: 1,
      blobId,
    })
    expect(outcome).toBe('too-large')
    expect(await stored(t, blobId)).toBe(false)
    expect(await as.query(api.projects.listProjects, {})).toEqual([])
  })

  it('supprime le blob remplacé quand elle accepte', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    const premier = await push(t, userId, { projectId: 'p', name: 'un', updatedAt: 100 }, { v: 1 })
    const second = await push(t, userId, { projectId: 'p', name: 'deux', updatedAt: 200 }, { v: 2 })

    expect(second.outcome).toBe('accepted')
    expect(await stored(t, premier.blobId)).toBe(false)
    expect(await stored(t, second.blobId)).toBe(true)
  })
})

describe('le catalogue', () => {
  it('ne montre que les projets de celui qui demande', async () => {
    const t = testConvex()
    const moi = await cloudAccount(t)
    const autre = await cloudAccount(t)
    await push(t, moi, { projectId: 'à-moi', name: 'à moi', updatedAt: 1 }, { v: 1 })
    await push(t, autre, { projectId: 'à-lui', name: 'à lui', updatedAt: 1 }, { v: 1 })

    const rows = await t.withIdentity({ subject: moi }).query(api.projects.listProjects, {})
    expect(rows.map((row) => row.projectId)).toEqual(['à-moi'])
  })

  it('rend 404 sur le blob d’un autre compte, jamais 403', async () => {
    /* Un 403 confirmerait l'existence, et c'est exactement ce que
       `storage_assets.sql` refusait de laisser deviner. */
    const t = testConvex()
    const propriétaire = await cloudAccount(t)
    const curieux = await cloudAccount(t)
    await push(t, propriétaire, { projectId: 'secret', name: 'secret', updatedAt: 1 }, { v: 1 })

    const response = await t.withIdentity({ subject: curieux }).fetch('/project-blob/secret')
    expect(response.status).toBe(404)
  })

  it('supprimer emporte la ligne et le fichier', async () => {
    const t = testConvex()
    const userId = await cloudAccount(t)
    const { blobId } = await push(t, userId, { projectId: 'p', name: 'p', updatedAt: 1 }, { v: 1 })

    const as = t.withIdentity({ subject: userId })
    await expect(as.mutation(api.projects.removeProject, { projectId: 'p' })).resolves.toBe(true)
    expect(await stored(t, blobId)).toBe(false)
    expect(await as.query(api.projects.listProjects, {})).toEqual([])
  })
})
