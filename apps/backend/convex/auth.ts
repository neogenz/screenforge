import GitHub from '@auth/core/providers/github'
import Google from '@auth/core/providers/google'
import Resend from '@auth/core/providers/resend'
import { Password } from '@convex-dev/auth/providers/Password'
import { convexAuth, type EmailConfig } from '@convex-dev/auth/server'
import type { RunMutationCtx } from '@convex-dev/rate-limiter'
import { consume } from './limits'

/**
 * Qui a le droit d'entrer, et par quelles portes.
 *
 * Quatre, et chacune a sa raison d'être :
 *
 * - **Google et GitHub**, les deux fournisseurs déjà offerts avant la migration.
 *   Les applications OAuth ne changent pas, seule l'URL de rappel change.
 * - **Le lien magique**, pour qui ne veut ni compte tiers ni mot de passe. C'est
 *   la porte que Supabase servait, et la seule qui coûte un expéditeur vérifié.
 * - **Le mot de passe**, qui n'existait pas avant. Il est là parce qu'une suite
 *   automatisée doit pouvoir ouvrir une session : un lien magique arrive par
 *   courrier et un SSO passe par un tiers, donc ni l'un ni l'autre ne se joue
 *   sans intervention humaine. C'est aussi la seule porte qui rend un compte de
 *   test reproductible d'un environnement à l'autre.
 */

/** Le point de départ des liens : le déploiement, jamais l'origine de l'appelant. */
function siteUrl(): string {
  const url = process.env.SITE_URL
  if (!url) throw new Error('SITE_URL is not configured on this deployment.')
  return url
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
 * laquelle le mot de passe et les deux SSO restent ouverts.
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

/**
 * Le mot de passe, sans vérification d'adresse.
 *
 * `verify` n'est pas branché : exiger une confirmation par courriel ferait
 * dépendre cette porte de l'expéditeur, c'est-à-dire exactement de ce dont elle
 * existe pour être indépendante. La contrepartie est explicite — une adresse non
 * vérifiée ne vaut pas identité, donc rien dans l'application ne fait confiance
 * au champ `email` pour autre chose que l'afficher.
 */
const password = Password({
  profile(params) {
    const email = String(params.email ?? '')
      .trim()
      .toLowerCase()
    if (!email.includes('@')) throw new Error('Adresse e-mail invalide.')
    return { email }
  },
})

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [password, magicLink, Google, GitHub],

  /**
   * Le bourrage de mot de passe et de code, borné par la bibliothèque.
   *
   * Écrit explicitement plutôt que laissé au défaut : c'est la seule protection
   * de ce dépôt qui ne vit pas dans `limits.ts`, et un lecteur qui cherche « où
   * sont les compteurs » doit trouver celui-ci aussi. Le compte est tenu par
   * compte utilisateur, décroît d'un à chaque secret refusé, se recharge en
   * continu sur l'heure et est remis à zéro par une connexion réussie — donc
   * cinq échecs ferment la porte, et un seul succès la rouvre entièrement.
   */
  signIn: { maxFailedAttempsPerHour: 5 },

  callbacks: {
    /**
     * Le retour d'authentification atterrit sur l'éditeur, jamais sur la vitrine.
     *
     * C'est de l'éditeur qu'on part, et `landing.html` n'a ni store ni canvas
     * pour accueillir une session. Une destination hors du site est refusée :
     * sans ce contrôle, `redirectTo` serait une redirection ouverte signée par
     * notre propre domaine.
     */
    async redirect({ redirectTo }) {
      const site = siteUrl()
      if (redirectTo.startsWith(site)) return redirectTo
      if (redirectTo.startsWith('/')) return `${site}${redirectTo}`
      return `${site}/`
    },
  },
})
