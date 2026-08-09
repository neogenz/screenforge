/**
 * Le seul garde-fou que la CI peut opposer à un trou de sécurité silencieux.
 *
 * Une policy RLS absente ne casse rien : l'application continue de fonctionner,
 * en plus permissif. Rien dans le typage, le lint ou les tests d'interface ne
 * le verrait. Ce fichier est donc écrit du point de vue de l'attaquant — un
 * utilisateur B authentifié, muni de l'`id` d'une ligne de A — et il échoue si
 * B obtient quoi que ce soit.
 *
 * La clé `service_role` n'apparaît que pour poser l'achat des deux comptes,
 * parce que l'écriture d'un projet exige désormais le droit `cloud` et que
 * c'est là le geste exact du webhook Polar. Aucune assertion ne passe par elle :
 * le test ne s'accorde jamais un privilège de lecture ou d'écriture que le
 * navigateur n'a pas, sans quoi il mesurerait autre chose que ce qui est
 * exposé. Les comptes naissent par `signUp`, comme ceux des vrais visiteurs
 * (le stack local a `enable_confirmations = false`).
 *
 * Se saute proprement si le stack local n'est pas démarré : `pnpm test` doit
 * rester exécutable sans Docker.
 */
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { anonClient, backendClient, grantCloud, localStack } from './stack.mjs'

const stack = localStack()

describe('RLS sur public.projects', { skip: stack ? false : 'stack Supabase local arrêté' }, () => {
  const alice = anonClient(stack)
  const bob = anonClient(stack)
  const anonyme = anonClient(stack)
  const backend = backendClient(stack)

  /** @type {string} */ let aliceId
  /** @type {string} */ let bobId
  /** @type {string} */ let projetDAlice

  before(async () => {
    /* Des adresses uniques par exécution : le stack local n'est pas remis à
       zéro entre deux passes, et un `signUp` sur une adresse déjà prise
       renverrait un utilisateur sans session. */
    const marque = `${Date.now()}-${process.pid}`
    const inscrire = async (supabase, qui) => {
      const { data, error } = await supabase.auth.signUp({
        email: `${qui}-${marque}@screenforge.test`,
        password: 'motdepasse-de-test',
      })
      assert.equal(error, null, `inscription de ${qui} : ${error?.message}`)
      assert.ok(data.session, `${qui} n'a pas de session après signUp`)
      return data.user.id
    }
    aliceId = await inscrire(alice, 'alice')
    bobId = await inscrire(bob, 'bob')

    /* Les deux achètent le Cloud : ce fichier mesure l'isolation entre comptes,
       pas la porte commerciale — celle-ci a son propre fichier. Sans cet achat,
       chaque écriture échouerait pour la mauvaise raison. */
    for (const id of [aliceId, bobId]) {
      const { error } = await grantCloud(backend, id)
      assert.equal(error, null, `octroi du Cloud : ${error?.message}`)
    }

    const { data, error } = await alice
      .from('projects')
      .insert({ user_id: aliceId, name: 'Projet d’Alice', data: { screens: [] } })
      .select()
      .single()
    assert.equal(error, null, `insertion par Alice : ${error?.message}`)
    projetDAlice = data.id
  })

  after(async () => {
    await alice.from('projects').delete().eq('id', projetDAlice)
    await backend.from('entitlements').delete().in('user_id', [aliceId, bobId])
    await Promise.all([alice.auth.signOut(), bob.auth.signOut()])
  })

  it('Alice lit sa propre ligne', async () => {
    const { data, error } = await alice.from('projects').select().eq('id', projetDAlice)
    assert.equal(error, null)
    assert.equal(data.length, 1)
  })

  it('Bob ne lit pas la ligne d’Alice, même en la nommant par son id', async () => {
    const { data, error } = await bob.from('projects').select().eq('id', projetDAlice)
    assert.equal(error, null)
    assert.deepEqual(data, [])
  })

  it('Bob ne modifie pas la ligne d’Alice', async () => {
    const { data, error } = await bob
      .from('projects')
      .update({ name: 'volé' })
      .eq('id', projetDAlice)
      .select()
    assert.equal(error, null)
    assert.deepEqual(data, [], 'la RLS a laissé passer un UPDATE')

    const { data: apres } = await alice.from('projects').select('name').eq('id', projetDAlice)
    assert.equal(apres[0].name, 'Projet d’Alice')
  })

  it('Bob ne supprime pas la ligne d’Alice', async () => {
    const { data, error } = await bob.from('projects').delete().eq('id', projetDAlice).select()
    assert.equal(error, null)
    assert.deepEqual(data, [], 'la RLS a laissé passer un DELETE')

    const { data: apres } = await alice.from('projects').select('id').eq('id', projetDAlice)
    assert.equal(apres.length, 1, 'la ligne d’Alice a disparu')
  })

  it('Bob n’écrit pas une ligne au nom d’Alice', async () => {
    const { error } = await bob
      .from('projects')
      .insert({ user_id: aliceId, name: 'cheval de Troie', data: {} })
    assert.notEqual(error, null, 'le `with check` de l’INSERT ne mord pas')
  })

  it('Alice ne cède pas sa ligne à Bob', async () => {
    /* Sans `with check` sur l'UPDATE, cette écriture passerait : Alice satisfait
       le `using` sur la ligne d'origine, et personne ne relirait la ligne après
       modification. Elle se déposséderait au profit de Bob. */
    const { error } = await alice.from('projects').update({ user_id: bobId }).eq('id', projetDAlice)
    assert.notEqual(error, null, 'le `with check` de l’UPDATE ne mord pas')
  })

  it('l’écriture atomique garde la version la plus récente et son propriétaire', async () => {
    const newer = '2099-08-09T12:00:00Z'
    const older = '2099-08-09T11:00:00Z'
    const args = (userId, name, updatedAt) => ({
      project_id: projetDAlice,
      project_user_id: userId,
      project_name: name,
      project_data: { revision: name },
      project_updated_at: updatedAt,
    })

    const latest = await alice.rpc('upsert_project_lww', args(aliceId, 'Version récente', newer))
    assert.equal(latest.error, null, `écriture récente : ${latest.error?.message}`)
    assert.equal(latest.data, true)

    const stale = await alice.rpc('upsert_project_lww', args(aliceId, 'Version ancienne', older))
    assert.equal(stale.error, null, `écriture ancienne : ${stale.error?.message}`)
    assert.equal(stale.data, false)

    const theft = await bob.rpc(
      'upsert_project_lww',
      args(bobId, 'Version volée', '2099-08-09T13:00:00Z'),
    )
    assert.ok(theft.error !== null || theft.data === false, 'Bob a réécrit la ligne d’Alice')

    const { data, error } = await alice.from('projects').select('name, data').eq('id', projetDAlice)
    assert.equal(error, null)
    assert.deepEqual(data, [{ name: 'Version récente', data: { revision: 'Version récente' } }])
  })

  it('un visiteur sans session ne voit rien', async () => {
    const { data, error } = await anonyme.from('projects').select()
    /* Le rôle `anon` n'a aucun GRANT : PostgREST répond une erreur de
       permission. Une liste vide serait acceptable aussi — ce qui ne l'est
       pas, c'est une ligne. */
    assert.ok(error !== null || data.length === 0, 'le rôle anon a lu des lignes')

    const rpc = await anonyme.rpc('upsert_project_lww', {
      project_id: projetDAlice,
      project_user_id: aliceId,
      project_name: 'anonyme',
      project_data: {},
      project_updated_at: '2099-08-09T14:00:00Z',
    })
    assert.notEqual(rpc.error, null, 'le rôle anon peut exécuter la fonction')
  })
})
