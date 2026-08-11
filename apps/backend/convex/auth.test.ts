import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { api } from './_generated/api'
import { rateLimited, testConvex } from './test.helpers'

/**
 * Ce que la phase 1 doit prouver, et son contre-test à chaque fois.
 *
 * Un compteur qui refuserait tout passerait une suite entière de refus tout en
 * cassant la connexion. Chaque plafond est donc vérifié des deux côtés : ce qui
 * passe en dessous, ce qui casse au-dessus.
 */

const PASSWORD = 'mot-de-passe-de-test'

let sent: { to: string[]; subject: string }[] = []

beforeEach(() => {
  sent = []
  process.env.SITE_URL = 'http://localhost:5173'
  process.env.AUTH_RESEND_KEY = 'test-key'
  process.env.AUTH_EMAIL_FROM = 'ScreenForge <test@screenforge.test>'
  /* Aucun courriel ne part d'une suite de tests. Le double emploi est voulu :
     l'espion sert aussi à compter les envois qui ont réellement eu lieu. */
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    if (!String(url).startsWith('https://api.resend.com/')) {
      throw new Error(`Unexpected outbound request to ${String(url)}.`)
    }
    sent.push(JSON.parse(String(init.body)) as { to: string[]; subject: string })
    return Promise.resolve(new Response('{"id":"test"}', { status: 200 }))
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('un compte se crée par mot de passe, puis se reconnecte', async () => {
  const t = testConvex()
  const created = await t.action(api.auth.signIn, {
    provider: 'password',
    params: { email: 'Essai@Screenforge.test', password: PASSWORD, flow: 'signUp' },
  })
  expect(created.tokens?.token).toBeTypeOf('string')

  /* L'adresse est normalisée à l'inscription : sans cela, `Essai@…` et
     `essai@…` seraient deux comptes, et le second ne retrouverait rien. */
  const signedIn = await t.action(api.auth.signIn, {
    provider: 'password',
    params: { email: 'essai@screenforge.test', password: PASSWORD, flow: 'signIn' },
  })
  expect(signedIn.tokens?.token).toBeTypeOf('string')
})

test('un mot de passe faux ne connecte pas', async () => {
  const t = testConvex()
  await t.action(api.auth.signIn, {
    provider: 'password',
    params: { email: 'essai@screenforge.test', password: PASSWORD, flow: 'signUp' },
  })
  await expect(
    t.action(api.auth.signIn, {
      provider: 'password',
      params: { email: 'essai@screenforge.test', password: 'autre-chose', flow: 'signIn' },
    }),
  ).rejects.toThrow()
})

test('cinq mots de passe faux ferment la porte au sixième essai', async () => {
  const t = testConvex()
  const email = 'bourrage@screenforge.test'
  await t.action(api.auth.signIn, {
    provider: 'password',
    params: { email, password: PASSWORD, flow: 'signUp' },
  })

  const attempt = (password: string) =>
    t.action(api.auth.signIn, { provider: 'password', params: { email, password, flow: 'signIn' } })

  for (let i = 0; i < 5; i++) {
    await expect(attempt(`faux-${i}`)).rejects.toThrow()
  }
  /* Le sixième essai est refusé avec le **bon** mot de passe : c'est ce qui
     distingue un compte fermé d'un secret invalide, et c'est la seule forme du
     test qu'un « tout est refusé » ne peut pas satisfaire par accident. */
  await expect(attempt(PASSWORD)).rejects.toThrow('TooManyFailedAttempts')
})

test('quatre échecs ne ferment rien, et un succès efface l’ardoise', async () => {
  const t = testConvex()
  const email = 'presque@screenforge.test'
  await t.action(api.auth.signIn, {
    provider: 'password',
    params: { email, password: PASSWORD, flow: 'signUp' },
  })

  const attempt = (password: string) =>
    t.action(api.auth.signIn, { provider: 'password', params: { email, password, flow: 'signIn' } })

  for (let i = 0; i < 4; i++) {
    await expect(attempt(`faux-${i}`)).rejects.toThrow()
  }
  const recovered = await attempt(PASSWORD)
  expect(recovered.tokens?.token).toBeTypeOf('string')

  /* Et l'ardoise est bien effacée, pas seulement le plafond non atteint : sans
     cette seconde salve, un compteur qui ne se remettrait jamais à zéro
     passerait ce test alors qu'il ferait de tout compte actif un compte
     condamné au bout de cinq fautes de frappe cumulées. */
  for (let i = 0; i < 4; i++) {
    await expect(attempt(`encore-${i}`)).rejects.toThrow()
  }
  await expect(attempt(PASSWORD)).resolves.toBeDefined()
})

test('trois liens magiques partent, le quatrième est refusé', async () => {
  const t = testConvex()
  const send = () =>
    t.action(api.auth.signIn, { provider: 'resend', params: { email: 'lien@screenforge.test' } })

  await send()
  await send()
  await send()
  expect(sent).toHaveLength(3)

  await expect(send()).rejects.toSatisfy(rateLimited)
  /* Le contre-test du contre-test : le refus a lieu avant l'appel à Resend, pas
     après. Un compteur posé derrière l'envoi bornerait le message d'erreur et
     rien d'autre. */
  expect(sent).toHaveLength(3)
})

test('le plafond porte sur une adresse, pas sur le service', async () => {
  const t = testConvex()
  const send = (email: string) =>
    t.action(api.auth.signIn, { provider: 'resend', params: { email } })

  await send('une@screenforge.test')
  await send('une@screenforge.test')
  await send('une@screenforge.test')
  /* Une seconde adresse passe alors que la première est épuisée : sans ce cas,
     un compteur global déguisé en compteur par adresse passerait le test
     précédent. */
  await expect(send('autre@screenforge.test')).resolves.toBeDefined()
  expect(sent).toHaveLength(4)
})

test('un lien magique envoyé porte l’URL du site, pas celle du déploiement', async () => {
  const t = testConvex()
  await t.action(api.auth.signIn, {
    provider: 'resend',
    params: { email: 'lien@screenforge.test' },
  })
  const body = sent[0] as unknown as { text: string }
  expect(body.text).toContain('http://localhost:5173')
})

test('la redirection reste sur le site, même demandée ailleurs', async () => {
  const t = testConvex()
  await t.action(api.auth.signIn, {
    provider: 'resend',
    params: { email: 'lien@screenforge.test', redirectTo: 'https://exemple.invalid/vol' },
  })
  const body = sent[0] as unknown as { text: string }
  expect(body.text).not.toContain('exemple.invalid')
  expect(body.text).toContain('http://localhost:5173')
})
