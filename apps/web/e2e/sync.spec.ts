/**
 * La preuve de ce que le plan Cloud vend : un projet repris ailleurs.
 *
 * Tout le reste de la suite e2e vérifie qu'un navigateur retrouve son propre
 * travail. Ici, deux contextes distincts — deux profils, deux IndexedDB, aucune
 * mémoire commune — partagent un compte, et le second doit voir ce que le
 * premier a fait, images comprises.
 *
 * La session est semée dans `localStorage` plutôt que gagnée par l'interface :
 * l'application ne propose que le lien magique et deux SSO, qui passent par un
 * tiers ou une boîte aux lettres. Le provider `test-password`, invisible dans
 * l'interface, crée la fixture et `SESSION_NAMESPACE` fixe l'emplacement des
 * jetons pour qu'il soit adressable d'ici.
 *
 * L'abonnement Cloud est semé avec la session : la sync est le service payant —
 * `requireCloud` refuse l'écriture et l'éditeur ne tente rien sans le droit. Un
 * compte fraîchement inscrit est un compte gratuit, donc ce fichier mesurerait
 * la porte commerciale au lieu de la sync. L'octroi passe par
 * `apps/backend/tests/stack.ts`, hors de `apps/web` : la clé d'administration
 * du déploiement local n'a rien à faire dans le paquet du navigateur.
 *
 * Se saute proprement quand le déploiement local est arrêté ou quand le serveur
 * de développement tourne sans `VITE_CONVEX_URL` : `pnpm run test:e2e` doit
 * rester exécutable sans backend, comme il l'était sans Docker.
 */
import { expect, test, type Browser, type Page } from '@playwright/test'
import { MAX_IMAGE_FILE_BYTES } from 'backend/media'
import {
  adminClient,
  deleteRemoteAccount,
  dropRemoteProjects,
  expireCloud,
  grantCloud,
  growRefreshChain,
  inspectDeletedSession,
  listRemote,
  localConvex,
  readRemote,
  remoteProject,
  seedRemoteAsset,
  seedRemoteProject,
  sessionIdOf,
  setComplimentaryAccess,
  signUpSession,
  tryRemoteAssetUpload,
  type Session,
} from '../../backend/tests/stack'
import { JWT_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY } from '../src/lib/session-keys'
import { makeSolidPng } from './device-bezel-fixture'
import { waitForApp } from './helpers'

const REQUIRE_CLOUD = process.env.SCREENFORGE_REQUIRE_CLOUD === '1'
const stack = localConvex()

if (REQUIRE_CLOUD && !stack) {
  throw new Error('SCREENFORGE_REQUIRE_CLOUD=1 mais le déploiement Convex local est absent.')
}

/** Le client privilégié, celui du webhook — jamais celui d'une assertion. */
const admin = () => adminClient(stack!)

/** PNG structurellement valide à la taille exacte, sans décodage côté test. */
function sizedPng(totalBytes: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(totalBytes)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10])
  const view = new DataView(bytes.buffer)
  let offset = 8
  const chunk = (type: string, data: Uint8Array) => {
    view.setUint32(offset, data.length)
    bytes.set(
      [...type].map((character) => character.charCodeAt(0)),
      offset + 4,
    )
    bytes.set(data, offset + 8)
    offset += 12 + data.length
  }
  const header = new Uint8Array(13)
  new DataView(header.buffer).setUint32(0, 1)
  new DataView(header.buffer).setUint32(4, 1)
  header.set([8, 6, 0, 0, 0], 8)
  chunk('IHDR', header)
  chunk('IDAT', new Uint8Array(totalBytes - 57))
  chunk('IEND', new Uint8Array())
  return bytes
}

/**
 * Les deux clés que `@convex-dev/auth` lit au démarrage.
 *
 * Semées ensemble : le jeton court porte la session, le jeton de renouvellement
 * est ce qui la fait survivre à un rechargement. Sans le second, une page
 * rouverte quelques minutes plus tard démarre déconnectée.
 */
async function openApp(browser: Browser, baseURL: string, session: Session): Promise<Page> {
  const context = await browser.newContext({ baseURL })
  await context.addInitScript(
    ([jwtKey, jwt, refreshKey, refresh]) => {
      window.localStorage.setItem(jwtKey, jwt)
      window.localStorage.setItem(refreshKey, refresh)
    },
    [JWT_STORAGE_KEY, session.token, REFRESH_TOKEN_STORAGE_KEY, session.refreshToken] as const,
  )
  const page = await context.newPage()
  await waitForApp(page)
  return page
}

/**
 * Sème la session dans une page, pour sa prochaine navigation.
 *
 * Un script d'initialisation plutôt qu'un `evaluate` : les appelants arment
 * d'abord une interception de route, donc certains sèment sur une page qui n'a
 * encore rien chargé — et `localStorage` n'existe pas avant qu'un document ait
 * une origine. Écrit ici, le jeton est en place avant le premier script de
 * l'application, ce qu'un `evaluate` après chargement ne garantit pas.
 */
async function seedSession(page: Page, session: Session): Promise<void> {
  await page.addInitScript(
    ([jwtKey, jwt, refreshKey, refresh]) => {
      window.localStorage.setItem(jwtKey, jwt)
      window.localStorage.setItem(refreshKey, refresh)
    },
    [JWT_STORAGE_KEY, session.token, REFRESH_TOKEN_STORAGE_KEY, session.refreshToken] as const,
  )
}

/**
 * L'entrée de compte, dans l'un ou l'autre de ses deux états.
 *
 * Sa présence est ce qui distingue « le serveur de développement tourne sans
 * `VITE_CONVEX_URL` » d'un vrai échec : sans instance configurée, `TopBar` ne
 * rend aucune entrée de compte, et tout ce fichier n'aurait rien à mesurer.
 */
const accountButton = /Se connecter|Mon compte/

/**
 * La phrase que la boîte Compte ne dit qu'à qui n'a rien ailleurs.
 *
 * Deux tests l'attendent, chacun dans un sens : présente sans Cloud quand le
 * navigateur a refusé de s'engager, absente dès qu'une copie existe ailleurs.
 * Une seule constante, parce qu'un fragment recopié aurait cessé de désigner la
 * même phrase à la première reformulation, et le test « absente » serait passé
 * en ne trouvant plus rien.
 */
const DURABILITY_WARNING = 'n’a pas garanti de les conserver'

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

async function requireAccountEntry(page: Page): Promise<void> {
  const present = await accountEntryPresent(page)
  if (REQUIRE_CLOUD) {
    expect(present, 'le mode release exige le serveur Vite cloud').toBe(true)
    return
  }
  test.skip(!present, 'serveur de développement démarré sans VITE_CONVEX_URL')
}

/**
 * Le témoin de la barre du haut, lisible quelle que soit la largeur.
 *
 * Sur son texte et non sur un `title` : le témoin n'en porte plus depuis que
 * les infobulles passent par la primitive Tooltip, et un état n'est pas une
 * commande — il se lit, il ne se survole pas. Le libellé se replie en
 * `sr-only` quand la barre se resserre, jamais en `display:none`, donc il
 * reste dans le DOM à toute largeur. Ancré, sinon « Enregistré » attraperait
 * aussi « Enregistrement… ».
 */
function syncBadge(page: Page, label: string) {
  return page.locator('[role="status"]').filter({ hasText: new RegExp(`^${label}$`) })
}

function projectName(page: Page) {
  return page.getByLabel('Nom du projet')
}

/** La ligne distante et son contenu, sous le nom que porte le projet. */
function remoteRow(session: Session, name: string) {
  return remoteProject(stack!, session, name)
}

/**
 * Les requêtes de sync tentées par la page.
 *
 * Les lectures de binaires passent par les routes HTTP du déploiement, donc par
 * de vraies requêtes observables. Les mutations et les queries passent par la
 * WebSocket, que `page.on('request')` ne détaille pas : c'est pourquoi les
 * tests qui promettent « rien ne part » vérifient **aussi** que le catalogue
 * distant est resté vide. Une écriture qui aurait échappé à ce filet y
 * apparaîtrait.
 */
function watchCloudRequests(page: Page): string[] {
  const attempts: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (url.startsWith(stack!.site)) attempts.push(url)
  })
  return attempts
}

/**
 * Coupe le déploiement sans couper le serveur qui sert l'application.
 *
 * `setOffline(true)` coupe tout, `localhost` compris : une page qui recharge
 * pendant la coupure n'a plus d'application à charger. Or les tests qui
 * rechargent hors ligne ne promettent rien sur le serveur de développement — ils
 * promettent que rien n'atteint le déploiement pendant le démarrage. Couper les
 * deux transports du déploiement, et eux seuls, dit exactement cela : les routes
 * HTTP de `convex.site`, et la WebSocket que portent les queries et les
 * mutations, que `page.route` ne voit pas.
 *
 * Les deux interceptions ne prennent que ce qui s'ouvre après elles : les armer
 * ne referme pas la connexion en cours, il faut donc les poser avant la
 * navigation qui doit démarrer coupée. La fonction rendue rétablit le lien pour
 * la tentative de reconnexion suivante.
 */
async function cutDeployment(page: Page): Promise<() => void> {
  let cut = true
  const socket = stack!.url.replace(/^http/, 'ws')
  await page.route(`${stack!.site}/**`, (route) => (cut ? route.abort() : route.continue()))
  await page.routeWebSocket(
    (url) => url.href.startsWith(socket),
    (ws) => {
      if (cut) void ws.close()
      else ws.connectToServer()
    },
  )
  return () => {
    cut = false
  }
}

test.describe('Sync cloud', () => {
  test.skip(!stack, 'déploiement Convex local arrêté')
  /* Deux contextes, un import d'image et deux allers-retours réseau : le
     plafond de 45 s de la configuration est trop court pour ce fichier seul. */
  test.setTimeout(120_000)

  let session: Session

  test.beforeAll(async () => {
    session = await signUpSession(stack!)
    expect(await grantCloud(admin(), session.userId)).toBe('written')
  })

  test.afterAll(async () => {
    await dropRemoteProjects(session)
  })

  test('la connexion visible reste vérifiable et rend le focus à son appelant', async ({
    page,
  }) => {
    await waitForApp(page)
    const opener = page.getByRole('button', { name: 'Se connecter' })
    await opener.click()

    const dialog = page.getByRole('dialog', { name: 'Connexion à ScreenForge' })
    await expect(dialog.getByRole('button', { name: 'Continuer avec Google' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Continuer avec GitHub' })).toBeVisible()
    await expect(dialog.getByLabel('Adresse e-mail')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Recevoir un lien magique' })).toBeVisible()
    await expect(dialog.getByText(/mot de passe/i)).toHaveCount(0)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(opener).toBeFocused()
  })

  test('le transport réel accepte 16 MiB et refuse l’octet suivant sans ligne distante', async () => {
    const own = await signUpSession(stack!)
    expect(await grantCloud(admin(), own.userId)).toBe('written')
    const acceptedId = `asset-16-${String(Date.now())}`
    const rejectedId = `asset-17-${String(Date.now())}`

    try {
      const accepted = await tryRemoteAssetUpload(
        own,
        acceptedId,
        new Blob([sizedPng(MAX_IMAGE_FILE_BYTES)], { type: 'image/png' }),
      )
      expect(accepted).toEqual({ status: 200, outcome: 'accepted' })

      const download = await fetch(`${stack!.site}/asset/${acceptedId}`, {
        headers: { Authorization: `Bearer ${own.token}` },
      })
      expect(download.status).toBe(200)
      expect((await download.arrayBuffer()).byteLength).toBe(MAX_IMAGE_FILE_BYTES)

      const rejected = await tryRemoteAssetUpload(
        own,
        rejectedId,
        new Blob([sizedPng(MAX_IMAGE_FILE_BYTES + 1)], { type: 'image/png' }),
      ).catch((error: unknown) => {
        expect(error).toBeInstanceOf(Error)
        return null
      })
      if (rejected) expect(rejected).toEqual({ status: 413, outcome: 'file-too-large' })
      expect(await readRemote(stack!, own, `/asset/${rejectedId}`)).toBeNull()
    } finally {
      await deleteRemoteAccount(own)
    }
  })

  test('le cron réel reprend une session de plus de 400 refresh tokens jusqu’à zéro', async () => {
    const own = await signUpSession(stack!)
    const sessionId = sessionIdOf(own.token)
    await growRefreshChain(own, 401)

    expect(await deleteRemoteAccount(own)).toBe('deletion-pending')
    await expect
      .poll(() => inspectDeletedSession(admin(), sessionId), { timeout: 30_000 })
      .toEqual({ session: false, refreshToken: false, verifier: false })
  })

  test('un projet riche et le thème arrivent dans un autre navigateur, assets compris', async ({
    browser,
    baseURL,
  }) => {
    const a = await openApp(browser, baseURL!, session)
    await requireAccountEntry(a)

    await expect(syncBadge(a, 'Synchronisé')).toBeAttached({ timeout: 30_000 })

    const marker = `Projet sync ${String(Date.now())}`
    await projectName(a).fill(marker)
    await projectName(a).press('Enter')
    await a.getByLabel('Importer une image').setInputFiles({
      name: 'hero.png',
      mimeType: 'image/png',
      buffer: makeSolidPng(16, 16, [34, 197, 94, 255]),
    })
    await a.evaluate(() => {
      const store = window.__sfStores?.useProjectStore
      const project = store?.getState().project
      const image = project?.screens
        .flatMap((screen) => screen.layers)
        .find((layer) => layer.type === 'image')
      if (!store || !project || image?.type !== 'image') return

      const layoutLayer = {
        id: crypto.randomUUID(),
        type: 'shape' as const,
        name: 'Accent partagé',
        x: 24,
        y: 32,
        width: 180,
        height: 64,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        zIndex: 0,
        scope: 'layout' as const,
        shapeType: 'rectangle' as const,
        fill: '#22c55e',
      }
      const device = {
        id: crypto.randomUUID(),
        type: 'device-frame' as const,
        name: 'Capture appareil',
        x: 320,
        y: 220,
        width: 360,
        height: 780,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        zIndex: project.screens[0]!.layers.length,
        deviceModel: project.globals.deviceModel,
        deviceColor: project.globals.deviceColor,
        orientation: 'portrait' as const,
        screenshotAssetId: image.assetId,
        screenshotSize: { width: 16, height: 16 },
      }
      const screens = structuredClone(project.screens)
      screens[0]!.layers.push(device)
      const globals = { ...structuredClone(project.globals), fontSize: 64 }
      const snapshot = {
        name: project.name,
        screens: structuredClone(screens),
        layoutLayers: [structuredClone(layoutLayer)],
        globals: structuredClone(globals),
      }
      store.setState({
        project: {
          ...project,
          screens,
          globals,
          layoutLayers: [layoutLayer],
          locales: [{ code: 'fr', name: 'Français', script: 'latin', texts: {} }],
          releases: [
            {
              id: crypto.randomUUID(),
              name: 'Release de preuve',
              createdAt: Date.now(),
              watermarked: false,
              files: [],
              snapshot,
            },
          ],
          updatedAt: Date.now() + 1,
        },
      })
      window.__sfStores?.useUIStore.getState().toggleTheme()
    })
    await a.waitForTimeout(100)
    await expect
      .poll(() => a.evaluate(() => window.__sfStores?.useUIStore.getState().syncStatus))
      .toBe('synced')

    /* La ligne distante porte le nouvel état en moins de 5 s après que
       l'autosave local (2 s de temporisation) l'a commité. */
    await expect
      .poll(async () => Boolean(await remoteRow(session, marker)), { timeout: 10_000 })
      .toBe(true)
    const row = await remoteRow(session, marker)

    /* Les binaires vivent dans le stockage de fichiers, jamais dans le
       document. Une régression ici ne casse rien de visible — elle multiplie
       par cent le poids de chaque lecture. */
    expect(JSON.stringify(row!.data)).not.toContain('data:image')
    const payload = row!.data as {
      globals: { fontSize: number }
      layoutLayers: { type: string }[]
      locales: { code: string }[]
      releases: { name: string }[]
      screens: { layers: { type: string; screenshotAssetId?: string }[] }[]
    }
    expect(payload.globals.fontSize).toBe(64)
    expect(payload.layoutLayers.map((layer) => layer.type)).toEqual(['shape'])
    expect(payload.locales.map((locale) => locale.code)).toEqual(['fr'])
    expect(payload.releases.map((release) => release.name)).toEqual(['Release de preuve'])
    expect(
      payload.screens
        .flatMap((screen) => screen.layers)
        .find((layer) => layer.type === 'device-frame')?.screenshotAssetId,
    ).toBeTruthy()

    const b = await openApp(browser, baseURL!, session)
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
    await expect
      .poll(() =>
        b.evaluate(() => {
          const project = window.__sfStores?.useProjectStore.getState().project
          const layer = project?.screens
            .flatMap((screen) => screen.layers)
            .find((candidate) => candidate.type === 'device-frame')
          return layer?.type === 'device-frame' && layer.screenshotAssetId
            ? Boolean(window.__sfAssets?.resolveAsset(layer.screenshotAssetId))
            : false
        }),
      )
      .toBe(true)
    await expect
      .poll(() => b.evaluate(() => window.__sfStores?.useUIStore.getState().theme))
      .toBe('light')
    await expect
      .poll(() =>
        b.evaluate(() => {
          const project = window.__sfStores?.useProjectStore.getState().project
          return {
            fontSize: project?.globals.fontSize,
            locale: project?.locales?.[0]?.code,
            release: project?.releases?.[0]?.name,
            layout: project?.layoutLayers[0]?.type,
          }
        }),
      )
      .toEqual({ fontSize: 64, locale: 'fr', release: 'Release de preuve', layout: 'shape' })

    await a.context().close()
    await b.context().close()
  })

  test('une édition locale pendant un téléchargement cloud n’est jamais remplacée', async ({
    browser,
    baseURL,
  }) => {
    const own = await signUpSession(stack!)
    expect(await grantCloud(admin(), own.userId)).toBe('written')

    const sourceContext = await browser.newContext({ baseURL })
    const source = await sourceContext.newPage()
    await waitForApp(source)
    await requireAccountEntry(source)
    const remoteName = `Cloud retenu ${String(Date.now())}`
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
      return { project: remote, assetId }
    }, remoteName)
    await sourceContext.close()
    if (!fixture?.project) throw new Error('Could not create the retained remote fixture.')

    await seedRemoteAsset(
      own,
      fixture.assetId,
      new Blob([new Uint8Array(makeSolidPng(8, 8, [59, 130, 246, 255]))], { type: 'image/png' }),
    )
    expect(
      await seedRemoteProject(own, {
        projectId: fixture.project.id,
        name: fixture.project.name,
        updatedAt: fixture.project.updatedAt,
        payload: fixture.project,
      }),
    ).toBe('accepted')

    const context = await browser.newContext({ baseURL })
    const page = await context.newPage()
    let releaseDownload!: () => void
    const heldDownload = new Promise<void>((resolve) => {
      releaseDownload = resolve
    })
    let markDownloadStarted!: () => void
    const downloadStarted = new Promise<void>((resolve) => {
      markDownloadStarted = resolve
    })
    await page.route(`${stack!.site}/asset/*`, async (route) => {
      if (route.request().url().includes(fixture.assetId)) {
        markDownloadStarted()
        await heldDownload
      }
      await route.continue()
    })
    await seedSession(page, own)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(projectName(page)).toBeVisible()
    await downloadStarted

    const localName = `Édition locale ${String(Date.now())}`
    await projectName(page).fill(localName)
    await projectName(page).press('Enter')
    await expect(syncBadge(page, 'Enregistré')).toBeAttached({
      timeout: 15_000,
    })
    releaseDownload()

    await expect(projectName(page)).toHaveValue(localName, { timeout: 30_000 })
    await expect
      .poll(async () => Boolean(await remoteRow(own, localName)), { timeout: 30_000 })
      .toBe(true)

    await context.close()
    await dropRemoteProjects(own)
  })

  test('un projet ouvert pendant le téléchargement reste actif quand la cible cloud arrive', async ({
    browser,
    baseURL,
  }) => {
    const own = await signUpSession(stack!)
    expect(await grantCloud(admin(), own.userId)).toBe('written')
    const context = await browser.newContext({ baseURL })
    const page = await context.newPage()
    await waitForApp(page)
    await requireAccountEntry(page)

    const marker = Date.now()
    const localTargetName = `Cible locale ${String(marker)}`
    const keptName = `Projet conservé ${String(marker)}`
    const remoteTargetName = `Cible cloud ${String(marker)}`
    await page.evaluate(
      (name) => window.__sfStores?.useProjectStore.getState().createProject(name),
      localTargetName,
    )
    await page.getByLabel('Ajouter Texte').click()
    await expect(syncBadge(page, 'Enregistré')).toBeAttached({
      timeout: 15_000,
    })
    await page.evaluate(
      (name) => window.__sfStores?.useProjectStore.getState().createProject(name),
      keptName,
    )
    await page.getByLabel('Ajouter Texte').click()
    await page.getByLabel('Importer une image').setInputFiles({
      name: 'kept.png',
      mimeType: 'image/png',
      buffer: makeSolidPng(8, 8, [16, 185, 129, 255]),
    })
    await expect(syncBadge(page, 'Enregistré')).toBeAttached({
      timeout: 15_000,
    })
    const keptAssetId = await page.evaluate(() => {
      const project = window.__sfStores?.useProjectStore.getState().project
      const layer = project?.screens
        .flatMap((screen) => screen.layers)
        .find((candidate) => candidate.type === 'image')
      return layer?.type === 'image' ? layer.assetId : null
    })
    expect(keptAssetId).not.toBeNull()

    /* Make the target the last durable local project so the reload selects it,
       while the second project remains available in the catalogue. */
    await page.getByLabel('Ouvrir le sélecteur de projets').click()
    await page.getByRole('button', { name: `Ouvrir « ${localTargetName} »` }).click()
    await page.getByLabel('Ajouter Texte').click()
    await expect(syncBadge(page, 'Enregistré')).toBeAttached({
      timeout: 15_000,
    })
    const localTarget = await page.evaluate(() =>
      structuredClone(window.__sfStores?.useProjectStore.getState().project ?? null),
    )
    if (!localTarget) throw new Error('Could not create the active target fixture.')

    const remoteTarget = structuredClone(localTarget)
    remoteTarget.name = remoteTargetName
    remoteTarget.updatedAt = localTarget.updatedAt + 60_000
    const remoteAssetId = crypto.randomUUID()
    remoteTarget.screens[0]!.layers.push({
      id: crypto.randomUUID(),
      type: 'image',
      name: 'Cible distante retenue',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: remoteTarget.screens[0]!.layers.length,
      assetId: remoteAssetId,
      originalWidth: 8,
      originalHeight: 8,
    })
    await seedRemoteAsset(
      own,
      remoteAssetId,
      new Blob([new Uint8Array(makeSolidPng(8, 8, [37, 99, 235, 255]))], { type: 'image/png' }),
    )
    expect(
      await seedRemoteProject(own, {
        projectId: remoteTarget.id,
        name: remoteTarget.name,
        updatedAt: remoteTarget.updatedAt,
        payload: remoteTarget,
      }),
    ).toBe('accepted')

    let releaseDownload!: () => void
    const heldDownload = new Promise<void>((resolve) => {
      releaseDownload = resolve
    })
    let markDownloadStarted!: () => void
    const downloadStarted = new Promise<void>((resolve) => {
      markDownloadStarted = resolve
    })
    await page.route(`${stack!.site}/asset/*`, async (route) => {
      if (route.request().url().includes(remoteAssetId)) {
        markDownloadStarted()
        await heldDownload
      }
      await route.continue()
    })
    await seedSession(page, own)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(projectName(page)).toHaveValue(localTargetName)
    await downloadStarted

    await page.getByLabel('Ouvrir le sélecteur de projets').click()
    await page.getByRole('button', { name: `Ouvrir « ${keptName} »` }).click()
    await expect(projectName(page)).toHaveValue(keptName)
    expect(
      await page.evaluate((id) => Boolean(id && window.__sfAssets?.resolveAsset(id)), keptAssetId),
    ).toBe(true)
    releaseDownload()

    await expect(syncBadge(page, 'Synchronisé')).toBeAttached({ timeout: 30_000 })
    await expect(projectName(page)).toHaveValue(keptName)
    expect(
      await page.evaluate((id) => Boolean(id && window.__sfAssets?.resolveAsset(id)), keptAssetId),
    ).toBe(true)
    await page.getByLabel('Ouvrir le sélecteur de projets').click()
    await page.getByRole('button', { name: `Ouvrir « ${remoteTargetName} »` }).click()
    await expect(projectName(page)).toHaveValue(remoteTargetName)
    expect(
      await page.evaluate(
        (id) => Boolean(id && window.__sfAssets?.resolveAsset(id)),
        remoteAssetId,
      ),
    ).toBe(true)

    await context.close()
    await dropRemoteProjects(own)
  })

  test('un projet non ciblé édité puis quitté pendant le pull garde sa version locale', async ({
    browser,
    baseURL,
  }) => {
    const own = await signUpSession(stack!)
    expect(await grantCloud(admin(), own.userId)).toBe('written')
    const context = await browser.newContext({ baseURL })
    const page = await context.newPage()
    await waitForApp(page)
    await requireAccountEntry(page)

    const marker = Date.now()
    const localAName = `Local non ciblé A ${String(marker)}`
    const localBName = `Local actif B ${String(marker)}`
    await page.evaluate(
      (name) => window.__sfStores?.useProjectStore.getState().createProject(name),
      localAName,
    )
    await page.getByLabel('Ajouter Texte').click()
    await expect(syncBadge(page, 'Enregistré')).toBeAttached({
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
    await expect(syncBadge(page, 'Enregistré')).toBeAttached({
      timeout: 15_000,
    })
    if (!localA) throw new Error('Could not create the non-target local fixture.')

    const remoteA = structuredClone(localA)
    remoteA.name = `Remote ancien A ${String(marker)}`
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
    await seedRemoteAsset(
      own,
      remoteAssetId,
      new Blob([new Uint8Array(makeSolidPng(8, 8, [234, 88, 12, 255]))], { type: 'image/png' }),
    )
    expect(
      await seedRemoteProject(own, {
        projectId: remoteA.id,
        name: remoteA.name,
        updatedAt: remoteA.updatedAt,
        payload: remoteA,
      }),
    ).toBe('accepted')

    let releaseDownload!: () => void
    const heldDownload = new Promise<void>((resolve) => {
      releaseDownload = resolve
    })
    let markDownloadStarted!: () => void
    const downloadStarted = new Promise<void>((resolve) => {
      markDownloadStarted = resolve
    })
    await page.route(`${stack!.site}/asset/*`, async (route) => {
      if (route.request().url().includes(remoteAssetId)) {
        markDownloadStarted()
        await heldDownload
      }
      await route.continue()
    })
    await seedSession(page, own)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(projectName(page)).toHaveValue(localBName)
    await downloadStarted

    await page.getByLabel('Ouvrir le sélecteur de projets').click()
    await page.getByRole('button', { name: `Ouvrir « ${localAName} »` }).click()
    const editedAName = `${localAName} édité`
    await projectName(page).fill(editedAName)
    await projectName(page).press('Enter')
    await expect(syncBadge(page, 'Enregistré')).toBeAttached({
      timeout: 15_000,
    })
    await page.getByLabel('Ouvrir le sélecteur de projets').click()
    await page.getByRole('button', { name: `Ouvrir « ${localBName} »` }).click()
    await expect(projectName(page)).toHaveValue(localBName)
    releaseDownload()

    await expect
      .poll(async () => Boolean(await remoteRow(own, editedAName)), { timeout: 30_000 })
      .toBe(true)
    await expect(projectName(page)).toHaveValue(localBName)
    await page.getByLabel('Ouvrir le sélecteur de projets').click()
    await page.getByRole('button', { name: `Ouvrir « ${editedAName} »` }).click()
    await expect(projectName(page)).toHaveValue(editedAName)

    await context.close()
    await dropRemoteProjects(own)
  })

  test('deux poussées livrées dans l’ordre inverse conservent la version récente', async () => {
    const own = await signUpSession(stack!)
    expect(await grantCloud(admin(), own.userId)).toBe('written')

    const projectId = crypto.randomUUID()
    const recent = Date.parse('2030-08-09T12:00:00Z')
    const stale = Date.parse('2030-08-09T11:00:00Z')

    expect(
      await seedRemoteProject(own, {
        projectId,
        name: 'Récent',
        updatedAt: recent,
        payload: { name: 'Récent', revision: recent },
      }),
    ).toBe('accepted')
    expect(
      await seedRemoteProject(own, {
        projectId,
        name: 'Ancien',
        updatedAt: stale,
        payload: { name: 'Ancien', revision: stale },
      }),
    ).toBe('stale')

    const row = await remoteRow(own, 'Récent')
    expect(row).toMatchObject({ projectId, name: 'Récent', updatedAt: recent })
    expect(row!.data).toMatchObject({ revision: recent })

    await dropRemoteProjects(own)
  })

  test('un asset absent reste non confirmé et met la synchronisation en échec', async ({
    browser,
    baseURL,
  }) => {
    const own = await signUpSession(stack!)
    expect(await grantCloud(admin(), own.userId)).toBe('written')
    const page = await openApp(browser, baseURL!, own)
    await requireAccountEntry(page)
    await expect(syncBadge(page, 'Synchronisé')).toBeAttached({ timeout: 30_000 })

    const marker = `Projet asset absent ${String(Date.now())}`
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
    expect(await remoteRow(own, marker)).toBeNull()
    await page.context().close()
    await dropRemoteProjects(own)
  })

  test('un projet distant corrompu ne bloque ni n’expose les projets sains', async ({
    browser,
    baseURL,
  }) => {
    const own = await signUpSession(stack!)
    expect(await grantCloud(admin(), own.userId)).toBe('written')

    /* On fabrique les deux documents avec le store réel pour rester aligné sur
       le contrat courant, puis on les dépose directement comme le ferait un
       autre navigateur. */
    const sourceContext = await browser.newContext({ baseURL: baseURL! })
    const source = await sourceContext.newPage()
    await waitForApp(source)
    await requireAccountEntry(source)
    const marker = Date.now()
    const healthyName = `Cloud sain ${String(marker)}`
    const brokenName = `Cloud incomplet ${String(marker)}`
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

    for (const project of [healthy, broken]) {
      expect(
        await seedRemoteProject(own, {
          projectId: project.id,
          name: project.name,
          updatedAt: project.updatedAt,
          payload: project,
        }),
      ).toBe('accepted')
    }

    const page = await openApp(browser, baseURL!, own)
    await expect(syncBadge(page, 'Échec de la synchronisation')).toBeAttached({ timeout: 30_000 })
    await page.getByLabel('Ouvrir le sélecteur de projets').click()
    await expect(page.getByRole('button', { name: `Ouvrir « ${healthyName} »` })).toBeVisible()
    await expect(page.getByRole('button', { name: `Ouvrir « ${brokenName} »` })).toHaveCount(0)
    await page.getByRole('button', { name: `Ouvrir « ${healthyName} »` }).click()
    await expect(projectName(page)).toHaveValue(healthyName)

    await page.context().close()
    await dropRemoteProjects(own)
  })

  test('une modification hors ligne finit dans le cloud au retour du réseau', async ({
    browser,
    baseURL,
  }) => {
    const own = await signUpSession(stack!)
    expect(await grantCloud(admin(), own.userId)).toBe('written')
    const page = await openApp(browser, baseURL!, own)
    await requireAccountEntry(page)
    await expect(syncBadge(page, 'Synchronisé')).toBeAttached({ timeout: 30_000 })

    const marker = `Projet hors ligne ${String(Date.now())}`
    await projectName(page).fill(marker)
    await projectName(page).press('Enter')
    await expect
      .poll(async () => Boolean(await remoteRow(own, marker)), { timeout: 15_000 })
      .toBe(true)
    const before = await remoteRow(own, marker)

    await page.context().setOffline(true)
    await page.getByLabel('Ajouter Texte').click()
    await page.evaluate(() => window.__sfStores?.useUIStore.getState().toggleTheme())
    await expect
      .poll(() => page.evaluate(() => window.__sfStores?.useUIStore.getState().theme))
      .toBe('light')
    await expect(syncBadge(page, 'Hors ligne — reprendra au retour du réseau')).toBeAttached({
      timeout: 15_000,
    })

    /* Rien ne demande à l'utilisateur de réessayer : le retour du réseau suffit. */
    await page.context().setOffline(false)
    await expect
      .poll(
        async () => {
          const after = await remoteRow(own, marker)
          return after ? after.updatedAt > before!.updatedAt : false
        },
        { timeout: 30_000 },
      )
      .toBe(true)
    await expect(syncBadge(page, 'Synchronisé')).toBeAttached({ timeout: 30_000 })

    const secondBrowser = await openApp(browser, baseURL!, own)
    await expect
      .poll(() => secondBrowser.evaluate(() => window.__sfStores?.useUIStore.getState().theme))
      .toBe('light')

    await page.context().close()
    await secondBrowser.context().close()
    await dropRemoteProjects(own)
  })

  test('un rechargement rejoue tous les projets modifiés hors ligne avec leurs assets', async ({
    browser,
    baseURL,
  }) => {
    const own = await signUpSession(stack!)
    expect(await grantCloud(admin(), own.userId)).toBe('written')
    const page = await openApp(browser, baseURL!, own)
    await requireAccountEntry(page)
    await expect(syncBadge(page, 'Synchronisé')).toBeAttached({ timeout: 30_000 })

    const marker = Date.now()
    const onlineNames = [`File A ${String(marker)}`, `File B ${String(marker)}`]
    for (const name of onlineNames) {
      await page.evaluate(
        (created) => window.__sfStores?.useProjectStore.getState().createProject(created),
        name,
      )
      await page.getByLabel('Ajouter Texte').click()
      await expect
        .poll(async () => Boolean(await remoteRow(own, name)), { timeout: 30_000 })
        .toBe(true)
    }

    await page.getByLabel('Ouvrir le sélecteur de projets').click()
    await page.getByRole('button', { name: `Ouvrir « ${onlineNames[0]} »` }).click()
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
    await expect(syncBadge(page, 'Enregistré')).toBeAttached({
      timeout: 15_000,
    })
    const assetA = await page.evaluate(() => {
      const project = window.__sfStores?.useProjectStore.getState().project
      const layer = project?.screens
        .flatMap((screen) => screen.layers)
        .find((candidate) => candidate.type === 'image')
      return layer?.type === 'image' ? layer.assetId : null
    })

    await page.getByLabel('Ouvrir le sélecteur de projets').click()
    await page.getByRole('button', { name: `Ouvrir « ${onlineNames[1]} »` }).click()
    await expect(projectName(page)).toHaveValue(onlineNames[1])
    await projectName(page).fill(offlineNames[1])
    await projectName(page).press('Enter')
    await page.getByLabel('Importer une image').setInputFiles({
      name: 'b.png',
      mimeType: 'image/png',
      buffer: makeSolidPng(8, 8, [37, 99, 235, 255]),
    })
    await expect(syncBadge(page, 'Enregistré')).toBeAttached({
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

    /* Le rechargement se fait toujours coupé du déploiement : c'est ce qui
       garantit que rien n'est parti pendant le démarrage, et que ce qui remonte
       ensuite vient bien de la file. La coupure est armée avant que le réseau
       revienne, sans quoi la connexion en cours flancherait la file avant même
       le rechargement. */
    const reconnect = await cutDeployment(page)
    await page.context().setOffline(false)
    await waitForApp(page)
    await expect(projectName(page)).toHaveValue(offlineNames[1])
    reconnect()
    await page.evaluate(() => window.dispatchEvent(new Event('online')))

    for (const name of offlineNames) {
      await expect
        .poll(async () => Boolean(await remoteRow(own, name)), { timeout: 30_000 })
        .toBe(true)
    }
    const [downloadA, downloadB] = await Promise.all([
      readRemote(stack!, own, `/asset/${String(assetA)}`),
      readRemote(stack!, own, `/asset/${String(assetB)}`),
    ])
    expect(downloadA).not.toBeNull()
    expect(downloadB).not.toBeNull()
    expect(downloadA!.length).toBeGreaterThan(0)
    expect(downloadB!.length).toBeGreaterThan(0)
    await expect(projectName(page)).toHaveValue(offlineNames[1])
    expect(
      await page.evaluate((id) => Boolean(id && window.__sfAssets?.resolveAsset(id)), assetB),
    ).toBe(true)

    await page.context().close()
    await dropRemoteProjects(own)
  })
})

/**
 * La porte commerciale, vue du navigateur.
 *
 * `requireCloud` refuse déjà l'écriture d'un compte sans abonnement — c'est le
 * verrou, et `apps/backend/convex/authz.test.ts` le tient. Ce qui se mesure ici
 * est l'autre moitié : un compte sans Cloud ne doit rien *tenter*. Lui laisser
 * découvrir la porte par un refus produirait une pastille rouge et un toast
 * d'échec pour une fonction qu'il n'a simplement pas achetée.
 */
test.describe('Porte Cloud côté client', () => {
  test.skip(!stack, 'déploiement Convex local arrêté')
  test.setTimeout(120_000)

  test('un compte Cloud seul affiche le plan complet sans prérequis Local', async ({
    browser,
    baseURL,
  }) => {
    const own = await signUpSession(stack!)
    expect(await grantCloud(admin(), own.userId)).toBe('written')

    const page = await openApp(browser, baseURL!, own)
    await requireAccountEntry(page)
    await expect
      .poll(() => page.evaluate(() => window.__sfStores?.useAuthStore.getState().entitlements))
      .toMatchObject({ cloud: true })

    await page.getByRole('button', { name: 'Mon compte' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Compte' })
    await expect(dialog.getByText('Cloud', { exact: true })).toBeVisible()
    await expect(dialog.getByText(/synchronisation et stockage managés/)).toBeVisible()
    await expect(
      dialog.getByText('Synchronisation : projets, images et thème sur chaque machine.'),
    ).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Factures et paiement' })).toBeVisible()
    await expect(dialog.getByText(/Licence|add-on|nécessite/i)).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: 'Passer au Cloud' })).toHaveCount(0)

    await page.context().close()
  })

  test('l’accès propriétaire active puis révoque les droits client sans facturation', async ({
    browser,
    baseURL,
  }) => {
    const own = await signUpSession(stack!)
    expect(await setComplimentaryAccess(admin(), own.userId, true)).toBe('written')

    const page = await openApp(browser, baseURL!, own)
    await requireAccountEntry(page)
    await expect
      .poll(() => page.evaluate(() => window.__sfStores?.useAuthStore.getState().entitlements))
      .toMatchObject({
        cloud: true,
        cloudStatus: null,
        cloudPeriodEnd: null,
      })

    await page.getByLabel('Ouvrir l’export').click()
    await expect(page.getByText('Essai gratuit')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Exporter le ZIP' })).toBeEnabled()
    await page.getByRole('button', { name: 'Annuler' }).click()

    const marker = `Projet propriétaire ${String(Date.now())}`
    await projectName(page).fill(marker)
    await projectName(page).press('Enter')
    await expect.poll(async () => Boolean(await remoteRow(own, marker))).toBe(true)

    await page.getByRole('button', { name: 'Mon compte' }).first().click()
    const account = page.getByRole('dialog', { name: 'Compte' })
    await expect(account.getByText('Cloud', { exact: true })).toBeVisible()
    await expect(account.getByRole('button', { name: 'Factures et paiement' })).toHaveCount(0)
    await account.getByRole('button', { name: 'Fermer' }).click()

    expect(await setComplimentaryAccess(admin(), own.userId, false)).toBe('written')
    await waitForApp(page)
    await expect
      .poll(() => page.evaluate(() => window.__sfStores?.useAuthStore.getState().entitlements))
      .toMatchObject({ cloud: false })

    await page.context().close()
    await dropRemoteProjects(own)
  })

  test('un compte sans Cloud ne tente aucune synchronisation', async ({ browser, baseURL }) => {
    const own = await signUpSession(stack!)

    const page = await openApp(browser, baseURL!, own)
    await requireAccountEntry(page)

    const attempts = watchCloudRequests(page)

    await projectName(page).fill(`Projet local ${String(Date.now())}`)
    await projectName(page).press('Enter')
    await page.getByLabel('Ajouter Texte').click()
    /* Plus long que la temporisation de l'autosave (2 s) : c'est elle qui
       déclencherait un cycle s'il y en avait un à déclencher. */
    await page.waitForTimeout(5_000)

    expect(attempts, `requêtes tentées : ${attempts.join(', ')}`).toEqual([])
    /* Et rien n'a été écrit non plus : c'est ce que la WebSocket ne laisse pas
       voir depuis les requêtes, et c'est la moitié qui compte vraiment. */
    expect(await listRemote(own)).toEqual([])
    /* `SyncIndicator` ne rend rien sur `off` : aucun des quatre libellés n'est
       dans la page, donc pas même « Échec de la synchronisation ». */
    await expect(page.locator('[role="status"]').filter({ hasText: /ynchronis/ })).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)

    await page.context().close()
  })

  test('avertit un compte Local gratuit quand le navigateur ne promet rien', async ({
    browser,
    baseURL,
  }) => {
    const own = await signUpSession(stack!)
    const page = await openApp(browser, baseURL!, own)
    await requireAccountEntry(page)

    /* Posée ici, la question l'est une fois pour toutes : l'état durable est
       collant, donc la boîte lira la même réponse que celle-ci. Et la prémisse
       est affirmée plutôt que contournée par une branche — le jour où Chromium
       accorderait la durabilité à un profil neuf, ce test doit le dire au lieu
       de passer sans plus rien vérifier. */
    const durable = await page.evaluate(() => navigator.storage.persist())
    expect(durable, 'Chromium a accordé la durabilité à un profil neuf').toBe(false)

    await page.getByRole('button', { name: 'Mon compte' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Compte' })
    await expect(dialog.getByText('Local', { exact: true })).toBeVisible()
    await expect(dialog.getByText(/Gratuit · exports propres et ZIP illimités/)).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Passer au Cloud' })).toBeVisible()
    await expect(page.getByText(DURABILITY_WARNING)).toBeVisible()

    await page.context().close()
  })

  test('la déconnexion rend l’éditeur au mode local, sans erreur', async ({ browser, baseURL }) => {
    const own = await signUpSession(stack!)
    expect(await grantCloud(admin(), own.userId)).toBe('written')

    const page = await openApp(browser, baseURL!, own)
    await requireAccountEntry(page)
    await expect(syncBadge(page, 'Synchronisé')).toBeAttached({ timeout: 30_000 })

    const marker = `Projet déconnecté ${String(Date.now())}`
    await projectName(page).fill(marker)
    await projectName(page).press('Enter')
    await expect
      .poll(async () => Boolean(await remoteRow(own, marker)), { timeout: 15_000 })
      .toBe(true)

    await page.getByRole('button', { name: 'Mon compte' }).first().click()
    /* Le Cloud garde une copie ailleurs : il n'y a rien à signaler, quoi que le
       navigateur ait répondu sur sa propre durabilité. */
    await expect(page.getByText(DURABILITY_WARNING)).toBeHidden()
    await page.getByRole('button', { name: 'Se déconnecter' }).click()
    await expect(page.getByRole('button', { name: 'Se connecter' }).first()).toBeVisible()

    /* Enregistrées après la déconnexion seulement : ce qui est promis porte sur
       la suite, pas sur le cycle qui vient de se terminer. */
    const attempts = watchCloudRequests(page)

    /* Le projet reste éditable et rien ne part. Plus long que l'autosave (2 s),
       qui déclencherait le cycle s'il restait branché. */
    await expect(projectName(page)).toHaveValue(marker)
    await projectName(page).fill(`${marker} local`)
    await projectName(page).press('Enter')
    await page.getByLabel('Ajouter Texte').click()
    await page.waitForTimeout(5_000)

    expect(attempts, `requêtes tentées : ${attempts.join(', ')}`).toEqual([])
    /* La ligne distante est restée sur le nom d'avant la déconnexion. */
    expect(await remoteRow(own, `${marker} local`)).toBeNull()
    await expect(page.locator('[role="status"]').filter({ hasText: /ynchronis/ })).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(projectName(page)).toHaveValue(`${marker} local`)

    await page.context().close()
    await dropRemoteProjects(own)
  })

  test('la fin de période arrête la sync sans rien supprimer localement', async ({
    browser,
    baseURL,
  }) => {
    const own = await signUpSession(stack!)
    expect(await grantCloud(admin(), own.userId)).toBe('written')

    const abonné = await openApp(browser, baseURL!, own)
    await requireAccountEntry(abonné)
    await expect(syncBadge(abonné, 'Synchronisé')).toBeAttached({ timeout: 30_000 })

    const marker = `Projet expiré ${String(Date.now())}`
    await projectName(abonné).fill(marker)
    await projectName(abonné).press('Enter')
    await expect
      .poll(async () => Boolean(await remoteRow(own, marker)), { timeout: 15_000 })
      .toBe(true)

    expect(await expireCloud(admin(), own.userId)).toBe('written')

    /* Le même contexte, rechargé : c'est la copie *locale* qui doit survivre à
       la fin de l'abonnement, et un nouveau profil de navigateur n'en a pas —
       il ne mesurerait que le tirage, justement désactivé. */
    await waitForApp(abonné)

    /* La sync s'arrête, et le projet reste là, éditable. Le témoin disparaît au
       lieu de passer au rouge. */
    await expect(abonné.locator('[role="status"]').filter({ hasText: /ynchronis/ })).toHaveCount(0)
    await expect(projectName(abonné)).toHaveValue(marker)
    await projectName(abonné).fill(`${marker} modifié`)
    await projectName(abonné).press('Enter')
    await expect(projectName(abonné)).toHaveValue(`${marker} modifié`)
    await expect(abonné.getByRole('alert')).toHaveCount(0)

    await abonné.context().close()
    await dropRemoteProjects(own)
  })
})

/**
 * Le premier login ne fait perdre aucun projet local.
 *
 * Aucun projet antérieur au login ne quitte le navigateur sans consentement,
 * y compris celui qui est ouvert. Une fois connecté, les nouveaux commits sont
 * synchronisés automatiquement et les projets explicitement rattachés restent
 * dans la file durable.
 */
test.describe('Rattachement des projets locaux', () => {
  test.skip(!stack, 'déploiement Convex local arrêté')
  test.setTimeout(120_000)

  const migrateDialog = (page: Page) =>
    page.getByRole('dialog', { name: 'Ajouter ces projets au Cloud ?' })

  /** Un projet nommé, modifié, et écrit sur le disque local. */
  async function makeLocalProject(page: Page, name: string) {
    await page.evaluate(
      (created) => window.__sfStores?.useProjectStore.getState().createProject(created),
      name,
    )
    /* Créé et jamais touché, un projet ne compte pas comme orphelin — c'est la
       signature du « Projet sans titre » que l'éditeur ouvre au démarrage. Le
       calque en fait un projet de quelqu'un. */
    await page.getByLabel('Ajouter Texte').click()
    await expect(syncBadge(page, 'Enregistré')).toBeAttached({
      timeout: 15_000,
    })
  }

  test('propose les projets orphelins, les rattache, et revient si on refuse', async ({
    browser,
    baseURL,
  }) => {
    const own = await signUpSession(stack!)
    expect(await grantCloud(admin(), own.userId)).toBe('written')

    /* Sans session d'abord : c'est l'ordre réel — on travaille en local, puis on
       achète. Ouvrir déjà connecté ne produirait aucun orphelin. */
    const context = await browser.newContext({ baseURL: baseURL! })
    const page = await context.newPage()
    await waitForApp(page)
    await requireAccountEntry(page)

    const marque = Date.now()
    const noms = [
      `Local A ${'nom étendu '.repeat(4)}${String(marque)}`,
      `Local B ${String(marque)}`,
    ]
    for (const nom of noms) await makeLocalProject(page, nom)
    await page.getByLabel('Importer une image').setInputFiles({
      name: 'active.png',
      mimeType: 'image/png',
      buffer: makeSolidPng(8, 8, [59, 130, 246, 255]),
    })
    await expect(syncBadge(page, 'Enregistré')).toBeAttached({
      timeout: 15_000,
    })
    const activeAssetId = await page.evaluate(() => {
      const project = window.__sfStores?.useProjectStore.getState().project
      const layer = project?.screens
        .flatMap((screen) => screen.layers)
        .find((candidate) => candidate.type === 'image')
      return layer?.type === 'image' ? layer.assetId : null
    })

    await seedSession(page, own)
    await waitForApp(page)

    /* Les deux projets antérieurs à la session, actif inclus, attendent un
       consentement explicite. « Pas maintenant » n'envoie et n'enregistre rien. */
    await expect(migrateDialog(page)).toBeVisible({ timeout: 30_000 })
    await expect(
      migrateDialog(page).getByText(
        'Ces projets sont enregistrés uniquement sur cet appareil. Ajoutez-les au Cloud pour les retrouver sur vos autres appareils.',
      ),
    ).toBeVisible()
    const projectList = migrateDialog(page).getByRole('list', { name: 'Projets à ajouter' })
    await expect(projectList.getByRole('listitem')).toHaveCount(2)
    for (const nom of noms) await expect(projectList.getByText(nom)).toBeVisible()
    await expect(projectList.locator('button, input')).toHaveCount(0)
    const localCopyGuarantee = migrateDialog(page).getByText('Leur copie locale reste disponible.')
    await expect(localCopyGuarantee).toBeVisible()
    await expect(
      migrateDialog(page).getByRole('button', { name: 'Ajouter les 2 projets au Cloud' }),
    ).toBeVisible()
    /* Un zoom navigateur à 200 % divise par deux le viewport CSS disponible.
       Cette largeur/hauteur effective force le même reflow sans dépendre du
       chrome du navigateur, absent en headless. */
    await page.setViewportSize({ width: 260, height: 380 })
    await expect(migrateDialog(page).getByRole('button', { name: 'Fermer' })).toBeInViewport()
    await expect(
      migrateDialog(page).getByRole('button', { name: 'Pas maintenant' }),
    ).toBeInViewport()
    await expect(
      migrateDialog(page).getByRole('button', { name: 'Ajouter les 2 projets au Cloud' }),
    ).toBeInViewport()
    await projectList.scrollIntoViewIfNeeded()
    await expect(projectList).toBeInViewport()
    await localCopyGuarantee.scrollIntoViewIfNeeded()
    const [guaranteeBox, actionBox] = await Promise.all([
      localCopyGuarantee.boundingBox(),
      migrateDialog(page).getByRole('button', { name: 'Pas maintenant' }).boundingBox(),
    ])
    expect(guaranteeBox).not.toBeNull()
    expect(actionBox).not.toBeNull()
    expect(guaranteeBox!.y + guaranteeBox!.height).toBeLessThanOrEqual(actionBox!.y)
    await page.setViewportSize({ width: 1600, height: 1000 })
    await expect.poll(async () => (await listRemote(own)).length).toBe(0)
    await page.getByRole('button', { name: 'Pas maintenant' }).click()
    await expect(migrateDialog(page)).toHaveCount(0)
    await expect(syncBadge(page, 'Synchronisé')).toBeAttached({ timeout: 30_000 })
    await expect.poll(async () => (await listRemote(own)).length).toBe(0)

    await waitForApp(page)
    await expect(migrateDialog(page)).toBeVisible({ timeout: 30_000 })
    for (const nom of noms) await expect(migrateDialog(page).getByText(nom)).toBeVisible()
    await expect.poll(async () => (await listRemote(own)).length).toBe(0)

    /* L'action Cloud explicite est le premier geste qui envoie ces projets. */
    await page.getByRole('button', { name: 'Ajouter les 2 projets au Cloud' }).click()
    await expect(migrateDialog(page)).toHaveCount(0)
    await expect.poll(async () => (await listRemote(own)).length, { timeout: 30_000 }).toBe(2)
    for (const nom of noms) expect(await remoteRow(own, nom)).toBeTruthy()
    expect(activeAssetId).not.toBeNull()
    expect(
      await page.evaluate(
        (id) => Boolean(id && window.__sfAssets?.resolveAsset(id)),
        activeAssetId,
      ),
    ).toBe(true)

    /* Une création puis un changement après le login restent automatiques :
       ce consentement découle de la session Cloud déjà active, pas du cycle
       initial qui vient d'être corrigé. Cette preuve précède le profil neuf,
       dont le projet initial est lui aussi créé après restauration de session. */
    const postLoginName = `Après connexion ${String(marque)}`
    await makeLocalProject(page, postLoginName)
    await expect
      .poll(async () => Boolean(await remoteRow(own, postLoginName)), { timeout: 30_000 })
      .toBe(true)
    await expect.poll(async () => (await listRemote(own)).length).toBe(3)

    const fresh = await openApp(browser, baseURL!, own)
    await expect(syncBadge(fresh, 'Synchronisé')).toBeAttached({ timeout: 30_000 })
    await fresh.getByLabel('Ouvrir le sélecteur de projets').click()
    const firstProject = fresh.getByRole('button', { name: `Ouvrir « ${noms[0]} »` })
    await expect(firstProject).toHaveAccessibleDescription(/Cloud/)
    await firstProject.click()
    await expect(projectName(fresh)).toHaveValue(noms[0])
    await fresh.getByLabel('Ouvrir le sélecteur de projets').click()
    await fresh.getByRole('button', { name: `Ouvrir « ${noms[1]} »` }).click()
    await expect(projectName(fresh)).toHaveValue(noms[1])

    await fresh.context().close()
    await context.close()
    await dropRemoteProjects(own)
  })

  test('nomme explicitement l’ajout d’un seul projet', async ({ browser, baseURL }) => {
    const own = await signUpSession(stack!)
    expect(await grantCloud(admin(), own.userId)).toBe('written')
    const context = await browser.newContext({ baseURL: baseURL! })
    const page = await context.newPage()
    await waitForApp(page)
    await requireAccountEntry(page)

    await makeLocalProject(page, `Projet unique ${String(Date.now())}`)
    await seedSession(page, own)
    await waitForApp(page)
    await expect(migrateDialog(page)).toBeVisible({ timeout: 30_000 })
    await expect(
      migrateDialog(page).getByRole('button', { name: 'Ajouter ce projet au Cloud' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Pas maintenant' }).click()
    await expect.poll(async () => (await listRemote(own)).length).toBe(0)

    await context.close()
    await dropRemoteProjects(own)
  })

  test('nomme le projet qui échoue sans retenir les autres', async ({ browser, baseURL }) => {
    const own = await signUpSession(stack!)
    expect(await grantCloud(admin(), own.userId)).toBe('written')
    const context = await browser.newContext({ baseURL: baseURL! })
    const page = await context.newPage()
    await waitForApp(page)
    await requireAccountEntry(page)

    const marker = Date.now()
    const healthyName = `Projet sain ${String(marker)}`
    const brokenName = `Projet incomplet ${String(marker)}`
    await makeLocalProject(page, healthyName)
    await makeLocalProject(page, brokenName)
    await page.getByLabel('Importer une image').setInputFiles({
      name: 'missing.png',
      mimeType: 'image/png',
      buffer: makeSolidPng(8, 8, [59, 130, 246, 255]),
    })
    await expect(syncBadge(page, 'Enregistré')).toBeAttached({ timeout: 15_000 })
    const brokenAssetId = await page.evaluate(() => {
      const project = window.__sfStores?.useProjectStore.getState().project
      const layer = project?.screens
        .flatMap((screen) => screen.layers)
        .find((candidate) => candidate.type === 'image')
      return layer?.type === 'image' ? layer.assetId : null
    })
    expect(brokenAssetId).not.toBeNull()
    await page.evaluate(async (assetId) => {
      const storagePath = '/src/lib/storage.ts'
      const { getDB } = (await import(storagePath)) as typeof import('../src/lib/storage')
      const db = await getDB()
      if (assetId) await db.delete('assets', assetId)
    }, brokenAssetId)

    await seedSession(page, own)
    await waitForApp(page)
    await expect(migrateDialog(page)).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Ajouter les 2 projets au Cloud' }).click()
    await expect(migrateDialog(page)).toHaveCount(0)
    await expect.poll(async () => (await listRemote(own)).length, { timeout: 30_000 }).toBe(1)
    expect(await remoteRow(own, healthyName)).toBeTruthy()
    expect(await remoteRow(own, brokenName)).toBeFalsy()
    const result = page.getByRole('alert').filter({ hasText: 'Échec de l’ajout au Cloud' })
    await expect(result).toContainText(brokenName)
    await expect(result).toContainText('Leur copie locale reste disponible.')

    await context.close()
    await dropRemoteProjects(own)
  })
})
