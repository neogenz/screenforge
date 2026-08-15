import GitHub from '@auth/core/providers/github'
import Google from '@auth/core/providers/google'
import Resend from '@auth/core/providers/resend'
import { Password } from '@convex-dev/auth/providers/Password'
import { convexAuth, type EmailConfig } from '@convex-dev/auth/server'
import type { RunMutationCtx } from '@convex-dev/rate-limiter'
import { clear, consume, normalizeEmail, PASSWORD_ATTEMPTS_PER_HOUR } from './limits'

/**
 * Qui a le droit d'entrer, et par quelles portes.
 *
 * Trois portes utilisateur, plus une fixture invisible :
 *
 * - **Google et GitHub**, les deux fournisseurs déjà offerts avant la migration.
 *   Les applications OAuth ne changent pas, seule l'URL de rappel change.
 * - **Le lien magique**, pour qui ne veut ni compte tiers ni mot de passe. La
 *   seule des quatre qui coûte un expéditeur vérifié.
 * - **`test-password`**, réservé aux adresses `@screenforge.test`. Il ouvre une
 *   session automatisable sans devenir une identité proposée dans le produit.
 */

/**
 * Le point de départ des liens : le déploiement, jamais l'origine de l'appelant.
 *
 * La barre finale est retirée comme la bibliothèque le fait : sans cela,
 * `SITE_URL` écrit avec une barre produirait `https://site//editeur`, et surtout
 * la comparaison de préfixe ci-dessous ne tomberait pas sur le même caractère.
 */
function siteUrl(): string {
  const url = process.env.SITE_URL
  if (!url) throw new Error('SITE_URL is not configured on this deployment.')
  return url.replace(/\/$/, '')
}

/**
 * Où le retour d'authentification a le droit d'atterrir.
 *
 * **Un préfixe ne suffit pas, et c'est tout l'objet de cette fonction.**
 * `SITE_URL` vaut `https://screenforge.app` ; `https://screenforge.app.exemple`
 * commence par cette chaîne sans être ce domaine, et `https://screenforge.app@x`
 * non plus — l'`@` fait du début une identité d'utilisateur et de `x` l'hôte
 * réel. Il faut donc regarder le caractère qui suit le préfixe : une fin de
 * chaîne, une barre ou un point d'interrogation ferment le nom d'hôte, tout le
 * reste le prolonge.
 *
 * Ce que la destination transporte le dit assez : Convex Auth y accroche le
 * `code` de connexion — `Location: setURLSearchParam(destinationUrl, 'code', …)`
 * au retour OAuth, et la même URL dans le corps du courriel de lien magique. Une
 * destination hors du site n'est donc pas seulement une redirection ouverte,
 * c'est le code de session livré à qui l'a demandée. Et il se demande depuis le
 * dehors : `signIn` est une action publique, donc `redirectTo` est une valeur
 * d'attaquant, jamais une valeur de notre client.
 *
 * C'est exactement le contrôle que fait le rappel par défaut de la bibliothèque
 * ([`redirects.js`](../../../node_modules/@convex-dev/auth/dist/server/implementation/redirects.js)).
 * Le redéfinir sans lui l'avait retiré. Il est réécrit ici plutôt que délégué
 * parce qu'un rappel `redirect` reste nécessaire : le défaut lève sur une
 * destination refusée, là où on préfère ramener à l'éditeur.
 */
export function safeRedirect(redirectTo: string, site: string): string {
  /* Un chemin relatif est toujours sur le site : il est concaténé, pas comparé.
     `//exemple.com` y compris, qui devient un chemin de notre hôte. */
  if (redirectTo.startsWith('/')) return `${site}${redirectTo}`
  if (redirectTo.startsWith(site)) {
    const after = redirectTo[site.length]
    if (after === undefined || after === '/' || after === '?') return redirectTo
  }
  return `${site}/`
}

/**
 * Le courriel de lien magique, envoyé par Resend.
 *
 * Deux compteurs avant l'envoi, jamais après : le composant compte dans la
 * transaction de l'appelant, donc un envoi qui échoue rend son jeton.
 *
 * **Par adresse** protège le titulaire d'une boîte contre l'inondation.
 * **Globalement** protège la réputation du domaine expéditeur contre un balayage
 * d'adresses — la clé qu'on voudrait là est l'IP, et une fonction Convex ne la
 * connaît pas : seule une `httpAction` reçoit des en-têtes, or `signIn` est une
 * action ordinaire. Le plafond global est donc la mesure réellement disponible,
 * et il est posé assez haut pour qu'un usage normal ne le touche jamais. Le prix
 * assumé : un balayage peut fermer le lien magique pour une heure, pendant
 * laquelle les deux SSO restent ouverts.
 */
async function sendMagicLink(
  { identifier: email, url, provider }: SendParams,
  ctx: RunMutationCtx,
): Promise<void> {
  await consume(ctx, 'magicLinkSendGlobal')
  await consume(ctx, 'magicLinkSend', email.toLowerCase())

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: provider.from,
      to: [email],
      subject: 'Votre lien de connexion ScreenForge',
      text: `Ouvrez ce lien depuis ce navigateur pour vous connecter :\n\n${url}\n\nIl expire dans une heure. Si vous n’avez rien demandé, ignorez ce message.`,
    }),
  })
  if (!response.ok) {
    throw new Error(`Resend refused the sign-in email: ${await response.text()}`)
  }
}

interface SendParams {
  identifier: string
  url: string
  provider: { apiKey?: string; from?: string }
}

const magicLink = Resend({
  id: 'resend',
  apiKey: process.env.AUTH_RESEND_KEY,
  from: process.env.AUTH_EMAIL_FROM ?? 'ScreenForge <onboarding@resend.dev>',
  /*
   * La conversion est celle que la bibliothèque fait elle-même.
   *
   * `sendVerificationRequest` porte la signature d'Auth.js, qui ne prévoit qu'un
   * paramètre ; Convex Auth en passe un second — le contexte — et le marque d'un
   * `@ts-expect-error` dans son propre code. Sans ce contexte, aucun compteur ne
   * pourrait s'exécuter ici, et l'envoi de courriels serait la seule surface non
   * bornée du déploiement.
   */
  sendVerificationRequest: sendMagicLink as unknown as EmailConfig['sendVerificationRequest'],
})

/** L'adresse telle que le fournisseur la stocke : c'est elle qui sert de clé. */
function normalizedEmail(params: Record<string, unknown>): string {
  return normalizeEmail(String(params.email ?? ''))
}

/**
 * Le mot de passe de fixture, sans vérification d'adresse.
 *
 * `verify` n'est pas branché : exiger une confirmation par courriel ferait
 * dépendre cette porte de l'expéditeur, c'est-à-dire exactement de ce dont la
 * suite automatisée doit être indépendante. Elle ne reconnaît que le domaine
 * réservé aux exemples : aucune adresse réelle ne peut entrer par cette voie.
 */
const FIXTURE_EMAIL_SUFFIX = '@screenforge.test'

const baseTestPassword = Password({
  id: 'test-password',
  profile(params) {
    const email = normalizedEmail(params)
    if (email.length <= FIXTURE_EMAIL_SUFFIX.length || !email.endsWith(FIXTURE_EMAIL_SUFFIX)) {
      throw new Error('Adresse réservée aux tests.')
    }
    return { email }
  },
})

/**
 * L'implémentation réelle du fournisseur, et le seul endroit où l'envelopper.
 *
 * `ConvexCredentials` rend `{ id, type, authorize: async () => null, options }`
 * et met la vraie logique dans `options` ; `providerDefaults` fait ensuite
 * `merge(provider, provider.options)`, où la source écrase la cible. Remplacer
 * `authorize` à la racine serait donc silencieusement défait à la
 * matérialisation — c'est `options.authorize` qui compte, et lui seul.
 */
type CredentialsAuthorize = (
  params: Record<string, unknown>,
  ctx: RunMutationCtx,
) => Promise<{ userId: string; sessionId?: string } | null>

const materialized = baseTestPassword as unknown as { options: { authorize: CredentialsAuthorize } }
const attempt = materialized.options.authorize

/**
 * Compter les essais, puisque la bibliothèque n'en compte qu'une moitié.
 *
 * `maxFailedAttempsPerHour` ne s'applique qu'à `flow:'signIn'`. Or `signUp` sur
 * une adresse qui existe déjà n'échoue pas : `createAccountFromCredentials`
 * vérifie le secret et, s'il correspond, **rend le compte existant**, dont
 * `signIn` émet aussitôt les jetons — une connexion, par un chemin que rien ne
 * comptait. La porte fermée après cinq échecs se rouvrait donc en changeant un
 * mot dans la requête, et `signIn` est une action publique : l'URL du
 * déploiement est dans le paquet servi, il n'y a ni session ni client à avoir.
 *
 * Le compteur est pris **avant** de déléguer, pour qu'un essai refusé ne coûte
 * pas le Scrypt qu'il demandait, et remis à zéro après un succès, pour que seuls
 * les échecs consécutifs s'accumulent. Le plafond d'inscription est global et
 * pris en plus, parce que c'est le seul qui morde sur un balayage d'adresses.
 */
const testPassword = {
  ...baseTestPassword,
  options: {
    ...materialized.options,
    authorize: async (params: Record<string, unknown>, ctx: RunMutationCtx) => {
      const email = normalizedEmail(params)
      if (params.flow === 'signUp') await consume(ctx, 'passwordSignUpGlobal')
      await consume(ctx, 'passwordAttempt', email)
      const result = await attempt(params, ctx)
      await clear(ctx, 'passwordAttempt', email)
      return result
    },
  },
} as unknown as typeof baseTestPassword

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [testPassword, magicLink, Google, GitHub],

  /**
   * Le bourrage de code, borné par la bibliothèque — et la moitié du mot de
   * passe.
   *
   * Le compte est tenu par compte utilisateur, décroît d'un à chaque secret
   * refusé, se recharge en continu sur l'heure et est remis à zéro par une
   * connexion réussie. Il reste posé parce qu'il couvre la vérification d'un
   * code, que `passwordAttempt` ne voit pas ; sur le mot de passe il ne voit que
   * `flow:'signIn'`, et c'est l'enveloppe ci-dessus qui ferme l'autre moitié. Le
   * nombre vient de `limits.ts` pour que les deux ne puissent pas diverger : le
   * plus permissif des deux déciderait.
   */
  signIn: { maxFailedAttempsPerHour: PASSWORD_ATTEMPTS_PER_HOUR },

  callbacks: {
    /**
     * Le retour d'authentification atterrit sur l'éditeur, jamais sur la vitrine.
     *
     * C'est de l'éditeur qu'on part, et `landing.html` n'a ni store ni canvas
     * pour accueillir une session. Une destination hors du site est ramenée à la
     * racine plutôt que refusée par une exception : l'utilisateur arrive quelque
     * part, et le code de connexion reste sur notre domaine. `safeRedirect` dit
     * ce que « hors du site » veut dire exactement.
     */
    redirect({ redirectTo }) {
      return Promise.resolve(safeRedirect(redirectTo, siteUrl()))
    },
  },
})
