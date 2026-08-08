/**
 * Le même garde-fou que `rls_projects`, appliqué au bucket des binaires.
 *
 * L'isolation des images ne tient pas à un contrôle applicatif : elle tient au
 * fait que le chemin d'un objet commence par l'identifiant de son propriétaire
 * et que quatre policies comparent ce segment à `auth.uid()`. Une policy
 * manquante ne casserait rien de visible — elle rendrait simplement les
 * captures d'écran d'une app non annoncée lisibles par n'importe quel titulaire
 * de compte. Ce fichier est donc écrit du point de vue de B, muni du chemin
 * exact d'un objet de A.
 *
 * La clé `service_role` n'apparaît que pour poser l'achat des deux comptes —
 * déposer un binaire exige le droit `cloud` — et jamais dans une assertion :
 * le test ne s'accorde aucun privilège de lecture ou d'écriture que le
 * navigateur n'a pas.
 */
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { anonClient, backendClient, grantCloud, localStack } from './stack.mjs'

const BUCKET = 'assets'

/** Un PNG 1×1 valide : le bucket filtre sur le type déclaré, pas sur le nom. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const stack = localStack()

describe(
  'RLS sur le bucket assets',
  { skip: stack ? false : 'stack Supabase local arrêté' },
  () => {
    const alice = anonClient(stack)
    const bob = anonClient(stack)
    const anonyme = anonClient(stack)
    const backend = backendClient(stack)

    /** @type {string} */ let aliceId
    /** @type {string} */ let bobId
    /** @type {string} */ let objetDAlice

    before(async () => {
      const marque = `${Date.now()}-${process.pid}`
      const inscrire = async (supabase, qui) => {
        const { data, error } = await supabase.auth.signUp({
          email: `storage-${qui}-${marque}@screenforge.test`,
          password: 'motdepasse-de-test',
        })
        assert.equal(error, null, `inscription de ${qui} : ${error?.message}`)
        assert.ok(data.session, `${qui} n'a pas de session après signUp`)
        return data.user.id
      }
      aliceId = await inscrire(alice, 'alice')
      bobId = await inscrire(bob, 'bob')

      /* Les deux achètent le Cloud : ce fichier mesure l'isolation entre
         dossiers, pas la porte commerciale — celle-ci a son propre fichier. */
      for (const id of [aliceId, bobId]) {
        const { error } = await grantCloud(backend, id)
        assert.equal(error, null, `octroi du Cloud : ${error?.message}`)
      }

      objetDAlice = `${aliceId}/${crypto.randomUUID()}`
      const { error } = await alice.storage
        .from(BUCKET)
        .upload(objetDAlice, PNG_1X1, { contentType: 'image/png' })
      assert.equal(error, null, `dépôt par Alice : ${error?.message}`)
    })

    after(async () => {
      await alice.storage.from(BUCKET).remove([objetDAlice])
      await backend.from('entitlements').delete().in('user_id', [aliceId, bobId])
      await Promise.all([alice.auth.signOut(), bob.auth.signOut()])
    })

    it('Alice relit son propre objet', async () => {
      const { data, error } = await alice.storage.from(BUCKET).download(objetDAlice)
      assert.equal(error, null)
      assert.equal((await data.arrayBuffer()).byteLength, PNG_1X1.byteLength)
    })

    it('Bob ne télécharge pas l’objet d’Alice, même en donnant son chemin', async () => {
      const { data, error } = await bob.storage.from(BUCKET).download(objetDAlice)
      assert.notEqual(error, null, 'la policy de lecture a laissé passer un téléchargement')
      assert.equal(data, null)
    })

    it('Bob ne liste rien dans le dossier d’Alice', async () => {
      const { data, error } = await bob.storage.from(BUCKET).list(aliceId)
      /* `list` traverse la même policy `select` : elle ne renvoie pas d'erreur,
         elle renvoie zéro ligne. Une seule suffirait à trahir l'existence d'une
         capture, et son nom suffirait à tenter le téléchargement. */
      assert.equal(error, null)
      assert.deepEqual(data, [], 'Bob a vu le contenu du dossier d’Alice')
    })

    it('Bob n’écrit pas dans le dossier d’Alice', async () => {
      const { error } = await bob.storage
        .from(BUCKET)
        .upload(`${aliceId}/${crypto.randomUUID()}`, PNG_1X1, { contentType: 'image/png' })
      assert.notEqual(error, null, 'le `with check` de l’INSERT ne mord pas')
    })

    it('Bob n’écrase pas l’objet d’Alice', async () => {
      const { error } = await bob.storage
        .from(BUCKET)
        .upload(objetDAlice, Buffer.from('remplacé'), { contentType: 'image/png', upsert: true })
      assert.notEqual(error, null, 'la policy d’UPDATE ne mord pas')

      const { data } = await alice.storage.from(BUCKET).download(objetDAlice)
      assert.equal((await data.arrayBuffer()).byteLength, PNG_1X1.byteLength)
    })

    it('Bob ne supprime pas l’objet d’Alice', async () => {
      /* `remove` ne remonte pas d'erreur quand la RLS filtre : il rend la liste
         de ce qui a effectivement été supprimé, donc vide. La preuve est qu'Alice
         relit encore. */
      await bob.storage.from(BUCKET).remove([objetDAlice])
      const { error } = await alice.storage.from(BUCKET).download(objetDAlice)
      assert.equal(error, null, 'l’objet d’Alice a disparu')
    })

    it('Bob dépose bien chez lui', async () => {
      /* Le contre-test : sans lui, quatre policies qui refusent tout passeraient
         les six cas ci-dessus et casseraient la fonctionnalité en silence. */
      const sien = `${bobId}/${crypto.randomUUID()}`
      const { error } = await bob.storage
        .from(BUCKET)
        .upload(sien, PNG_1X1, { contentType: 'image/png' })
      assert.equal(error, null, `dépôt par Bob chez lui : ${error?.message}`)
      await bob.storage.from(BUCKET).remove([sien])
    })

    it('un visiteur sans session ne télécharge rien', async () => {
      const { error } = await anonyme.storage.from(BUCKET).download(objetDAlice)
      assert.notEqual(error, null, 'le bucket répond à un client sans session')
    })
  },
)
