/**
 * Le déploiement local, et les gestes que seul le backend peut faire.
 *
 * Il vit hors de `apps/web` parce que rien ici n'a de raison d'être compilé
 * dans le navigateur, à commencer par la clé d'administration. Celle-ci n'est
 * pas un secret partagé : `convex dev --anonymous` l'écrit dans un répertoire
 * ignoré par git, propre à cette machine et à ce déploiement anonyme. Elle ne
 * vaut rien ailleurs.
 *
 * Elle sert à une chose : appeler les `internalMutation`, qu'aucun client ne
 * peut atteindre. La frontière entre ce qu'un client peut appeler et le reste
 * est déclarée dans le code, elle ne dépend d'aucun rôle privilégié qu'il
 * faudrait ne pas divulguer.
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

const inspectSessionCleanup = internal.accountDeletion
  .inspectSessionCleanup as unknown as FunctionReference<
  'query',
  'public',
  { sessionId: Id<'authSessions'> },
  { session: boolean; refreshToken: boolean; verifier: boolean }
>

/** L'identifiant porté par le jeton : `subject` vaut `${userId}|${sessionId}`. */
export function userIdOf(token: string): string {
  const body = token.split('.')[1] ?? ''
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { sub: string }
  return payload.sub.split('|')[0] ?? ''
}

export function sessionIdOf(token: string): Id<'authSessions'> {
  const body = token.split('.')[1] ?? ''
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { sub: string }
  const sessionId = payload.sub.split('|')[1]
  if (!sessionId) throw new Error('session absente du jeton')
  return sessionId as Id<'authSessions'>
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
  options: { email?: string } = {},
): Promise<Session> {
  accounts += 1
  const email =
    options.email ??
    `sync-${String(Date.now())}-${String(process.pid)}-${String(accounts)}@screenforge.test`
  const password = `fixture-${crypto.randomUUID()}`
  const client = anonClient(stack)
  const result = await client.action(api.auth.signIn, {
    provider: 'test-password',
    params: { email, password, flow: 'signUp' },
  })
  if (!result.tokens) throw new Error(`aucun jeton après signUp pour ${email}`)

  const { token, refreshToken } = result.tokens
  client.setAuth(token)
  return { client, email, token, refreshToken, userId: userIdOf(token) }
}

export async function growRefreshChain(session: Session, count: number): Promise<void> {
  for (let rank = 0; rank < count; rank += 1) {
    const result = await session.client.action(api.auth.signIn, {
      refreshToken: session.refreshToken,
    })
    if (!result.tokens) throw new Error(`aucun jeton après refresh ${String(rank + 1)}`)
    session.token = result.tokens.token
    session.refreshToken = result.tokens.refreshToken
    session.client.setAuth(session.token)
  }
}

export function inspectDeletedSession(admin: ConvexHttpClient, sessionId: Id<'authSessions'>) {
  return admin.query(inspectSessionCleanup, { sessionId })
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

/** Un abonnement Cloud autonome en cours, sans achat Local implicite. */
export function grantCloud(admin: ConvexHttpClient, userId: string) {
  return admin.mutation(applyEntitlements, {
    userId,
    polarCustomerId: customer(userId),
    licenceGrantedAt: null,
    cloudStatus: 'active',
    cloudPeriodEnd: '2099-01-01T00:00:00.000Z',
    sourceUpdatedAt: Date.now(),
  })
}

/**
 * La fin de période d'un Cloud autonome : le statut reste renseigné, c'est la
 * date qui a passé, et aucun achat Local n'est inventé au passage.
 */
export function expireCloud(admin: ConvexHttpClient, userId: string) {
  return admin.mutation(applyEntitlements, {
    userId,
    polarCustomerId: customer(userId),
    licenceGrantedAt: null,
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
  const query = new URLSearchParams({
    projectId: project.projectId,
    name: project.name,
    updatedAt: String(project.updatedAt),
  })
  return (
    await postUpload(
      session,
      `/upload/project?${query.toString()}`,
      new Blob([JSON.stringify(project.payload)], { type: 'application/json' }),
    )
  ).outcome as 'accepted' | 'stale' | 'too-large'
}

/** Pose un binaire distant, en suivant les deux mutations du vrai chemin. */
export async function seedRemoteAsset(
  session: Session,
  assetId: string,
  blob: Blob,
): Promise<void> {
  const result = await tryRemoteAssetUpload(session, assetId, blob)
  if (result.outcome !== 'accepted') throw new Error(`le déploiement a refusé l’asset ${assetId}`)
}

/** Même transport que le navigateur, avec le statut visible pour les bornes E2E. */
export async function tryRemoteAssetUpload(
  session: Session,
  assetId: string,
  blob: Blob,
): Promise<{ status: number; outcome: string }> {
  const query = new URLSearchParams({ assetId })
  return await postUpload(session, `/upload/asset?${query.toString()}`, blob)
}

async function postUpload(
  session: Session,
  path: string,
  blob: Blob,
): Promise<{ status: number; outcome: string }> {
  const stack = localConvex()
  if (!stack) throw new Error('déploiement Convex local absent')
  const response = await fetch(`${stack.site}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.token}`,
      'Content-Type': blob.type || 'application/octet-stream',
    },
    body: blob,
  })
  const body = (await response.json()) as { outcome?: string }
  if (!body.outcome) {
    throw new Error(`téléversement refusé : ${String(response.status)} ${JSON.stringify(body)}`)
  }
  return { status: response.status, outcome: body.outcome }
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

/** Retire le compte jetable d'un scénario et ses fichiers. */
export function deleteRemoteAccount(session: Session) {
  return session.client.mutation(api.accountDeletion.requestAccountDeletion, {})
}
