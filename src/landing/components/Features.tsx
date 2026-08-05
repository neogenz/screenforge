import { Check } from 'lucide-react'
import { useLang } from '../i18n'
import { VisualPlaceholder } from './visual'

function FeatureBlock({
  title,
  body,
  points,
  caption,
  reversed = false,
}: {
  title: string
  body: string
  points: string[]
  caption: string
  reversed?: boolean
}) {
  return (
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
      <div className={reversed ? 'md:order-1 md:col-span-7 md:-ml-16' : 'md:col-span-7 md:-mr-16'}>
        <VisualPlaceholder caption={caption} />
      </div>
    </div>
  )
}

export function Features() {
  const { t } = useLang()
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-16 px-5 py-24 md:py-32">
      <div className="flex flex-col gap-24 md:gap-32">
        <FeatureBlock
          title={t.features.editor.title}
          body={t.features.editor.body}
          points={t.features.editor.points}
          caption={t.features.editor.visualCaption}
        />
        <FeatureBlock
          reversed
          title={t.features.export.title}
          body={t.features.export.body}
          points={t.features.export.points}
          caption={t.features.export.visualCaption}
        />
        <div className="border-t border-border pt-16 md:pt-20">
          <div className="max-w-2xl">
            <h3 className="text-2xl font-bold tracking-tight text-balance md:text-3xl">
              {t.features.local.title}
            </h3>
            <p className="mt-4 text-[15px] leading-6 text-muted-foreground">
              {t.features.local.body}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
