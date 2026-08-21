import { useEffect, useState, useSyncExternalStore } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Provider as TooltipProvider } from '@radix-ui/react-tooltip'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import type { PrivacyCopy } from '@/components/privacy/privacy-copy'
import {
  analyticsConfigured,
  applyPrivacyChoice,
  EMPTY_PRIVACY_CHOICE,
  readPrivacyChoice,
  savePrivacyChoice,
  type PrivacyChoice,
} from '@/lib/analytics'

interface PrivacyConsentProps {
  copy: PrivacyCopy
  open: boolean
  onOpenChange: (open: boolean) => void
}

const subscribeToNothing = () => () => undefined

export function PrivacyConsent({ copy, open, onOpenChange }: PrivacyConsentProps) {
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  )
  const [choice, setChoice] = useState<PrivacyChoice | null>(() => readPrivacyChoice())

  useEffect(() => {
    if (choice) void applyPrivacyChoice(choice)
  }, [choice])

  if (!hydrated || !analyticsConfigured) return null

  function commit(next: PrivacyChoice): boolean {
    if (!savePrivacyChoice(next)) return false
    /* Le choix prend effet avant que le dialogue disparaisse : un clic immédiat
       sur le CTA suivant ne doit pas doubler la fenêtre de non-capture. */
    void applyPrivacyChoice(next)
    setChoice(next)
    onOpenChange(false)
    return true
  }

  return (
    <TooltipProvider>
      {!choice && !open && (
        <aside
          aria-labelledby="privacy-banner-title"
          className="surface-modal fixed bottom-16 left-1/2 z-(--z-overlay) w-[min(720px,calc(100%-2rem))] -translate-x-1/2 p-4 motion-reduce:transition-none"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <h2 id="privacy-banner-title" className="section-title flex items-center gap-2">
                <ShieldCheck size={16} strokeWidth={1.75} aria-hidden />
                {copy.bannerTitle}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{copy.bannerBody}</p>
              <a
                className="mt-1 inline-block text-xs text-foreground underline underline-offset-4"
                href="/privacy.html"
              >
                {copy.policy}
              </a>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => commit(EMPTY_PRIVACY_CHOICE)}>
                {copy.rejectAll}
              </Button>
              <Button size="sm" onClick={() => onOpenChange(true)}>
                {copy.choose}
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => commit({ version: 1, analytics: true, diagnostic: true })}
              >
                {copy.acceptAll}
              </Button>
            </div>
          </div>
        </aside>
      )}

      {open && (
        <PrivacyDialog
          copy={copy}
          choice={choice ?? EMPTY_PRIVACY_CHOICE}
          onClose={() => onOpenChange(false)}
          onCommit={commit}
        />
      )}
    </TooltipProvider>
  )
}

function PrivacyDialog({
  copy,
  choice,
  onClose,
  onCommit,
}: {
  copy: PrivacyCopy
  choice: PrivacyChoice
  onClose: () => void
  onCommit: (choice: PrivacyChoice) => boolean
}) {
  const [draft, setDraft] = useState(choice)
  const [error, setError] = useState(false)

  function save(next: PrivacyChoice) {
    setError(!onCommit(next))
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={copy.title}
      closeLabel={copy.close}
      size="sm"
      footer={
        <>
          <Button size="sm" onClick={() => save(EMPTY_PRIVACY_CHOICE)}>
            {copy.rejectAll}
          </Button>
          <Button size="sm" variant="primary" onClick={() => save(draft)}>
            {copy.save}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <PurposeRow
          title={copy.analyticsTitle}
          body={copy.analyticsBody}
          checked={draft.analytics}
          onChange={(analytics) => setDraft((current) => ({ ...current, analytics }))}
        />
        <PurposeRow
          title={copy.diagnosticTitle}
          body={copy.diagnosticBody}
          checked={draft.diagnostic}
          onChange={(diagnostic) => setDraft((current) => ({ ...current, diagnostic }))}
        />
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {copy.storageError}
          </p>
        )}
        <a className="inline-block text-xs underline underline-offset-4" href="/privacy.html">
          {copy.policy}
        </a>
      </div>
    </Dialog>
  )
}

function PurposeRow({
  title,
  body,
  checked,
  onChange,
}: {
  title: string
  body: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="surface-inner flex items-start gap-4 p-4">
      <div className="min-w-0 flex-1">
        <h3 className="section-title">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      </div>
      <Switch checked={checked} onChange={onChange} ariaLabel={title} />
    </div>
  )
}
