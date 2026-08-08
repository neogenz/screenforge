/**
 * La porte commerciale du seul droit qui coûte tous les mois.
 *
 * Le filigrane et le compteur d'exports sont peints dans le navigateur et se
 * contournent avec la console ouverte : c'est assumé, l'export local sans
 * serveur est la promesse du produit. La sync, elle, consomme du stockage et de
 * la bande passante à chaque écriture, et elle va du navigateur à PostgREST en
 * direct — aucun code applicatif ne se trouve sur le chemin. Si la RLS ne la
 * refuse pas, rien ne la refuse, et un compte Licence synchronise gratuitement.
 *
 * Le contre-test est ici la moitié du fichier : des policies qui refuseraient
 * tout passeraient les cas « sans Cloud, c'est non » et casseraient la
 * fonctionnalité vendue en silence.
 *
 * Écrit du point de vue de trois comptes réels — sans achat, Licence seule,
 * Cloud actif — dont seules les sessions `anon` servent aux assertions.
 */
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { anonClient, backendClient, grantCloud, grantLicence, localStack } from './stack.mjs'

const BUCKET = 'assets'

/** Un PNG 1×1 valide : le bucket filtre sur le type déclaré, pas sur le nom. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const stack = localStack()

describe('Porte Cloud sur les écritures', { skip: stack ? false : 'stack arrêté' }, () => {
  const gratuit = anonClient(stack)
  const licence = anonClient(stack)
  const cloud = anonClient(stack)
  const backend = backendClient(stack)

  /** @type {string} */ let gratuitId
  /** @type {string} */ let licenceId
  /** @type {string} */ let cloudId
  /** @type {string} */ let projetDuCloud
  /** @type {string} */ let objetDuCloud

  before(async () => {
    const marque = `${Date.now()}-${process.pid}`
    const inscrire = async (supabase, qui) => {
      const { data, error } = await supabase.auth.signUp({
        email: `gate-${qui}-${marque}@screenforge.test`,
        password: 'motdepasse-de-test',
      })
      assert.equal(error, null, `inscription de ${qui} : ${error?.message}`)
      assert.ok(data.session, `${qui} n'a pas de session après signUp`)
      return data.user.id
    }
    gratuitId = await inscrire(gratuit, 'gratuit')
    licenceId = await inscrire(licence, 'licence')
    cloudId = await inscrire(cloud, 'cloud')

    const achats = await Promise.all([
      grantLicence(backend, licenceId),
      grantCloud(backend, cloudId),
    ])
    for (const { error } of achats) assert.equal(error, null, `octroi : ${error?.message}`)
  })

  after(async () => {
    if (projetDuCloud) await cloud.from('projects').delete().eq('id', projetDuCloud)
    if (objetDuCloud) await cloud.storage.from(BUCKET).remove([objetDuCloud])
    await backend.from('entitlements').delete().in('user_id', [licenceId, cloudId])
    await Promise.all([gratuit.auth.signOut(), licence.auth.signOut(), cloud.auth.signOut()])
  })

  // ─── Ce que le Cloud achète ────────────────────────────────────────────────

  it('un compte Cloud écrit son projet et dépose son image', async () => {
    const { data, error } = await cloud
      .from('projects')
      .insert({ user_id: cloudId, name: 'Projet cloud', data: { screens: [] } })
      .select()
      .single()
    assert.equal(error, null, `insertion Cloud : ${error?.message}`)
    projetDuCloud = data.id

    objetDuCloud = `${cloudId}/${crypto.randomUUID()}`
    const { error: dépôt } = await cloud.storage
      .from(BUCKET)
      .upload(objetDuCloud, PNG_1X1, { contentType: 'image/png' })
    assert.equal(dépôt, null, `dépôt Cloud : ${dépôt?.message}`)
  })

  // ─── Ce qu'il refuse ───────────────────────────────────────────────────────

  it('un compte Licence n’insère pas de projet', async () => {
    const { error } = await licence
      .from('projects')
      .insert({ user_id: licenceId, name: 'Projet sans abonnement', data: {} })
    assert.notEqual(error, null, 'la porte Cloud ne mord pas sur l’INSERT')
  })

  it('un compte sans achat n’insère pas de projet', async () => {
    const { error } = await gratuit
      .from('projects')
      .insert({ user_id: gratuitId, name: 'Projet gratuit', data: {} })
    assert.notEqual(error, null, 'un compte sans ligne de droits a pu écrire')
  })

  it('un compte Licence ne dépose pas d’image', async () => {
    const { error } = await licence.storage
      .from(BUCKET)
      .upload(`${licenceId}/${crypto.randomUUID()}`, PNG_1X1, { contentType: 'image/png' })
    assert.notEqual(error, null, 'la porte Cloud ne mord pas sur le bucket')
  })

  it('un Cloud expiré n’écrit plus', async () => {
    /* La fin de période, telle que Polar la laisse : le statut reste renseigné,
       c'est la date qui a passé. `has_cloud()` doit lire la date, pas le
       statut — sinon un abonnement résilié il y a un an écrirait encore. */
    const { error: expiration } = await backend
      .from('entitlements')
      .update({ cloud_period_end: '2020-01-01T00:00:00Z' })
      .eq('user_id', cloudId)
    assert.equal(expiration, null, `expiration : ${expiration?.message}`)

    const { error } = await cloud
      .from('projects')
      .update({ name: 'Après la période' })
      .eq('id', projetDuCloud)
    assert.notEqual(error, null, 'un abonnement terminé a pu écrire')

    // ─── Et ce qu'une fin de période ne retire pas ───────────────────────────

    /* Critère 9 : la sync s'arrête, rien n'est supprimé. Le titulaire garde la
       lecture de ce qu'il a déposé, et le droit de l'effacer — fermer `select`
       ferait passer une fin d'abonnement pour une perte de données, et fermer
       `delete` retiendrait en otage des fichiers qu'on ne synchronise plus. */
    const { data: lecture, error: erreurLecture } = await cloud
      .from('projects')
      .select('name')
      .eq('id', projetDuCloud)
    assert.equal(erreurLecture, null)
    assert.equal(lecture.length, 1, 'le projet distant est devenu illisible')
    assert.equal(lecture[0].name, 'Projet cloud', 'l’UPDATE refusé est passé quand même')

    const { error: erreurTéléchargement } = await cloud.storage.from(BUCKET).download(objetDuCloud)
    assert.equal(erreurTéléchargement, null, 'l’image déposée est devenue illisible')

    const { data: suppression, error: erreurSuppression } = await cloud
      .from('projects')
      .delete()
      .eq('id', projetDuCloud)
      .select()
    assert.equal(erreurSuppression, null, 'le titulaire ne peut plus effacer ses données')
    assert.equal(suppression.length, 1)
    projetDuCloud = ''
  })

  it('has_cloud() ne lit que sa propre ligne', async () => {
    /* La fonction est `security invoker` : appelée par le compte gratuit, elle
       traverse la policy de `entitlements` et ne voit que la sienne — absente.
       En `definer`, elle deviendrait un moyen de lire les droits d'autrui. */
    const { data, error } = await gratuit.rpc('has_cloud')
    assert.equal(error, null, `appel RPC : ${error?.message}`)
    assert.equal(data, false)
  })
})
