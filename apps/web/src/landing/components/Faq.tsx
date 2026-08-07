import { ChevronDown } from 'lucide-react'
import { useLang } from '../i18n'
import { SectionHeading } from './SectionHeading'

/*
 * `<details>`/`<summary>` natifs : l'état ouvert/fermé, le clavier et
 * l'annonce lecteur d'écran sont fournis par le navigateur. Le seul ajout est
 * l'ouverture animée, via une grille `0fr → 1fr` (une hauteur `auto` ne
 * s'anime pas), et l'anneau de focus — que `list-none` sur le summary faisait
 * disparaître avec le marqueur.
 */
export function Faq() {
  const { t } = useLang()
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="scroll-mt-20 grid gap-12 border-b border-border/60 px-5 py-20 md:px-14 md:py-28 lg:grid-cols-12 lg:gap-16"
    >
      <SectionHeading id="faq-title" className="m-0 text-left lg:col-span-5">
        {t.faq.title}
      </SectionHeading>
      <div className="lg:col-span-7">
        {t.faq.items.map((item) => (
          <details key={item.q} className="group border-b border-border/60 last:border-b-0">
            <summary className="flex cursor-pointer list-none items-center gap-5 py-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
              <span className="flex-1 text-[15px] font-medium">{item.q}</span>
              <ChevronDown
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out group-open:rotate-180"
              />
            </summary>
            <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 ease-out group-open:grid-rows-[1fr] motion-reduce:transition-none">
              <div className="overflow-hidden">
                <p className="max-w-[65ch] pb-5 text-sm leading-6 text-muted-foreground">
                  {item.a}
                </p>
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
