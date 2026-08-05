import { Check } from 'lucide-react'
import { useLang } from '../i18n'
import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'
import { Visual } from './visual'

function FeatureBlock({
  title,
  body,
  points,
  visual,
  caption,
  reversed = false,
}: {
  title: string
  body: string
  points: string[]
  visual: string
  caption: string
  reversed?: boolean
}) {
  return (
    <Reveal>
      <div className="grid items-center gap-10 md:grid-cols-12 md:gap-12">
        <div className={reversed ? 'md:order-2 md:col-span-5' : 'md:col-span-5'}>
          <h3 className="text-2xl font-bold tracking-tight text-balance md:text-3xl">{title}</h3>
          <p className="mt-4 max-w-[65ch] text-[15px] leading-6 text-muted-foreground">{body}</p>
          <ul className="mt-6 flex flex-col gap-2.5 text-sm">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div className={reversed ? 'md:order-1 md:col-span-7' : 'md:col-span-7'}>
          <Visual src={visual} caption={caption} />
        </div>
      </div>
    </Reveal>
  )
}

export function Features() {
  const { t } = useLang()
  return (
    <section
      id="features"
      className="scroll-mt-16 border-b border-border/60 px-5 py-20 md:px-10 md:py-28"
    >
      <SectionHeading index="01" title={t.spec.editor} />
      <div className="mt-14">
        <FeatureBlock
          title={t.features.editor.title}
          body={t.features.editor.body}
          points={t.features.editor.points}
          visual="/landing/editor.jpg"
          caption={t.features.editor.visualCaption}
        />
      </div>
      <div className="mt-24 md:mt-32">
        <SectionHeading index="02" title={t.spec.export} />
      </div>
      <div className="mt-14">
        <FeatureBlock
          reversed
          title={t.features.export.title}
          body={t.features.export.body}
          points={t.features.export.points}
          visual="/landing/export.jpg"
          caption={t.features.export.visualCaption}
        />
      </div>
      <Reveal>
        <div className="mt-24 border-t border-border/60 pt-16 md:mt-32 md:pt-20">
          <div className="max-w-2xl">
            <h3 className="text-2xl font-bold tracking-tight text-balance md:text-4xl">
              {t.features.ownership.title}
            </h3>
            <p className="mt-4 text-[15px] leading-6 text-muted-foreground">
              {t.features.ownership.body}
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
