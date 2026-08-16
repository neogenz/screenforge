import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import * as SlotPrimitive from '@radix-ui/react-slot'
import type { ButtonHTMLAttributes, Ref } from 'react'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  [
    'inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap',
    'font-sans text-sm font-medium',
    'transition-[background,color,border-color] duration-150 ease-out',
    'disabled:pointer-events-none disabled:opacity-40',
  ],
  {
    variants: {
      variant: {
        // En relief sur son panneau : lisible au repos, sans attendre le survol.
        default:
          'border border-border bg-secondary text-foreground hover:border-input hover:bg-accent',
        // La seule surface pleine de l'interface : blanche sur graphite, noire sur blanc.
        primary:
          'border border-foreground bg-foreground text-stage hover:border-muted-foreground hover:bg-muted-foreground active:border-muted-foreground active:bg-muted-foreground',
        ghost:
          'border border-transparent bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
        danger:
          'border border-border bg-transparent text-destructive hover:border-destructive hover:bg-destructive/14 active:bg-destructive/14',
      },
      // 26px de haut, c'est la taille d'un bouton de barre d'outils d'IDE.
      // Le produit se compare à des outils de design : on part de 30.
      size: {
        sm: 'h-8 rounded-md px-3',
        md: 'h-9 rounded-md px-4',
        lg: 'h-10 rounded-md px-6',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Refuse le clic et préfixe le contenu d'un indicateur, sans masquer le libellé. */
  loading?: boolean
  asChild?: boolean
  /** Infobulle au survol et au focus — remplace le `title=` natif. */
  tooltip?: string
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  variant,
  size,
  loading = false,
  asChild = false,
  disabled,
  className,
  children,
  type = 'button',
  tooltip,
  ref,
  ...props
}: ButtonProps) {
  const Comp = asChild ? SlotPrimitive.Root : 'button'
  const button = (
    <Comp
      ref={ref}
      data-slot="button"
      type={asChild ? undefined : type}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {/* L'indicateur précède le libellé : l'utilisateur garde ce qu'il attend sous les yeux. */}
      {loading && (
        <Loader2
          size={13}
          strokeWidth={2}
          aria-hidden
          className="animate-spin motion-reduce:animate-none"
        />
      )}
      {children}
    </Comp>
  )
  return tooltip ? <Tooltip content={tooltip}>{button}</Tooltip> : button
}
