import { cn } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'
import { DEMO_GRADIENTS } from '../demo/demo-script'
import { useLang } from '../i18n'

/*
 * « Un écran, appliqué aux dix », dessiné plutôt que photographié.
 *
 * Ce bloc remplace une capture d'écran de l'éditeur. La capture montrait une
 * interface en français sur la page anglaise, un titre bouchon et quatre
 * cadres iPhone vides — c'est-à-dire l'exact contraire de ce que le produit
 * promet. Un schéma dessiné dit la même chose, reste vrai dans les deux
 * langues, ne pèse rien et ne peut pas prendre de retard sur l'app.
 */
/* Le preset « Sunset » du produit, pas un dégradé dessiné pour la vitrine.
   La règle avait déjà été posée dans `demo-script.ts` et pas appliquée ici,
   où dix copies de la couleur inventée remplissent le schéma. */
const SHEET = DEMO_GRADIENTS[0].css

function MiniSheet({ className, primary = false }: { className?: string; primary?: boolean }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[3px]',
        primary ? 'ring-1 ring-marker' : 'opacity-80',
        className,
      )}
      style={{ aspectRatio: '1320 / 2868', background: SHEET }}
    >
      <span
        className={cn(
          'absolute left-1/2 -translate-x-1/2 rounded-full bg-white/85',
          primary ? 'top-[8%] h-[2.5%] w-[62%]' : 'top-[9%] h-[3%] w-[60%]',
        )}
      />
      <span
        className="absolute left-1/2 -translate-x-1/2 rounded-[18%/8%] border border-white/70 bg-black/30"
        style={{ top: '24%', height: '58%', aspectRatio: '1170 / 2532' }}
      />
    </div>
  )
}

export function SpreadDiagram() {
  const { t } = useLang()
  const editor = t.features.editor
  return (
    <figure>
      {/* Les neuf destinations sont une rangée, pas une grille 3×3 : à ce
          rapport 1320/2868, neuf vignettes empilées sur trois lignes font un
          bloc de mille pixels de haut qui écrase la source qu'il copie. En
          rangée, le schéma reprend en plus la forme du filmstrip de l'app. */}
      <div className="flex items-end gap-4 border border-border/60 bg-stage p-5 [background-image:radial-gradient(var(--color-stage-dot)_1px,transparent_1px)] [background-size:14px_14px] sm:gap-6 sm:p-8">
        <div className="shrink-0">
          <MiniSheet primary className="h-28 sm:h-40" />
          <p className="mt-2.5 text-center font-mono text-2xs tracking-[0.08em] text-marker uppercase">
            {editor.diagramSource}
          </p>
        </div>
        {/* La flèche nomme ce qui voyage. Sans ce libellé, le schéma montrait
            neuf copies conformes de la source : la transformation qu'il est
            censé démontrer n'était visible nulle part. */}
        <div className="mb-8 flex shrink-0 flex-col items-center gap-1">
          <ArrowRight aria-hidden className="size-4 text-muted-foreground" />
          <p className="hidden max-w-24 text-center text-2xs leading-4 text-muted-foreground lg:block">
            {editor.diagramCarries}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-9 items-end gap-1 sm:gap-1.5">
            {Array.from({ length: 9 }, (_, index) => (
              <MiniSheet key={index} className="w-full" />
            ))}
          </div>
          <p className="mt-2.5 text-center font-mono text-2xs tracking-[0.08em] text-muted-foreground uppercase">
            {editor.diagramTargets}
          </p>
        </div>
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">{editor.diagramLabel}</figcaption>
    </figure>
  )
}
