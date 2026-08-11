import { useState, type FormEvent } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  signInWithEmail,
  signInWithPassword,
  signInWithProvider,
  type OAuthProvider,
} from '@/lib/auth'
import { toast } from '@/stores/toast.store'
import { useUIStore } from '@/stores/ui.store'

const EMAIL_FIELD_ID = 'sf-auth-email'
const PASSWORD_FIELD_ID = 'sf-auth-password'

/**
 * Aucune marque n'entre ici.
 *
 * Les boutons OAuth portent leur nom et rien d'autre : le bleu Google et le
 * noir GitHub seraient les deux premières couleurs de marque de la chrome d'un
 * outil qui juge des couleurs, et Lucide — le vocabulaire d'icônes du projet —
 * n'a pas ces glyphes. Poser un SVG de marque en ligne pour les obtenir serait
 * exactement ce que la règle « chroma 0 sur la chrome » refuse. Le libellé
 * suffit à reconnaître le fournisseur.
 */
const PROVIDERS: { id: OAuthProvider; label: string }[] = [
  { id: 'google', label: 'Continuer avec Google' },
  { id: 'github', label: 'Continuer avec GitHub' },
]

export function AuthDialog() {
  const showAuthDialog = useUIStore((s) => s.showAuthDialog)

  if (!showAuthDialog) return null
  return <AuthDialogContent />
}

function AuthDialogContent() {
  const setShowAuthDialog = useUIStore((s) => s.setShowAuthDialog)
  const [email, setEmail] = useState('')
  /**
   * Quelle piste est en cours, plutôt qu'un booléen : trois chemins partagent
   * cette dialog, et un `loading` global mettrait un spinner sur les trois
   * boutons pour une seule attente.
   */
  const [pending, setPending] = useState<OAuthProvider | 'email' | 'password' | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  /**
   * Le mot de passe est replié par défaut, et c'est un choix d'offre.
   *
   * Trois portes visibles d'un coup ne disent pas laquelle prendre. Le lien
   * magique reste la voie mise en avant — rien à retenir, rien à perdre — et le
   * mot de passe est là pour qui en veut un, ainsi que pour les suites
   * automatisées, qui ne savent pas relever un courrier.
   */
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  function handleClose() {
    setShowAuthDialog(false)
  }

  async function handleProvider(provider: OAuthProvider) {
    setPending(provider)
    const { error } = await signInWithProvider(provider)
    /* Le succès ne repasse pas ici : l'appel quitte la page. Seul l'échec
       revient, et il faut alors rendre le bouton à l'utilisateur. */
    if (error) {
      toast(error.message, 'error')
      setPending(null)
    }
  }

  async function handleEmail(event: FormEvent) {
    event.preventDefault()
    const address = email.trim()
    if (!address) return
    setPending('email')
    const { error } = await signInWithEmail(address)
    setPending(null)
    if (error) {
      toast(error.message, 'error')
      return
    }
    setSentTo(address)
  }

  /**
   * Une seule soumission pour deux directions.
   *
   * On tente la connexion, et l'inscription seulement si elle échoue : demander
   * d'abord « avez-vous un compte ? » ferait choisir à l'utilisateur une chose
   * que le serveur sait déjà, et se tromper de case donnerait une erreur pour
   * une bonne adresse et un bon mot de passe.
   */
  async function handlePassword(event: FormEvent) {
    event.preventDefault()
    const address = email.trim()
    if (!address || !password) return
    setPending('password')
    const attempt = await signInWithPassword(address, password, 'signIn')
    const { error } = attempt.error
      ? await signInWithPassword(address, password, 'signUp')
      : attempt
    setPending(null)
    if (error) {
      toast(error.message, 'error')
      return
    }
    setShowAuthDialog(false)
  }

  return (
    <Dialog open onClose={handleClose} title="Connexion à ScreenForge" size="sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {PROVIDERS.map((provider, index) => (
            <Button
              key={provider.id}
              variant="default"
              className="w-full"
              data-autofocus={index === 0 || undefined}
              loading={pending === provider.id}
              disabled={pending !== null}
              onClick={() => void handleProvider(provider.id)}
            >
              {provider.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div aria-hidden className="hairline flex-1" />
          <span className="field-label">ou</span>
          <div aria-hidden className="hairline flex-1" />
        </div>

        {/* Un vrai `form` : la touche Entrée dans le champ doit envoyer le lien,
            et c'est le navigateur qui le fait gratuitement. */}
        <form className="flex flex-col gap-2" onSubmit={(event) => void handleEmail(event)}>
          <Field id={EMAIL_FIELD_ID} label="Adresse e-mail">
            <Input
              id={EMAIL_FIELD_ID}
              type="email"
              font="sans"
              autoComplete="email"
              placeholder="vous@exemple.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                setSentTo(null)
              }}
            />
          </Field>
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={pending === 'email'}
            disabled={pending !== null || email.trim().length === 0}
          >
            Recevoir un lien magique
          </Button>
        </form>

        {sentTo && (
          <p role="status" className="field-label text-foreground">
            Lien envoyé à {sentTo}. Ouvre-le depuis ce navigateur pour terminer la connexion.
          </p>
        )}

        {showPassword ? (
          <form className="flex flex-col gap-2" onSubmit={(event) => void handlePassword(event)}>
            <Field id={PASSWORD_FIELD_ID} label="Mot de passe">
              <Input
                id={PASSWORD_FIELD_ID}
                type="password"
                font="sans"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <Button
              type="submit"
              variant="default"
              className="w-full"
              loading={pending === 'password'}
              disabled={pending !== null || email.trim().length === 0 || password.length === 0}
            >
              Continuer avec un mot de passe
            </Button>
          </form>
        ) : (
          <Button
            variant="ghost"
            className="w-full"
            disabled={pending !== null}
            onClick={() => setShowPassword(true)}
          >
            Utiliser un mot de passe
          </Button>
        )}

        {/* Le compte est optionnel, et cette phrase est la seule chose qui le
            dit à qui vient d'ouvrir la dialog par curiosité. */}
        <p className="field-label">Sans compte, tout reste local à ce navigateur.</p>
      </div>
    </Dialog>
  )
}
