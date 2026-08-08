/**
 * Le miroir des droits, vu depuis le navigateur.
 *
 * `entitlements` est la seule table du projet que son titulaire ne peut pas
 * écrire : un droit qu'on s'accorde soi-même n'est pas un droit. Une policy
 * d'écriture ajoutée par mégarde ne casserait rien de visible — elle
 * offrirait la Licence à qui sait ouvrir la console. Ce fichier échoue si
 * l'une d'elles apparaît.
 *
 * La clé `service_role` n'est utilisée que pour poser la ligne d'Alice, parce
 * que c'est exactement ce que fait le backend au webhook et qu'aucun client
 * anon ne le peut. Toutes les assertions, elles, passent par la clé `anon`,
 * comme un vrai visiteur.
 *
 * Se saute proprement si le stack local n'est pas démarré.
 */
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { anonClient, backendClient, localStack } from './stack.mjs'

const stack = localStack()

describe(
  'RLS sur public.entitlements',
  { skip: stack ? false : 'stack Supabase local arrêté' },
  () => {
    const alice = anonClient(stack)
    const bob = anonClient(stack)
    const anonyme = anonClient(stack)
    const backend = backendClient(stack)

    /** @type {string} */ let aliceId
    /** @type {string} */ let bobId

    before(async () => {
      const marque = `${Date.now()}-${process.pid}`
      const inscrire = async (supabase, qui) => {
        const { data, error } = await supabase.auth.signUp({
          email: `ent-${qui}-${marque}@screenforge.test`,
          password: 'motdepasse-de-test',
        })
        assert.equal(error, null, `inscription de ${qui} : ${error?.message}`)
        assert.ok(data.session, `${qui} n'a pas de session après signUp`)
        return data.user.id
      }
      aliceId = await inscrire(alice, 'alice')
      bobId = await inscrire(bob, 'bob')

      const { error } = await backend.from('entitlements').insert({
        user_id: aliceId,
        polar_customer_id: 'cus_alice',
        licence_granted_at: '2026-03-12T09:00:00Z',
      })
      assert.equal(error, null, `écriture backend : ${error?.message}`)
    })

    after(async () => {
      await backend.from('entitlements').delete().in('user_id', [aliceId, bobId])
      await Promise.all([alice.auth.signOut(), bob.auth.signOut()])
    })

    it('Alice lit ses propres droits', async () => {
      const { data, error } = await alice.from('entitlements').select()
      assert.equal(error, null)
      assert.equal(data.length, 1)
      assert.equal(data[0].licence_granted_at !== null, true)
    })

    it('Bob ne lit pas les droits d’Alice', async () => {
      const { data, error } = await bob.from('entitlements').select().eq('user_id', aliceId)
      assert.equal(error, null)
      assert.deepEqual(data, [])
    })

    it('Bob ne s’accorde pas une licence', async () => {
      const { error } = await bob
        .from('entitlements')
        .insert({ user_id: bobId, polar_customer_id: 'cus_bob', licence_granted_at: 'now()' })
      assert.notEqual(error, null, 'un utilisateur authentifié a pu insérer un droit')
    })

    it('Alice ne se prolonge pas le Cloud', async () => {
      const { data, error } = await alice
        .from('entitlements')
        .update({ cloud_status: 'active', cloud_period_end: '2099-01-01T00:00:00Z' })
        .eq('user_id', aliceId)
        .select()
      /* Sans policy `update`, PostgREST peut répondre soit une erreur de
         permission, soit zéro ligne touchée. Ce qui n'est pas acceptable, c'est
         que la ligne bouge. */
      assert.ok(error !== null || data.length === 0, 'un UPDATE est passé')

      const { data: apres } = await backend
        .from('entitlements')
        .select('cloud_status')
        .eq('user_id', aliceId)
      assert.equal(apres[0].cloud_status, null, 'le Cloud s’est accordé tout seul')
    })

    it('Alice ne supprime pas sa ligne pour repartir à zéro', async () => {
      const { data, error } = await alice
        .from('entitlements')
        .delete()
        .eq('user_id', aliceId)
        .select()
      assert.ok(error !== null || data.length === 0, 'un DELETE est passé')

      const { data: apres } = await backend
        .from('entitlements')
        .select('user_id')
        .eq('user_id', aliceId)
      assert.equal(apres.length, 1, 'la ligne d’Alice a disparu')
    })

    it('un visiteur sans session ne voit rien', async () => {
      const { data, error } = await anonyme.from('entitlements').select()
      assert.ok(error !== null || data.length === 0, 'le rôle anon a lu des lignes')
    })
  },
)
