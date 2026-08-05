import { ChevronDown } from 'lucide-react'
import { useLang } from '../i18n'

export function Faq() {
  const { t } = useLang()
  return (
    <section id="faq" className="scroll-mt-16">
      <div className="mx-auto max-w-3xl px-5 py-24 md:py-32">
        <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">{t.faq.title}</h2>
        <div className="mt-12 divide-y divide-border border-y border-border">
          {t.faq.items.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out group-open:rotate-180"
                />
              </summary>
              <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 ease-out group-open:grid-rows-[1fr]">
                <div className="overflow-hidden">
                  <p className="max-w-[65ch] pb-5 text-sm leading-6 text-muted-foreground">
                    {item.a}
                  </p>
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
