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
 * L'abonnement Cloud est semé avec la session : depuis la phase 5, la sync est
 * l'add-on payant — les policies exigent `has_cloud()` et l'éditeur ne tente
 * rien sans le droit. Un compte fraîchement inscrit est un compte gratuit, donc
 * ce fichier mesurerait la porte commerciale au lieu de la sync. L'octroi passe
 * par `supabase/tests/stack.mjs`, hors de `apps/web` : la clé du backend n'a
 * rien à faire dans le paquet du navigateur, et la CI refuse jusqu'à son nom
 * ici — y compris dans un commentaire, ce qui est le prix d'un garde-fou par
 * `grep` et se paie volontiers.
 *
 * Se saute proprement quand le stack local est arrêté ou quand le serveur de
 * développement tourne sans variables Supabase : `pnpm run test:e2e` doit
 * rester exécutable sans Docker, comme aujourd'hui.
 */
import { expect, test, type Browser, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  backendClient,
  grantCloud,
  grantLicence,
  localStack,
} from '../../../supabase/tests/stack.mjs'
import { makeSolidPng } from './device-bezel-fixture'
import { waitForApp } from './helpers'

const STORAGE_KEY = 'screenforge-auth'

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
let accounts = 0

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
  /* Un compteur en plus de l'horodatage : deux inscriptions dans la même
     milliseconde tomberaient sur la même adresse, et `signUp` rendrait alors un
     utilisateur sans session. */
  accounts += 1
  const email = `sync-${Date.now()}-${process.pid}-${accounts}@screenforge.test`
  const password = 'motdepasse-de-test'
  const { data, error } = await client.auth.signUp({ email, password })
  expect(error, `inscription : ${error?.message}`).toBeNull()
  expect(data.session, 'aucune session après signUp').not.toBeNull()

  const seed = written.get(STORAGE_KEY)
  expect(seed, 'le SDK n’a rien écrit sous la clé de session').toBeTruthy()
  return { client, userId: data.user!.id, seed: seed!, email, password }
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

/**
 * L'entrée de compte, dans l'un ou l'autre de ses deux états.
 *
 * Sa présence est ce qui distingue « le serveur de développement tourne sans
 * variables Supabase » d'un vrai échec : sans instance configurée, `TopBar` ne
 * rend aucune entrée de compte, et tout ce fichier n'aurait rien à mesurer.
 */
const accountButton = /Se connecter|Mon compte/

/**
 * Attend l'entrée de compte au lieu de la compter tout de suite.
 *
 * `count()` ne patiente pas : appelé pendant que la barre du haut se monte, il
 * rend zéro et fait sauter le test au lieu de l'exécuter. Un saut est
 * silencieux — c'est exactement la panne qu'on ne verrait pas.
 */
function accountEntryPresent(page: Page): Promise<boolean> {
  return page
    .getByRole('button', { name: accountButton })
    .first()
    .waitFor({ state: 'attached', timeout: 10_000 })
    .then(
      () => true,
      () => false,
    )
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
  let userId: string
  const createdRowIds: string[] = []

  test.beforeAll(async () => {
    const session = await signUpSession(stack!.url, stack!.anonKey)
    client = session.client
    seed = session.seed
    userId = session.userId

    const { error } = await grantCloud(backendClient(stack!), userId)
    expect(error, `octroi du Cloud : ${error?.message}`).toBeNull()
  })

  test.afterAll(async () => {
    for (const id of createdRowIds) await client.from('projects').delete().eq('id', id)
    await backendClient(stack!).from('entitlements').delete().eq('user_id', userId)
    await client.auth.signOut()
  })

  test('un projet modifié dans un navigateur arrive dans un autre, images comprises', async ({
    browser,
    baseURL,
  }) => {
    const a = await openApp(browser, baseURL!, seed)
    const cloudReady = await accountEntryPresent(a)
    test.skip(!cloudReady, 'serveur de développement démarré sans variables Supabase')

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

  test('une édition locale pendant un téléchargement cloud n’est jamais remplacée', async ({
    browser,
    baseURL,
  }) => {
    const session = await signUpSession(stack!.url, stack!.anonKey)
    expect((await grantCloud(backendClient(stack!), session.userId)).error).toBeNull()

    const sourceContext = await browser.newContext({ baseURL })
    const source = await sourceContext.newPage()
    await waitForApp(source)
    test.skip(!(await accountEntryPresent(source)), 'serveur démarré sans variables Supabase')
    const remoteName = `Cloud retenu ${Date.now()}`
    const fixture = await source.evaluate((name) => {
      window.__sfStores?.useProjectStore.getState().createProject(name)
      const created = window.__sfStores?.useProjectStore.getState()
      const project = created?.project
      if (!created || !project) return null
      const assetId = crypto.randomUUID()
      const remote = structuredClone(project)
      remote.screens[0]!.layers.push({
        id: crypto.randomUUID(),
        type: 'image',
        name: 'Téléchargement retenu',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        zIndex: 0,
        assetId,
        originalWidth: 8,
        originalHeight: 8,
      })
      remote.updatedAt = Date.now()
      return {
        project: remote,
        assetId,
      }
    }, remoteName)
    await sourceContext.close()
    if (!fixture?.project) throw new Error('Could not create the retained remote fixture.')

    expect(
      (
        await session.client.storage
          .from('assets')
          .upload(`${session.userId}/${fixture.assetId}`, makeSolidPng(8, 8, [59, 130, 246, 255]), {
            contentType: 'image/png',
            upsert: true,
          })
      ).error,
    ).toBeNull()
    expect(
      (
        await session.client.rpc('upsert_project_lww', {
          project_id: fixture.project.id,
          project_user_id: session.userId,
          project_name: fixture.project.name,
          project_data: fixture.project as never,
          project_updated_at: new Date(fixture.project.updatedAt).toISOString(),
        })
      ).data,
    ).toBe(true)

    const context = await browser.newContext({ baseURL })
    await context.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
      STORAGE_KEY,
      session.seed,
    ] as const)
    const page = await context.newPage()
    let releaseDownload!: () => void
    const heldDownload = new Promise<void>((resolve) => {
      releaseDownload = resolve
    })
    let markDownloadStarted!: () => void
    const downloadStarted = new Promise<void>((resolve) => {
      markDownloadStarted = resolve
    })
    await page.route('**/storage/v1/object/**', async (route) => {
      if (route.request().method() === 'GET' && route.request().url().includes(fixture.assetId)) {
        markDownloadStarted()
        await heldDownload
      }
      await route.continue()
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(projectName(page)).toBeVisible()
    await downloadStarted

    const localName = `Édition locale ${Date.now()}`
    await projectName(page).fill(localName)
    await projectName(page).press('Enter')
    await expect(page.locator('[role="status"][title="Enregistré"]')).toBeAttached({
      timeout: 15_000,
    })
    releaseDownload()

    await expect(projectName(page)).toHaveValue(localName, { timeout: 30_000 })
    await expect
      .poll(async () => Boolean(await remoteRow(session.client, localName)), { timeout: 30_000 })
      .toBe(true)

    const localRow = await remoteRow(session.client, localName)
    await Promise.all([
      session.client.from('projects').delete().eq('id', fixture.project.id),
      localRow
        ? session.client.from('projects').delete().eq('id', localRow.id)
        : Promise.resolve({ error: null }),
      session.client.storage.from('assets').remove([`${session.userId}/${fixture.assetId}`]),
    ])
    await context.close()
    await backendClient(stack!).from('entitlements').delete().eq('user_id', session.userId)
    await session.client.auth.signOut()
  })

  test('un projet non ciblé édité puis quitté pendant le pull garde sa version locale', async ({
    browser,
    baseURL,
  }) => {
    const session = await signUpSession(stack!.url, stack!.anonKey)
    expect((await grantCloud(backendClient(stack!), session.userId)).error).toBeNull()
    const context = await browser.newContext({ baseURL })
    const page = await context.newPage()
    await waitForApp(page)
    test.skip(!(await accountEntryPresent(page)), 'serveur démarré sans variables Supabase')

    const marker = Date.now()
    const localAName = `Local non ciblé A ${marker}`
    const localBName = `Local actif B ${marker}`
    await page.evaluate(
      (name) => window.__sfStores?.useProjectStore.getState().createProject(name),
      localAName,
    )
    await page.getByLabel('Ajouter Texte').click()
    await expect(page.locator('[role="status"][title="Enregistré"]')).toBeAttached({
      timeout: 15_000,
    })
    const localA = await page.evaluate(() =>
      structuredClone(window.__sfStores?.useProjectStore.getState().project ?? null),
    )
    await page.evaluate(
      (name) => window.__sfStores?.useProjectStore.getState().createProject(name),
      localBName,
    )
    await page.getByLabel('Ajouter Texte').click()
    await expect(page.locator('[role="status"][title="Enregistré"]')).toBeAttached({
      timeout: 15_000,
    })
    if (!localA) throw new Error('Could not create the non-target local fixture.')

    const remoteA = structuredClone(localA)
    remoteA.name = `Remote ancien A ${marker}`
    remoteA.updatedAt = Date.now()
    const remoteAssetId = crypto.randomUUID()
    remoteA.screens[0]!.layers.push({
      id: crypto.randomUUID(),
      type: 'image',
      name: 'Asset distant retenu',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: remoteA.screens[0]!.layers.length,
      assetId: remoteAssetId,
      originalWidth: 8,
      originalHeight: 8,
    })
    expect(
      (
        await session.client.storage
          .from('assets')
          .upload(`${session.userId}/${remoteAssetId}`, makeSolidPng(8, 8, [234, 88, 12, 255]), {
            contentType: 'image/png',
            upsert: true,
          })
      ).error,
    ).toBeNull()
    expect(
      (
        await session.client.rpc('upsert_project_lww', {
          project_id: remoteA.id,
          project_user_id: session.userId,
          project_name: remoteA.name,
          project_data: remoteA as never,
          project_updated_at: new Date(remoteA.updatedAt).toISOString(),
        })
      ).data,
    ).toBe(true)

    let releaseDownload!: () => void
    const heldDownload = new Promise<void>((resolve) => {
      releaseDownload = resolve
    })
    let markDownloadStarted!: () => void
    const downloadStarted = new Promise<void>((resolve) => {
      markDownloadStarted = resolve
    })
    await page.route('**/storage/v1/object/**', async (route) => {
      if (route.request().url().includes(remoteAssetId)) {
        markDownloadStarted()
        await heldDownload
      }
      await route.continue()
    })
    await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [
      STORAGE_KEY,
      session.seed,
    ] as const)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(projectName(page)).toHaveValue(localBName)
    await downloadStarted

    await page.getByLabel('Ouvrir le menu Projet').click()
    await page.getByRole('menuitem', { name: `Ouvrir « ${localAName} »` }).click()
    const editedAName = `${localAName} édité`
    await projectName(page).fill(editedAName)
    await projectName(page).press('Enter')
    await expect(page.locator('[role="status"][title="Enregistré"]')).toBeAttached({
      timeout: 15_000,
    })
    await page.getByLabel('Ouvrir le menu Projet').click()
    await page.getByRole('menuitem', { name: `Ouvrir « ${localBName} »` }).click()
    await expect(projectName(page)).toHaveValue(localBName)
    releaseDownload()

    await expect
      .poll(async () => Boolean(await remoteRow(session.client, editedAName)), { timeout: 30_000 })
      .toBe(true)
    await expect(projectName(page)).toHaveValue(localBName)
    await page.getByLabel('Ouvrir le menu Projet').click()
    await page.getByRole('menuitem', { name: `Ouvrir « ${editedAName} »` }).click()
    await expect(projectName(page)).toHaveValue(editedAName)

    const row = await remoteRow(session.client, editedAName)
    if (row) await session.client.from('projects').delete().eq('id', row.id)
    await session.client.storage.from('assets').remove([`${session.userId}/${remoteAssetId}`])
    await context.close()
    await backendClient(stack!).from('entitlements').delete().eq('user_id', session.userId)
    await session.client.auth.signOut()
  })

  test('deux clients livrés dans l’ordre inverse conservent la version récente', async () => {
    const other = createClient(stack!.url, stack!.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const session = await signUpSession(stack!.url, stack!.anonKey)
    expect((await grantCloud(backendClient(stack!), session.userId)).error).toBeNull()
    expect((await other.auth.signInWithPassword(session)).error).toBeNull()

    const id = crypto.randomUUID()
    const recent = '2030-08-09T12:00:00Z'
    const stale = '2030-08-09T11:00:00Z'
    const write = (name: string, updatedAt: string) => ({
      project_id: id,
      project_user_id: session.userId,
      project_name: name,
      project_data: { name, revision: updatedAt },
      project_updated_at: updatedAt,
    })

    expect((await session.client.rpc('upsert_project_lww', write('Récent', recent))).data).toBe(
      true,
    )
    expect((await other.rpc('upsert_project_lww', write('Ancien', stale))).data).toBe(false)
    const { data, error } = await session.client
      .from('projects')
      .select('name, data, updated_at')
      .eq('id', id)
      .single()
    expect(error).toBeNull()
    expect(data).toMatchObject({ name: 'Récent', data: { revision: recent } })
    expect(Date.parse(data!.updated_at)).toBe(Date.parse(recent))

    await session.client.from('projects').delete().eq('id', id)
    await backendClient(stack!).from('entitlements').delete().eq('user_id', session.userId)
    await Promise.all([session.client.auth.signOut(), other.auth.signOut()])
  })

  test('un asset absent reste non confirmé et met la synchronisation en échec', async ({
    browser,
    baseURL,
  }) => {
    const page = await openApp(browser, baseURL!, seed)
    test.skip(!(await accountEntryPresent(page)), 'serveur démarré sans variables Supabase')
    await expect(syncBadge(page, 'Synchronisé')).toBeAttached({ timeout: 30_000 })

    const marker = `Projet asset absent ${Date.now()}`
    await page.evaluate((name) => {
      window.__sfStores?.useProjectStore.getState().createProject(name)
      const store = window.__sfStores?.useProjectStore.getState()
      const project = store?.project
      if (!project) return
      store.addScreenLayer(project.activeScreenId, {
        id: crypto.randomUUID(),
        type: 'image',
        name: 'Image absente',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        zIndex: 0,
        assetId: 'missing-asset',
        originalWidth: 100,
        originalHeight: 100,
      })
    }, marker)

    await expect(syncBadge(page, 'Échec de la synchronisation')).toBeAttached({ timeout: 15_000 })
    expect(await remoteRow(client, marker)).toBeNull()
    await page.context().close()
  })

  test('un projet distant corrompu ne bloque ni n’expose les projets sains', async ({
    browser,
    baseURL,
  }) => {
    const session = await signUpSession(stack!.url, stack!.anonKey)
    expect((await grantCloud(backendClient(stack!), session.userId)).error).toBeNull()

    /* On fabrique les deux documents avec le store réel pour rester aligné sur
       le contrat courant, puis on les dépose directement comme le ferait un
       autre navigateur. */
    const sourceContext = await browser.newContext({ baseURL: baseURL! })
    const source = await sourceContext.newPage()
    await waitForApp(source)
    test.skip(!(await accountEntryPresent(source)), 'serveur démarré sans variables Supabase')
    const marker = Date.now()
    const healthyName = `Cloud sain ${marker}`
    const brokenName = `Cloud incomplet ${marker}`
    const [healthy, broken] = await source.evaluate(
      ([goodName, badName]) => {
        const store = window.__sfStores?.useProjectStore.getState()
        store?.createProject(goodName)
        const good = structuredClone(window.__sfStores?.useProjectStore.getState().project ?? null)

        window.__sfStores?.useProjectStore.getState().createProject(badName)
        const badStore = window.__sfStores?.useProjectStore.getState()
        const badProject = badStore?.project
        if (badStore && badProject) {
          badStore.addScreenLayer(badProject.activeScreenId, {
            id: crypto.randomUUID(),
            type: 'image',
            name: 'Image distante absente',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            rotation: 0,
            opacity: 1,
            locked: false,
            visible: true,
            zIndex: 0,
            assetId: 'missing-remote-asset',
            originalWidth: 100,
            originalHeight: 100,
          })
        }
        const bad = structuredClone(window.__sfStores?.useProjectStore.getState().project ?? null)
        return [good, bad]
      },
      [healthyName, brokenName] as const,
    )
    await sourceContext.close()
    if (!healthy || !broken) throw new Error('Could not create remote project fixtures.')
    healthy.updatedAt = marker + 1_000
    broken.updatedAt = marker + 2_000

    const pushFixture = (project: typeof healthy) =>
      session.client.rpc('upsert_project_lww', {
        project_id: project.id,
        project_user_id: session.userId,
        project_name: project.name,
        project_data: project as never,
        project_updated_at: new Date(project.updatedAt).toISOString(),
      })
    expect((await pushFixture(healthy)).data).toBe(true)
    expect((await pushFixture(broken)).data).toBe(true)

    const page = await openApp(browser, baseURL!, session.seed)
    await expect(syncBadge(page, 'Échec de la synchronisation')).toBeAttached({ timeout: 30_000 })
    await page.getByLabel('Ouvrir le menu Projet').click()
    await expect(page.getByRole('menuitem', { name: `Ouvrir « ${healthyName} »` })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: `Ouvrir « ${brokenName} »` })).toHaveCount(0)
    await page.getByRole('menuitem', { name: `Ouvrir « ${healthyName} »` }).click()
    await expect(projectName(page)).toHaveValue(healthyName)

    await Promise.all([
      session.client.from('projects').delete().eq('id', healthy.id),
      session.client.from('projects').delete().eq('id', broken.id),
    ])
    await page.context().close()
    await backendClient(stack!).from('entitlements').delete().eq('user_id', session.userId)
    await session.client.auth.signOut()
  })

  test('une modification hors ligne finit dans le cloud au retour du réseau', async ({
    browser,
    baseURL,
  }) => {
    const page = await openApp(browser, baseURL!, seed)
    const cloudReady = await accountEntryPresent(page)
    test.skip(!cloudReady, 'serveur de développement démarré sans variables Supabase')
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

  test('un rechargement rejoue tous les projets modifiés hors ligne avec leurs assets', async ({
    browser,
    baseURL,
  }) => {
    const session = await signUpSession(stack!.url, stack!.anonKey)
    expect((await grantCloud(backendClient(stack!), session.userId)).error).toBeNull()
    const page = await openApp(browser, baseURL!, session.seed)
    test.skip(!(await accountEntryPresent(page)), 'serveur démarré sans variables Supabase')
    await expect(syncBadge(page, 'Synchronisé')).toBeAttached({ timeout: 30_000 })

    const marker = Date.now()
    const onlineNames = [`File A ${marker}`, `File B ${marker}`]
    for (const name of onlineNames) {
      await page.evaluate(
        (projectName) => window.__sfStores?.useProjectStore.getState().createProject(projectName),
        name,
      )
      await page.getByLabel('Ajouter Texte').click()
      await expect
        .poll(async () => Boolean(await remoteRow(session.client, name)), { timeout: 30_000 })
        .toBe(true)
    }

    await page.getByLabel('Ouvrir le menu Projet').click()
    await page.getByRole('menuitem', { name: `Ouvrir « ${onlineNames[0]} »` }).click()
    await expect(projectName(page)).toHaveValue(onlineNames[0])
    await page.context().setOffline(true)

    const offlineNames = [`${onlineNames[0]} hors ligne`, `${onlineNames[1]} hors ligne`]
    await projectName(page).fill(offlineNames[0])
    await projectName(page).press('Enter')
    await page.getByLabel('Importer une image').setInputFiles({
      name: 'a.png',
      mimeType: 'image/png',
      buffer: makeSolidPng(8, 8, [220, 38, 38, 255]),
    })
    await expect(page.locator('[role="status"][title="Enregistré"]')).toBeAttached({
      timeout: 15_000,
    })
    const assetA = await page.evaluate(() => {
      const project = window.__sfStores?.useProjectStore.getState().project
      const layer = project?.screens
        .flatMap((screen) => screen.layers)
        .find((candidate) => candidate.type === 'image')
      return layer?.type === 'image' ? layer.assetId : null
    })

    await page.getByLabel('Ouvrir le menu Projet').click()
    await page.getByRole('menuitem', { name: `Ouvrir « ${onlineNames[1]} »` }).click()
    await expect(projectName(page)).toHaveValue(onlineNames[1])
    await projectName(page).fill(offlineNames[1])
    await projectName(page).press('Enter')
    await page.getByLabel('Importer une image').setInputFiles({
      name: 'b.png',
      mimeType: 'image/png',
      buffer: makeSolidPng(8, 8, [37, 99, 235, 255]),
    })
    await expect(page.locator('[role="status"][title="Enregistré"]')).toBeAttached({
      timeout: 15_000,
    })
    const assetB = await page.evaluate(() => {
      const project = window.__sfStores?.useProjectStore.getState().project
      const layer = project?.screens
        .flatMap((screen) => screen.layers)
        .find((candidate) => candidate.type === 'image')
      return layer?.type === 'image' ? layer.assetId : null
    })
    expect(assetA).not.toBeNull()
    expect(assetB).not.toBeNull()

    await page.route('http://127.0.0.1:54421/**', (route) => route.abort())
    await page.context().setOffline(false)
    await waitForApp(page)
    await expect(projectName(page)).toHaveValue(offlineNames[1])
    await page.unroute('http://127.0.0.1:54421/**')
    await page.evaluate(() => window.dispatchEvent(new Event('online')))

    for (const name of offlineNames) {
      await expect
        .poll(async () => Boolean(await remoteRow(session.client, name)), { timeout: 30_000 })
        .toBe(true)
    }
    const [downloadA, downloadB] = await Promise.all([
      session.client.storage.from('assets').download(`${session.userId}/${assetA}`),
      session.client.storage.from('assets').download(`${session.userId}/${assetB}`),
    ])
    expect(downloadA.error).toBeNull()
    expect(downloadB.error).toBeNull()
    expect(downloadA.data?.size).toBeGreaterThan(0)
    expect(downloadB.data?.size).toBeGreaterThan(0)
    await expect(projectName(page)).toHaveValue(offlineNames[1])
    expect(
      await page.evaluate((id) => Boolean(id && window.__sfAssets?.resolveAsset(id)), assetB),
    ).toBe(true)

    for (const name of offlineNames) {
      const row = await remoteRow(session.client, name)
      if (row) await session.client.from('projects').delete().eq('id', row.id)
    }
    await session.client.storage
      .from('assets')
      .remove([`${session.userId}/${assetA}`, `${session.userId}/${assetB}`])
    await page.context().close()
    await backendClient(stack!).from('entitlements').delete().eq('user_id', session.userId)
    await session.client.auth.signOut()
  })
})

/**
 * La porte commerciale, vue du navigateur.
 *
 * Les policies refusent déjà l'écriture d'un compte sans abonnement — c'est le
 * verrou, et `supabase/tests/rls_cloud_gate.test.mjs` le tient. Ce qui se
 * mesure ici est l'autre moitié : un compte Licence ne doit rien *tenter*. Lui
 * laisser découvrir la porte par un refus produirait une pastille rouge et un
 * toast d'échec pour une fonction qu'il n'a simplement pas achetée.
 */
test.describe('Porte Cloud côté client', () => {
  test.skip(!stack, 'stack Supabase local arrêté')
  test.setTimeout(120_000)

  const backend = () => backendClient(stack!)

  test('un compte Licence ne tente aucune synchronisation', async ({ browser, baseURL }) => {
    const session = await signUpSession(stack!.url, stack!.anonKey)
    const { error } = await grantLicence(backend(), session.userId)
    expect(error, `octroi de la Licence : ${error?.message}`).toBeNull()

    const page = await openApp(browser, baseURL!, session.seed)
    const cloudReady = await accountEntryPresent(page)
    test.skip(!cloudReady, 'serveur de développement démarré sans variables Supabase')

    /* Toutes les requêtes vers les tables et le bucket, pas seulement celles du
       chemin de sync : ce qui est promis est qu'aucune n'est tentée. La lecture
       des droits (`entitlements`) en est une, et elle est légitime. */
    const attempts: string[] = []
    page.on('request', (request) => {
      const url = request.url()
      if (url.includes('/rest/v1/projects') || url.includes('/storage/v1/')) attempts.push(url)
    })

    await projectName(page).fill(`Projet licence ${Date.now()}`)
    await projectName(page).press('Enter')
    await page.getByLabel('Ajouter Texte').click()
    /* Plus long que la temporisation de l'autosave (2 s) : c'est elle qui
       déclencherait un cycle s'il y en avait un à déclencher. */
    await page.waitForTimeout(5_000)

    expect(attempts, `requêtes tentées : ${attempts.join(', ')}`).toEqual([])
    /* `SyncIndicator` ne rend rien sur `off` : aucun des quatre libellés n'est
       dans la page, donc pas même « Échec de la synchronisation ». */
    await expect(page.locator('[role="status"][title*="ynchronis"]')).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)

    await page.context().close()
    await backend().from('entitlements').delete().eq('user_id', session.userId)
  })

  test('une Licence déjà lue reste disponible si sa relecture réseau échoue', async ({
    browser,
    baseURL,
  }) => {
    const session = await signUpSession(stack!.url, stack!.anonKey)
    expect((await grantLicence(backend(), session.userId)).error).toBeNull()
    const page = await openApp(browser, baseURL!, session.seed)
    test.skip(!(await accountEntryPresent(page)), 'serveur démarré sans variables Supabase')

    await expect
      .poll(() =>
        page.evaluate(() => window.__sfStores?.useAuthStore.getState().entitlements?.licence),
      )
      .toBe(true)
    await page.route('**/rest/v1/entitlements*', (route) => route.abort())
    await waitForApp(page)

    await expect
      .poll(() =>
        page.evaluate(() => window.__sfStores?.useAuthStore.getState().entitlements?.licence),
      )
      .toBe(true)

    await page.context().close()
    await backend().from('entitlements').delete().eq('user_id', session.userId)
  })

  test('la déconnexion rend l’éditeur au mode local, sans erreur', async ({ browser, baseURL }) => {
    const session = await signUpSession(stack!.url, stack!.anonKey)
    expect((await grantCloud(backend(), session.userId)).error).toBeNull()

    const page = await openApp(browser, baseURL!, session.seed)
    const cloudReady = await accountEntryPresent(page)
    test.skip(!cloudReady, 'serveur de développement démarré sans variables Supabase')
    await expect(syncBadge(page, 'Synchronisé')).toBeAttached({ timeout: 30_000 })

    const marker = `Projet déconnecté ${Date.now()}`
    await projectName(page).fill(marker)
    await projectName(page).press('Enter')
    await expect
      .poll(async () => Boolean(await remoteRow(session.client, marker)), { timeout: 15_000 })
      .toBe(true)

    await page.getByRole('button', { name: 'Mon compte' }).first().click()
    await page.getByRole('button', { name: 'Se déconnecter' }).click()
    await expect(page.getByRole('button', { name: 'Se connecter' }).first()).toBeVisible()

    /* Enregistrées après la déconnexion seulement : ce qui est promis porte sur
       la suite, pas sur le cycle qui vient de se terminer. */
    const attempts: string[] = []
    page.on('request', (request) => {
      const url = request.url()
      if (url.includes('/rest/v1/') || url.includes('/storage/v1/')) attempts.push(url)
    })

    /* Critère 12 : le projet reste éditable et rien ne part. Plus long que
       l'autosave (2 s), qui déclencherait le cycle s'il restait branché. */
    await expect(projectName(page)).toHaveValue(marker)
    await projectName(page).fill(`${marker} local`)
    await projectName(page).press('Enter')
    await page.getByLabel('Ajouter Texte').click()
    await page.waitForTimeout(5_000)

    expect(attempts, `requêtes tentées : ${attempts.join(', ')}`).toEqual([])
    await expect(page.locator('[role="status"][title*="ynchronis"]')).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(projectName(page)).toHaveValue(`${marker} local`)

    const row = await remoteRow(session.client, marker)
    if (row) await session.client.from('projects').delete().eq('id', row.id)
    await page.context().close()
    await backend().from('entitlements').delete().eq('user_id', session.userId)
  })

  test('la fin de période arrête la sync sans rien supprimer localement', async ({
    browser,
    baseURL,
  }) => {
    const session = await signUpSession(stack!.url, stack!.anonKey)
    expect((await grantCloud(backend(), session.userId)).error).toBeNull()

    const abonné = await openApp(browser, baseURL!, session.seed)
    const cloudReady = await accountEntryPresent(abonné)
    test.skip(!cloudReady, 'serveur de développement démarré sans variables Supabase')
    await expect(syncBadge(abonné, 'Synchronisé')).toBeAttached({ timeout: 30_000 })

    const marker = `Projet expiré ${Date.now()}`
    await projectName(abonné).fill(marker)
    await projectName(abonné).press('Enter')
    await expect
      .poll(async () => Boolean(await remoteRow(session.client, marker)), { timeout: 15_000 })
      .toBe(true)

    /* La période se termine telle que Polar la laisse : le statut reste
       renseigné, c'est la date qui a passé. */
    expect(
      (
        await backend()
          .from('entitlements')
          .update({ cloud_period_end: '2020-01-01T00:00:00Z' })
          .eq('user_id', session.userId)
      ).error,
    ).toBeNull()

    /* Le même contexte, rechargé : c'est la copie *locale* qui doit survivre à
       la fin de l'abonnement, et un nouveau profil de navigateur n'en a pas —
       il ne mesurerait que le tirage, justement désactivé. */
    await waitForApp(abonné)

    /* Critère 9 : la sync s'arrête, et le projet reste là, éditable. Le témoin
       disparaît au lieu de passer au rouge. */
    await expect(abonné.locator('[role="status"][title*="ynchronis"]')).toHaveCount(0)
    await expect(projectName(abonné)).toHaveValue(marker)
    await projectName(abonné).fill(`${marker} modifié`)
    await projectName(abonné).press('Enter')
    await expect(projectName(abonné)).toHaveValue(`${marker} modifié`)
    await expect(abonné.getByRole('alert')).toHaveCount(0)

    const row = await remoteRow(session.client, marker)
    if (row) await session.client.from('projects').delete().eq('id', row.id)
    await abonné.context().close()
    await backend().from('entitlements').delete().eq('user_id', session.userId)
  })
})

/**
 * Le premier login ne fait perdre aucun projet local.
 *
 * Le cycle ordinaire ne pousse que le projet ouvert. Quelqu'un qui a construit
 * plusieurs projets avant d'acheter le Cloud n'en verrait donc remonter qu'un,
 * et la perte serait silencieuse : rien à l'écran ne distingue « pas encore
 * synchronisé » de « jamais synchronisé ».
 */
test.describe('Rattachement des projets locaux', () => {
  test.skip(!stack, 'stack Supabase local arrêté')
  test.setTimeout(120_000)

  const migrateDialog = (page: Page) => page.getByRole('dialog', { name: 'Rattacher vos projets' })

  /** Un projet nommé, modifié, et écrit sur le disque local. */
  async function makeLocalProject(page: Page, name: string) {
    await page.evaluate(
      (projectName) => window.__sfStores?.useProjectStore.getState().createProject(projectName),
      name,
    )
    /* Créé et jamais touché, un projet ne compte pas comme orphelin — c'est la
       signature du « Projet sans titre » que l'éditeur ouvre au démarrage. Le
       calque en fait un projet de quelqu'un. */
    await page.getByLabel('Ajouter Texte').click()
    await expect(page.locator('[role="status"][title="Enregistré"]')).toBeAttached({
      timeout: 15_000,
    })
  }

  test('propose les projets orphelins, les rattache, et revient si on refuse', async ({
    browser,
    baseURL,
  }) => {
    const session = await signUpSession(stack!.url, stack!.anonKey)
    expect((await grantCloud(backendClient(stack!), session.userId)).error).toBeNull()

    /* Sans session d'abord : c'est l'ordre réel — on travaille en local, puis on
       achète. Ouvrir déjà connecté ne produirait aucun orphelin. */
    const context = await browser.newContext({ baseURL: baseURL! })
    const page = await context.newPage()
    await waitForApp(page)
    test.skip(!(await accountEntryPresent(page)), 'serveur démarré sans variables Supabase')

    const marque = Date.now()
    const noms = [`Local A ${marque}`, `Local B ${marque}`]
    for (const nom of noms) await makeLocalProject(page, nom)
    await page.getByLabel('Importer une image').setInputFiles({
      name: 'active.png',
      mimeType: 'image/png',
      buffer: makeSolidPng(8, 8, [59, 130, 246, 255]),
    })
    await expect(page.locator('[role="status"][title="Enregistré"]')).toBeAttached({
      timeout: 15_000,
    })
    const activeAssetId = await page.evaluate(() => {
      const project = window.__sfStores?.useProjectStore.getState().project
      const layer = project?.screens
        .flatMap((screen) => screen.layers)
        .find((candidate) => candidate.type === 'image')
      return layer?.type === 'image' ? layer.assetId : null
    })

    await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [
      STORAGE_KEY,
      session.seed,
    ] as const)
    await waitForApp(page)

    /* Critère 10 : « Plus tard » n'efface rien et n'enregistre rien — la boîte
       revient au login suivant. */
    await expect(migrateDialog(page)).toBeVisible({ timeout: 30_000 })
    /* Seul le premier y figure, et c'est le résultat attendu : le second est le
       projet ouvert, que le cycle ordinaire envoie de lui-même dès la session
       établie. La boîte ne propose que ce qu'elle seule peut faire remonter. */
    await expect(migrateDialog(page).getByText(noms[0])).toBeVisible()
    await expect(migrateDialog(page).getByText(noms[1])).toHaveCount(0)
    await page.getByRole('button', { name: 'Plus tard' }).click()
    await expect(migrateDialog(page)).toHaveCount(0)

    await waitForApp(page)
    await expect(migrateDialog(page)).toBeVisible({ timeout: 30_000 })

    /* Critère 8 : après « Tout rattacher », les deux projets existent côté
       serveur — donc sur n'importe quelle autre machine du même compte. */
    await page.getByRole('button', { name: 'Tout rattacher' }).click()
    await expect(migrateDialog(page)).toHaveCount(0)
    for (const nom of noms) {
      await expect
        .poll(async () => Boolean(await remoteRow(session.client, nom)), {
          timeout: 30_000,
        })
        .toBe(true)
    }
    expect(activeAssetId).not.toBeNull()
    expect(
      await page.evaluate(
        (id) => Boolean(id && window.__sfAssets?.resolveAsset(id)),
        activeAssetId,
      ),
    ).toBe(true)

    const fresh = await openApp(browser, baseURL!, session.seed)
    await expect(syncBadge(fresh, 'Synchronisé')).toBeAttached({ timeout: 30_000 })
    await fresh.getByLabel('Ouvrir le menu Projet').click()
    await fresh.getByRole('menuitem', { name: `Ouvrir « ${noms[0]} »` }).click()
    await expect(projectName(fresh)).toHaveValue(noms[0])
    await fresh.getByLabel('Ouvrir le menu Projet').click()
    await fresh.getByRole('menuitem', { name: `Ouvrir « ${noms[1]} »` }).click()
    await expect(projectName(fresh)).toHaveValue(noms[1])

    for (const nom of noms) {
      const row = await remoteRow(session.client, nom)
      if (row) await session.client.from('projects').delete().eq('id', row.id)
    }
    await fresh.context().close()
    await context.close()
    await backendClient(stack!).from('entitlements').delete().eq('user_id', session.userId)
  })
})
