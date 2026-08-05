import { ChevronDown } from 'lucide-react'
import { useLang } from '../i18n'
import { SectionHeading } from './SectionHeading'

export function Faq() {
  const { t } = useLang()
  return (
    <section
      id="faq"
      className="scroll-mt-16 border-b border-border/60 px-5 py-20 md:px-10 md:py-28"
    >
      <SectionHeading index="04" title={t.spec.faq} />
      <div className="mt-14">
        {t.faq.items.map((item, index) => (
          <details key={item.q} className="group border-b border-border/60 last:border-b-0">
            <summary className="flex cursor-pointer list-none items-baseline gap-5 py-5 [&::-webkit-details-marker]:hidden">
              <span className="text-sm font-semibold tabular-nums text-marker">04.{index + 1}</span>
              <span className="flex-1 text-[15px] font-medium">{item.q}</span>
              <ChevronDown
                aria-hidden
                className="size-4 shrink-0 self-center text-muted-foreground transition-transform duration-200 ease-out group-open:rotate-180"
              />
            </summary>
            <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 ease-out group-open:grid-rows-[1fr]">
              <div className="overflow-hidden">
                <p className="max-w-[65ch] pb-5 pl-9 text-sm leading-6 text-muted-foreground md:pl-10">
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
