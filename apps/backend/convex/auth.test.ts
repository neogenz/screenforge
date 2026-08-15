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
const TEST_PASSWORD_PROVIDER = 'test-password'

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
    provider: TEST_PASSWORD_PROVIDER,
    params: { email: 'Essai@Screenforge.test', password: PASSWORD, flow: 'signUp' },
  })
  expect(created.tokens?.token).toBeTypeOf('string')

  /* L'adresse est normalisée à l'inscription : sans cela, `Essai@…` et
     `essai@…` seraient deux comptes, et le second ne retrouverait rien. */
  const signedIn = await t.action(api.auth.signIn, {
    provider: TEST_PASSWORD_PROVIDER,
    params: { email: 'essai@screenforge.test', password: PASSWORD, flow: 'signIn' },
  })
  expect(signedIn.tokens?.token).toBeTypeOf('string')
})

test('l’ancien identifiant de provider ne crée plus de session', async () => {
  const t = testConvex()
  await expect(
    t.action(api.auth.signIn, {
      provider: 'password',
      params: { email: 'ancienne@screenforge.test', password: PASSWORD, flow: 'signUp' },
    }),
  ).rejects.toThrow()
  await expect(t.run((ctx) => ctx.db.query('users').collect())).resolves.toHaveLength(0)
})

test.each([
  'personne@example.com',
  'personne@screenforge.test.invalid',
  'personne@fauxscreenforge.test',
  '@screenforge.test',
])('la fixture refuse %s avant toute insertion', async (email) => {
  const t = testConvex()
  await expect(
    t.action(api.auth.signIn, {
      provider: TEST_PASSWORD_PROVIDER,
      params: { email, password: PASSWORD, flow: 'signUp' },
    }),
  ).rejects.toThrow('Adresse réservée aux tests.')
  await expect(t.run((ctx) => ctx.db.query('users').collect())).resolves.toHaveLength(0)
})

test('un mot de passe faux ne connecte pas', async () => {
  const t = testConvex()
  await t.action(api.auth.signIn, {
    provider: TEST_PASSWORD_PROVIDER,
    params: { email: 'essai@screenforge.test', password: PASSWORD, flow: 'signUp' },
  })
  await expect(
    t.action(api.auth.signIn, {
      provider: TEST_PASSWORD_PROVIDER,
      params: { email: 'essai@screenforge.test', password: 'autre-chose', flow: 'signIn' },
    }),
  ).rejects.toThrow()
})

test('cinq mots de passe faux ferment la porte au sixième essai', async () => {
  const t = testConvex()
  const email = 'bourrage@screenforge.test'
  await t.action(api.auth.signIn, {
    provider: TEST_PASSWORD_PROVIDER,
    params: { email, password: PASSWORD, flow: 'signUp' },
  })

  const attempt = (password: string) =>
    t.action(api.auth.signIn, {
      provider: TEST_PASSWORD_PROVIDER,
      params: { email, password, flow: 'signIn' },
    })

  for (let i = 0; i < 5; i++) {
    await expect(attempt(`faux-${i}`)).rejects.toThrow()
  }
  /* Le sixième essai est refusé avec le **bon** mot de passe : c'est ce qui
     distingue un compte fermé d'un secret invalide, et c'est la seule forme du
     test qu'un « tout est refusé » ne peut pas satisfaire par accident.
     C'est `passwordAttempt` qui parle et non la bibliothèque, parce qu'il est
     consulté avant de déléguer — et c'est tant mieux : son `RATE_LIMITED` est
     un `ConvexError` que le client lit, là où la production rédige le
     `TooManyFailedAttempts` de la bibliothèque en « Server Error ». */
  await expect(attempt(PASSWORD)).rejects.toSatisfy(rateLimited)
})

test('quatre échecs ne ferment rien, et un succès efface l’ardoise', async () => {
  const t = testConvex()
  const email = 'presque@screenforge.test'
  await t.action(api.auth.signIn, {
    provider: TEST_PASSWORD_PROVIDER,
    params: { email, password: PASSWORD, flow: 'signUp' },
  })

  const attempt = (password: string) =>
    t.action(api.auth.signIn, {
      provider: TEST_PASSWORD_PROVIDER,
      params: { email, password, flow: 'signIn' },
    })

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

/**
 * La porte de derrière : le même secret, par l'autre flux.
 *
 * `maxFailedAttempsPerHour` n'est câblé par la bibliothèque que sur
 * `flow:'signIn'` et sur les codes — `createAccountFromCredentials.js` n'appelle
 * aucun compteur. Or ce chemin-là, quand l'adresse existe déjà et que le secret
 * correspond, **rend le compte existant** et émet ses jetons : c'est une
 * connexion déguisée en inscription. Sans ce test, la porte que le cas
 * précédent vérifie fermée se rouvrait en changeant un mot dans la requête.
 */
test('l’inscription ne rouvre pas la porte que cinq échecs ont fermée', async () => {
  const t = testConvex()
  const email = 'contournement@screenforge.test'
  await t.action(api.auth.signIn, {
    provider: TEST_PASSWORD_PROVIDER,
    params: { email, password: PASSWORD, flow: 'signUp' },
  })

  const guess = (password: string, flow: 'signIn' | 'signUp') =>
    t.action(api.auth.signIn, {
      provider: TEST_PASSWORD_PROVIDER,
      params: { email, password, flow },
    })

  for (let i = 0; i < 5; i++) {
    await expect(guess(`faux-${i}`, 'signIn')).rejects.toThrow()
  }
  await expect(guess(PASSWORD, 'signIn')).rejects.toThrow()
  await expect(guess(PASSWORD, 'signUp')).rejects.toThrow()
})

test('deviner par inscription se compte comme deviner par connexion', async () => {
  const t = testConvex()
  const email = 'devinette@screenforge.test'
  await t.action(api.auth.signIn, {
    provider: TEST_PASSWORD_PROVIDER,
    params: { email, password: PASSWORD, flow: 'signUp' },
  })

  const guess = (password: string) =>
    t.action(api.auth.signIn, {
      provider: TEST_PASSWORD_PROVIDER,
      params: { email, password, flow: 'signUp' },
    })

  for (let i = 0; i < 5; i++) {
    await expect(guess(`essai-${i}`)).rejects.toThrow()
  }
  /* Le bon mot de passe, refusé, et refusé par le **compteur** : c'est la seule
     forme qu'un « tout est refusé » ne peut pas satisfaire par accident,
     puisque le test suivant exige qu'une connexion ordinaire passe encore. */
  await expect(guess(PASSWORD)).rejects.toSatisfy(rateLimited)
})

test('un succès efface l’ardoise du mot de passe, quel que soit le flux', async () => {
  const t = testConvex()
  const email = 'ardoise@screenforge.test'
  await t.action(api.auth.signIn, {
    provider: TEST_PASSWORD_PROVIDER,
    params: { email, password: PASSWORD, flow: 'signUp' },
  })

  const attempt = (password: string, flow: 'signIn' | 'signUp') =>
    t.action(api.auth.signIn, {
      provider: TEST_PASSWORD_PROVIDER,
      params: { email, password, flow },
    })

  for (let i = 0; i < 4; i++) {
    await expect(attempt(`faux-${i}`, 'signUp')).rejects.toThrow()
  }
  const recovered = await attempt(PASSWORD, 'signIn')
  expect(recovered.tokens?.token).toBeTypeOf('string')

  /* Et l'ardoise est bien remise à zéro, pas seulement le plafond non
     atteint : sans cette seconde salve, un compteur qui ne se viderait jamais
     ferait de chaque compte actif un compte condamné au bout de cinq fautes de
     frappe cumulées sur l'heure. La salve passe par `signUp` et la reprise par
     `signIn` : les deux flux alimentent bien le même compteur. */
  for (let i = 0; i < 4; i++) {
    await expect(attempt(`encore-${i}`, 'signUp')).rejects.toThrow()
  }
  await expect(attempt(PASSWORD, 'signIn')).resolves.toBeDefined()
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

/**
 * Le lien que le courriel transporte, lu comme un navigateur le lirait.
 *
 * L'assertion porte sur `origin` et non sur une sous-chaîne : c'est exactement
 * la propriété en jeu, et c'est la seule forme qu'un préfixe trompeur ne peut
 * pas satisfaire. `new URL('http://localhost:5173@exemple.invalid/').origin`
 * rend `http://exemple.invalid` — le `@` fait du début une identité
 * d'utilisateur, ce qu'une comparaison de chaînes ne voit pas.
 */
function linkIn(text: string): URL {
  const found = /https?:\/\/\S+/.exec(text)
  if (!found) throw new Error(`Aucun lien dans le courriel : ${text}`)
  return new URL(found[0])
}

/**
 * Le cas que le test précédent ne voyait pas, et qui est le seul dangereux.
 *
 * Une destination franchement étrangère ne ressemble à rien et se refusait déjà.
 * Celle qui commence par l'URL du site sans être le site — un domaine qui la
 * prolonge, une identité d'utilisateur suivie d'un `@`, un port plus long —
 * passait une comparaison de préfixe. Et ce que le lien magique transporte est
 * le code de connexion : la destination n'était pas seulement ouverte, elle
 * emportait la session. `signIn` étant une action publique, `redirectTo` est une
 * valeur que n'importe qui pose, pour l'adresse de n'importe qui.
 */
test.each([
  ['un domaine qui prolonge le nôtre', 'http://localhost:5173.exemple.invalid/vol'],
  ['une identité d’utilisateur avant l’hôte réel', 'http://localhost:5173@exemple.invalid/vol'],
  ['un port plus long sur le même hôte', 'http://localhost:51739/vol'],
])('la redirection refuse %s', async (_cas, redirectTo) => {
  const t = testConvex()
  await t.action(api.auth.signIn, {
    provider: 'resend',
    params: { email: 'lien@screenforge.test', redirectTo },
  })
  const link = linkIn((sent[0] as unknown as { text: string }).text)
  expect(link.origin).toBe('http://localhost:5173')
  /* Le code part quand même, mais chez nous : refuser la destination ne doit pas
     casser la connexion de quelqu'un qui n'a rien demandé de tordu. */
  expect(link.searchParams.get('code')).toBeTruthy()
})

/**
 * Le contre-test : un garde qui refuserait tout passerait les trois cas
 * ci-dessus en cassant la connexion pour tout le monde.
 */
test.each([
  ['la racine', 'http://localhost:5173', '/'],
  ['une page', 'http://localhost:5173/editeur', '/editeur'],
  ['une requête', 'http://localhost:5173?depuis=lien', '/'],
  ['un chemin relatif', '/editeur', '/editeur'],
])('la redirection accepte %s', async (_cas, redirectTo, pathname) => {
  const t = testConvex()
  await t.action(api.auth.signIn, {
    provider: 'resend',
    params: { email: 'lien@screenforge.test', redirectTo },
  })
  const link = linkIn((sent[0] as unknown as { text: string }).text)
  expect(link.origin).toBe('http://localhost:5173')
  expect(link.pathname).toBe(pathname)
  expect(link.searchParams.get('code')).toBeTruthy()
})
