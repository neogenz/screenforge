import { TriangleAlert } from 'lucide-react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export interface NoticeStripProps {
  title: string
  description: string
  action?: { label: string; onClick: () => void }
  className?: string
}

/**
 * Une condition qui tient, écrite juste sous ce qu'elle explique — jamais un
 * toast, qui se referme sans que la condition, elle, ne soit finie.
 *
 * `role="status"` et non le `role="alert"` que pose `Alert` par défaut : elle
 * ne coupe la parole à personne, elle informe tant que dure ce qu'elle décrit.
 * Pas de fermeture — vivre avec la condition est le seul moyen de la faire
 * disparaître.
 */
export function NoticeStrip({ title, description, action, className }: NoticeStripProps) {
  return (
    <Alert role="status" variant="warning" className={className}>
      <TriangleAlert aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
      {action && (
        <AlertAction>
          <Button variant="secondary" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        </AlertAction>
      )}
    </Alert>
  )
}
