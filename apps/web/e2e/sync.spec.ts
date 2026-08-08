/**
 * La preuve de ce que l'add-on Cloud vend : un projet repris ailleurs.
 *
 * Tout le reste de la suite e2e vérifie qu'un navigateur retrouve son propre
 * travail. Ici, deux contextes distincts — deux profils, deux IndexedDB, aucune
 * mémoire commune — partagent un compte, et le second doit voir ce que le
 * premier a fait, images comprises.
 *
 * La session est semée dans `localStorage` plutôt que gagnée par l'interface :
 * l'application ne propose que le lien magique et le SSO, or l'un arrive par
 * courrier et l'autre passe par un fournisseur tiers. `storageKey` est fixé
 * explicitement dans `lib/supabase.ts` pour que cet emplacement soit connu.
 *
 * Se saute proprement quand le stack local est arrêté ou quand le serveur de
 * développement tourne sans variables Supabase : `pnpm run test:e2e` doit
 * rester exécutable sans Docker, comme aujourd'hui.
 */
import { execFileSync } from 'node:child_process'
import { expect, test, type Browser, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { makeSolidPng } from './device-bezel-fixture'
import { waitForApp } from './helpers'

const STORAGE_KEY = 'screenforge-auth'

function localStack(): { url: string; anonKey: string } | null {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return { url: process.env.SUPABASE_URL, anonKey: process.env.SUPABASE_ANON_KEY }
  }
  try {
    const status = JSON.parse(
      execFileSync('supabase', ['status', '-o', 'json'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    ) as { API_URL: string; ANON_KEY: string }
    return { url: status.API_URL, anonKey: status.ANON_KEY }
  } catch {
    return null
  }
}

const stack = localStack()

/**
 * Crée un compte et rend la valeur exacte que le SDK écrirait dans le
 * navigateur.
 *
 * Le format de cette valeur appartient à `@supabase/supabase-js` et a déjà
 * changé entre deux versions majeures. On ne le reconstruit donc pas à la
 * main : on branche le client sur un stockage en mémoire et on relit ce qu'il
 * y a déposé.
 */
async function signUpSession(url: string, anonKey: string) {
  const written = new Map<string, string>()
  const client = createClient(url, anonKey, {
    auth: {
      storageKey: STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: false,
      storage: {
        getItem: (key) => written.get(key) ?? null,
        setItem: (key, value) => void written.set(key, value),
        removeItem: (key) => void written.delete(key),
      },
    },
  })
  const email = `sync-${Date.now()}-${process.pid}@screenforge.test`
  const { data, error } = await client.auth.signUp({ email, password: 'motdepasse-de-test' })
  expect(error, `inscription : ${error?.message}`).toBeNull()
  expect(data.session, 'aucune session après signUp').not.toBeNull()

  const seed = written.get(STORAGE_KEY)
  expect(seed, 'le SDK n’a rien écrit sous la clé de session').toBeTruthy()
  return { client, userId: data.user!.id, seed: seed! }
}

async function openApp(browser: Browser, baseURL: string, seed: string): Promise<Page> {
  const context = await browser.newContext({ baseURL })
  await context.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
    STORAGE_KEY,
    seed,
  ] as const)
  const page = await context.newPage()
  await waitForApp(page)
  return page
}

/** Le témoin de la barre du haut, lisible quelle que soit la largeur. */
function syncBadge(page: Page, label: string) {
  return page.locator(`[role="status"][title="${label}"]`)
}

function projectName(page: Page) {
  return page.getByLabel('Nom du projet')
}

async function remoteRow(client: SupabaseClient, name: string) {
  const { data, error } = await client
    .from('projects')
    .select('id, name, data, updated_at')
    .eq('name', name)
    .maybeSingle()
  expect(error, `lecture distante : ${error?.message}`).toBeNull()
  return data as { id: string; name: string; data: unknown; updated_at: string } | null
}

test.describe('Sync cloud', () => {
  test.skip(!stack, 'stack Supabase local arrêté')
  /* Deux contextes, un import d'image et deux allers-retours réseau : le
     plafond de 45 s de la configuration est trop court pour ce fichier seul. */
  test.setTimeout(120_000)

  let client: SupabaseClient
  let seed: string
  const createdRowIds: string[] = []

  test.beforeAll(async () => {
    const session = await signUpSession(stack!.url, stack!.anonKey)
    client = session.client
    seed = session.seed
  })

  test.afterAll(async () => {
    for (const id of createdRowIds) await client.from('projects').delete().eq('id', id)
    await client.auth.signOut()
  })

  test('un projet modifié dans un navigateur arrive dans un autre, images comprises', async ({
    browser,
    baseURL,
  }) => {
    const a = await openApp(browser, baseURL!, seed)
    const cloudReady = await a.getByRole('button', { name: /Se (connecter|déconnecter)/ }).count()
    test.skip(cloudReady === 0, 'serveur de développement démarré sans variables Supabase')

    await expect(syncBadge(a, 'Synchronisé')).toBeAttached({ timeout: 30_000 })

    const marker = `Projet sync ${Date.now()}`
    await projectName(a).fill(marker)
    await projectName(a).press('Enter')
    await a.getByLabel('Importer une image').setInputFiles({
      name: 'hero.png',
      mimeType: 'image/png',
      buffer: makeSolidPng(16, 16, [34, 197, 94, 255]),
    })

    /* Critère 2 : la ligne distante porte le nouvel état en moins de 5 s après
       que l'autosave local (2 s de temporisation) l'a commité. */
    let row: Awaited<ReturnType<typeof remoteRow>> = null
    await expect
      .poll(async () => Boolean((row = await remoteRow(client, marker))), { timeout: 7_000 })
      .toBe(true)
    createdRowIds.push(row!.id)

    /* Critère 4 : les binaires vivent dans Storage, jamais dans la colonne.
       Une régression ici ne casse rien de visible — elle multiplie par cent le
       poids de chaque lecture. */
    expect(JSON.stringify(row!.data)).not.toContain('data:image')

    const b = await openApp(browser, baseURL!, seed)
    await expect(projectName(b)).toHaveValue(marker, { timeout: 30_000 })
    /* Le projet, et ce qu'il montre : une ligne tirée sans ses images donnerait
       un document valide et un écran vide. */
    await expect
      .poll(
        () =>
          b.evaluate(
            () =>
              window.__sfStores?.useProjectStore
                .getState()
                .project?.screens.flatMap((screen) => screen.layers)
                .filter((layer) => layer.type === 'image').length ?? 0,
          ),
        { timeout: 15_000 },
      )
      .toBe(1)
    await expect
      .poll(() =>
        b.evaluate(() => {
          const project = window.__sfStores?.useProjectStore.getState().project
          const layer = project?.screens
            .flatMap((screen) => screen.layers)
            .find((candidate) => candidate.type === 'image')
          return layer && 'assetId' in layer
            ? Boolean(window.__sfAssets?.resolveAsset(layer.assetId))
            : false
        }),
      )
      .toBe(true)

    await a.context().close()
    await b.context().close()
  })

  test('une modification hors ligne finit dans le cloud au retour du réseau', async ({
    browser,
    baseURL,
  }) => {
    const page = await openApp(browser, baseURL!, seed)
    const cloudReady = await page
      .getByRole('button', { name: /Se (connecter|déconnecter)/ })
      .count()
    test.skip(cloudReady === 0, 'serveur de développement démarré sans variables Supabase')
    await expect(syncBadge(page, 'Synchronisé')).toBeAttached({ timeout: 30_000 })

    const marker = `Projet hors ligne ${Date.now()}`
    await projectName(page).fill(marker)
    await projectName(page).press('Enter')
    await expect
      .poll(async () => Boolean(await remoteRow(client, marker)), { timeout: 15_000 })
      .toBe(true)
    const before = await remoteRow(client, marker)
    createdRowIds.push(before!.id)

    await page.context().setOffline(true)
    await page.getByLabel('Ajouter Texte').click()
    await expect(syncBadge(page, 'Hors ligne — reprendra au retour du réseau')).toBeAttached({
      timeout: 15_000,
    })

    /* Rien ne demande à l'utilisateur de réessayer : le retour du réseau suffit. */
    await page.context().setOffline(false)
    await expect
      .poll(
        async () => {
          const after = await remoteRow(client, marker)
          return after ? Date.parse(after.updated_at) > Date.parse(before!.updated_at) : false
        },
        { timeout: 30_000 },
      )
      .toBe(true)

    await page.context().close()
  })
})
