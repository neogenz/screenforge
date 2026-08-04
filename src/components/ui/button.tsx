import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import * as SlotPrimitive from '@radix-ui/react-slot'
import type { ButtonHTMLAttributes, Ref } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  [
    'inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap',
    'font-sans text-[12.5px] font-medium',
    'transition-[background,color,border-color] duration-150 ease-out',
    'disabled:pointer-events-none disabled:opacity-40',
  ],
  {
    variants: {
      variant: {
        // En relief sur son panneau : lisible au repos, sans attendre le survol.
        default:
          'border border-border bg-raised text-foreground hover:border-border-strong hover:bg-raised-hover active:bg-raised-active',
        // La seule surface pleine de l'interface : blanche sur graphite, noire sur blanc.
        primary:
          'border border-foreground bg-foreground text-stage hover:border-foreground-muted hover:bg-foreground-muted active:border-foreground-muted active:bg-foreground-muted',
        ghost:
          'border border-transparent bg-transparent text-foreground-muted hover:bg-raised-hover hover:text-foreground active:bg-raised-active',
        danger:
          'border border-border bg-transparent text-danger hover:border-danger hover:bg-danger-soft active:bg-danger-soft',
      },
      // 26px de haut, c'est la taille d'un bouton de barre d'outils d'IDE.
      // Le produit se compare à des outils de design : on part de 30.
      size: {
        sm: 'h-[30px] rounded-md px-3',
        md: 'h-[34px] rounded-md px-3.5',
        lg: 'h-[40px] rounded-lg px-4',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Refuse le clic et préfixe le contenu d'un indicateur, sans masquer le libellé. */
  loading?: boolean
  asChild?: boolean
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
  ref,
  ...props
}: ButtonProps) {
  const Comp = asChild ? SlotPrimitive.Root : 'button'
  return (
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
}
