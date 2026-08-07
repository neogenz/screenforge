/**
 * Le seul garde-fou que la CI peut opposer à un trou de sécurité silencieux.
 *
 * Une policy RLS absente ne casse rien : l'application continue de fonctionner,
 * en plus permissif. Rien dans le typage, le lint ou les tests d'interface ne
 * le verrait. Ce fichier est donc écrit du point de vue de l'attaquant — un
 * utilisateur B authentifié, muni de l'`id` d'une ligne de A — et il échoue si
 * B obtient quoi que ce soit.
 *
 * Aucune clé `service_role` ici : le test ne s'accorde jamais un privilège que
 * le navigateur n'a pas, sans quoi il mesurerait autre chose que ce qui est
 * exposé. Les comptes naissent par `signUp`, comme ceux des vrais visiteurs
 * (le stack local a `enable_confirmations = false`).
 *
 * Se saute proprement si le stack local n'est pas démarré : `pnpm test` doit
 * rester exécutable sans Docker.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { after, before, describe, it } from 'node:test'
import { createClient } from '@supabase/supabase-js'

/**
 * @returns {{ url: string, anonKey: string } | null}
 */
function localStack() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    return { url: process.env.SUPABASE_URL, anonKey: process.env.SUPABASE_ANON_KEY }
  }
  try {
    /* `supabase status` échoue vite et fort quand rien ne tourne : c'est le
       signal de saut, et il est plus fiable qu'un ping sur un port qu'un autre
       projet Supabase pourrait très bien occuper. */
    const raw = execFileSync('supabase', ['status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const status = JSON.parse(raw)
    return { url: status.API_URL, anonKey: status.ANON_KEY }
  } catch {
    return null
  }
}

const stack = localStack()

describe('RLS sur public.projects', { skip: stack ? false : 'stack Supabase local arrêté' }, () => {
  /** Un client par identité, chacun avec sa propre session. */
  const client = () =>
    createClient(stack.url, stack.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

  const alice = client()
  const bob = client()
  const anonyme = client()

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

  it('un visiteur sans session ne voit rien', async () => {
    const { data, error } = await anonyme.from('projects').select()
    /* Le rôle `anon` n'a aucun GRANT : PostgREST répond une erreur de
       permission. Une liste vide serait acceptable aussi — ce qui ne l'est
       pas, c'est une ligne. */
    assert.ok(error !== null || data.length === 0, 'le rôle anon a lu des lignes')
  })
})
