/**
 * Le déploiement local, et les gestes que seul le backend peut faire.
 *
 * C'est le pendant de `supabase/tests/stack.mjs` — même rôle, même place hors
 * de `apps/web` — avec une différence qui est le vrai gain de la migration : il
 * n'y a plus de clé `service_role` à ne pas divulguer. La clé d'administration
 * lue ici n'est pas un secret partagé mais une valeur écrite par
 * `convex dev --anonymous` dans un répertoire ignoré par git, propre à cette
 * machine et à ce déploiement anonyme. Elle ne vaut rien ailleurs.
 *
 * Elle sert à une chose : appeler les `internalMutation`, qu'aucun client ne
 * peut atteindre. C'est ce qui remplace le rôle privilégié, et c'est un
 * meilleur remplacement — la frontière est déclarée dans le code plutôt que
 * tenue par une politique de base de données.
 */
import { ConvexHttpClient } from 'convex/browser'
import type { FunctionReference } from 'convex/server'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { api, internal } from '../convex/_generated/api.js'
import type { Id } from '../convex/_generated/dataModel.js'

export interface Stack {
  url: string
  site: string
  adminKey: string
}

export interface Session {
  client: ConvexHttpClient
  email: string
  password: string
  token: string
  refreshToken: string
  userId: string
}

export interface RemoteRow {
  projectId: string
  name: string
  updatedAt: number
}

/**
 * La racine de l'espace de travail, remontée depuis le répertoire courant.
 *
 * `import.meta.url` serait plus direct et ne marche pas ici : Playwright
 * transpile ce qu'il charge, et ce module est importé par
 * `playwright.config.ts` autant que par une spec. Le marqueur remonté est celui
 * qui définit l'espace de travail lui-même.
 */
function workspaceRoot(): string | null {
  let directory = process.cwd()
  for (;;) {
    if (existsSync(join(directory, 'pnpm-workspace.yaml'))) return directory
    const parent = dirname(directory)
    if (parent === directory) return null
    directory = parent
  }
}

/**
 * Le déploiement anonyme démarré par `pnpm run dev:backend`, ou `null`.
 *
 * `null` est un saut de test et pas un échec : `pnpm run test:e2e` doit rester
 * exécutable sans backend, comme il l'était sans Docker.
 */
export function localConvex(): Stack | null {
  if (process.env.CONVEX_URL && process.env.CONVEX_SITE_URL) {
    return {
      url: process.env.CONVEX_URL,
      site: process.env.CONVEX_SITE_URL,
      adminKey: process.env.CONVEX_ADMIN_KEY ?? '',
    }
  }
  const root = workspaceRoot()
  if (!root) return null
  try {
    const config = JSON.parse(
      readFileSync(
        join(root, 'apps', 'backend', '.convex', 'local', 'default', 'config.json'),
        'utf8',
      ),
    ) as { ports: { cloud: number; site: number }; adminKey: string }
    return {
      url: `http://127.0.0.1:${String(config.ports.cloud)}`,
      site: `http://127.0.0.1:${String(config.ports.site)}`,
      adminKey: config.adminKey,
    }
  } catch {
    return null
  }
}

/** Un client par identité : aucune session partagée, comme un vrai visiteur. */
export function anonClient(stack: Stack): ConvexHttpClient {
  return new ConvexHttpClient(stack.url)
}

/** Le client qui atteint les fonctions internes — celui du webhook, et de lui seul. */
export function adminClient(stack: Stack): ConvexHttpClient {
  const client = new ConvexHttpClient(stack.url)
  /* `setAdminAuth` existe et c'est le CLI lui-même qui s'en sert (`convex run`),
     mais elle n'est pas dans les types publics du client : elle n'est pas
     destinée à une application. Ici elle l'est — c'est le seul chemin vers une
     `internalMutation` depuis Node. */
  ;(client as unknown as { setAdminAuth: (token: string) => void }).setAdminAuth(stack.adminKey)
  return client
}

/**
 * Le miroir, vu comme une mutation ordinaire.
 *
 * `internal.*` porte le marqueur `"internal"` dans ses types et `client.mutation`
 * n'accepte que `"public"` — c'est exactement la frontière qui remplace le rôle
 * privilégié, et elle est tenue à la compilation. La forcer se fait ici, une
 * fois, à l'endroit où la clé d'administration est déjà en main.
 */
const applyEntitlements = internal.mirror.applyEntitlementsIfNewer as unknown as FunctionReference<
  'mutation',
  'public',
  {
    userId: string
    polarCustomerId: string
    licenceGrantedAt: string | null
    cloudStatus: string | null
    cloudPeriodEnd: string | null
    sourceUpdatedAt: number | null
  },
  'written' | 'unchanged' | 'ignored'
>

/** L'identifiant porté par le jeton : `subject` vaut `${userId}|${sessionId}`. */
export function userIdOf(token: string): string {
  const body = token.split('.')[1] ?? ''
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { sub: string }
  return payload.sub.split('|')[0] ?? ''
}

let accounts = 0

/**
 * Un compte neuf, et les jetons exacts que le navigateur porterait.
 *
 * Le mot de passe existe pour cela : le lien magique arrive par courrier et le
 * SSO passe par un tiers, donc ni l'un ni l'autre ne s'automatise. La suite
 * n'invente pas le format des jetons, elle prend ceux que `signIn` rend.
 */
export async function signUpSession(
  stack: Stack,
  options: { email?: string; password?: string } = {},
): Promise<Session> {
  accounts += 1
  const email =
    options.email ??
    `sync-${String(Date.now())}-${String(process.pid)}-${String(accounts)}@screenforge.test`
  const password = options.password ?? 'motdepasse-de-test'
  const client = anonClient(stack)
  const result = await client.action(api.auth.signIn, {
    provider: 'password',
    params: { email, password, flow: 'signUp' },
  })
  if (!result.tokens) throw new Error(`aucun jeton après signUp pour ${email}`)

  const { token, refreshToken } = result.tokens
  client.setAuth(token)
  return { client, email, password, token, refreshToken, userId: userIdOf(token) }
}

const customer = (userId: string) => `cus_${userId.slice(0, 8)}`
const LICENCE_AT = '2026-03-12T09:00:00.000Z'

/** L'achat de la Licence seule : perpétuelle, sans échéance. */
export function grantLicence(admin: ConvexHttpClient, userId: string) {
  return admin.mutation(applyEntitlements, {
    userId,
    polarCustomerId: customer(userId),
    licenceGrantedAt: LICENCE_AT,
    cloudStatus: null,
    cloudPeriodEnd: null,
    sourceUpdatedAt: Date.now(),
  })
}

/** La Licence plus l'abonnement Cloud en cours — ce que `requireCloud` exige. */
export function grantCloud(admin: ConvexHttpClient, userId: string) {
  return admin.mutation(applyEntitlements, {
    userId,
    polarCustomerId: customer(userId),
    licenceGrantedAt: LICENCE_AT,
    cloudStatus: 'active',
    cloudPeriodEnd: '2099-01-01T00:00:00.000Z',
    sourceUpdatedAt: Date.now(),
  })
}

/**
 * La fin de période, telle que Polar la laisse : le statut reste renseigné,
 * c'est la date qui a passé. La Licence, elle, ne bouge pas.
 */
export function expireCloud(admin: ConvexHttpClient, userId: string) {
  return admin.mutation(applyEntitlements, {
    userId,
    polarCustomerId: customer(userId),
    licenceGrantedAt: LICENCE_AT,
    cloudStatus: 'active',
    cloudPeriodEnd: '2020-01-01T00:00:00.000Z',
    sourceUpdatedAt: Date.now() + 1,
  })
}

/**
 * Pose un projet distant sans passer par le navigateur : les octets d'abord, la
 * ligne ensuite, exactement dans l'ordre du client.
 */
export async function seedRemoteProject(
  session: Session,
  project: { projectId: string; name: string; updatedAt: number; payload: unknown },
): Promise<'accepted' | 'stale' | 'too-large'> {
  const uploadUrl = await session.client.mutation(api.projects.beginProjectPush, {})
  const blobId = await postBlob(
    uploadUrl,
    new Blob([JSON.stringify(project.payload)], { type: 'application/json' }),
  )
  return await session.client.mutation(api.projects.pushProject, {
    projectId: project.projectId,
    name: project.name,
    updatedAt: project.updatedAt,
    blobId,
  })
}

/** Pose un binaire distant, en suivant les deux mutations du vrai chemin. */
export async function seedRemoteAsset(
  session: Session,
  assetId: string,
  blob: Blob,
): Promise<void> {
  const uploadUrl = await session.client.mutation(api.assets.requestAssetUpload, {
    assetId,
    contentType: blob.type,
    byteLength: blob.size,
  })
  const storageId = await postBlob(uploadUrl, blob)
  const confirmed = await session.client.mutation(api.assets.confirmAssetUpload, {
    assetId,
    storageId,
    contentType: blob.type,
    byteLength: blob.size,
  })
  if (!confirmed) throw new Error(`le déploiement a refusé l’asset ${assetId}`)
}

async function postBlob(uploadUrl: string, blob: Blob): Promise<Id<'_storage'>> {
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'application/octet-stream' },
    body: blob,
  })
  if (!response.ok) throw new Error(`téléversement refusé : ${String(response.status)}`)
  const body = (await response.json()) as { storageId: Id<'_storage'> }
  return body.storageId
}

/** Le catalogue distant, métadonnées seules. */
export function listRemote(session: Session): Promise<RemoteRow[]> {
  return session.client.query(api.projects.listProjects, {})
}

/** La ligne d'un projet distant et son contenu, ou `null`. */
export async function remoteProject(
  stack: Stack,
  session: Session,
  name: string,
): Promise<(RemoteRow & { data: unknown }) | null> {
  const rows = await listRemote(session)
  const row = rows.find((candidate) => candidate.name === name)
  if (!row) return null
  const payload = await readRemote(stack, session, `/project-blob/${row.projectId}`)
  return { ...row, data: payload === null ? null : (JSON.parse(payload) as unknown) }
}

/**
 * Une route de lecture, avec le jeton du compte. `null` sur 404 — l'absence et
 * le refus rendent la même chose, et c'est le point.
 */
export async function readRemote(
  stack: Stack,
  session: Session,
  path: string,
): Promise<string | null> {
  const response = await fetch(`${stack.site}${path}`, {
    headers: { Authorization: `Bearer ${session.token}` },
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`lecture distante : ${String(response.status)}`)
  return await response.text()
}

/**
 * Le ménage : les projets d'un compte, quels qu'ils soient. Les binaires
 * partent avec le compte en phase 5 ; ici le compte lui-même est jetable.
 */
export async function dropRemoteProjects(session: Session): Promise<void> {
  for (const row of await listRemote(session)) {
    await session.client.mutation(api.projects.removeProject, { projectId: row.projectId })
  }
}
