import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PlanPreview } from '@/components/campaign-dialog/PlanPreview'
import { canvasSize } from '@/lib/canvas/canvas-utils'
import { planScreenLayout, type CampaignBrief, type CampaignPlan } from '@/lib/ai/plan'
import type { AppStoreProfileId } from '@/lib/dimensions'
import type { DeviceModel } from '@/types'

const palette = { background: '#101114', ink: '#ffffff', accent: '#c6ff4f' }

function preview(profileId: AppStoreProfileId, deviceModel: DeviceModel) {
  const board = canvasSize(profileId)
  const brief: CampaignBrief = {
    appName: 'ScreenForge',
    pitch: 'Une campagne nette',
    direction: 'contraste',
    screenCount: 1,
    deviceModel,
    board,
    screenshots: [],
  }
  const plan: CampaignPlan = {
    appName: brief.appName,
    direction: brief.direction,
    palette,
    deviceModel,
    screens: [{ name: 'Final', headline: brief.pitch, layout: 'mur' }],
  }
  const layout = planScreenLayout(plan, brief, 0)
  if (!layout) throw new Error('Missing preview layout')
  return {
    board,
    layout,
    html: renderToStaticMarkup(<PlanPreview {...{ plan, brief }} index={0} size="full" />),
  }
}

describe('PlanPreview', () => {
  it.each([
    ['iPad', 'ipad-13', 'tablet-slate'],
    ['Apple Watch', 'watch-ultra-422x514', 'watch-halo'],
  ] as const)('suit la planche %s', (_name, profileId, deviceModel) => {
    const { board, layout, html } = preview(profileId, deviceModel)

    expect(html).toContain(`aspect-ratio:${board.width} / ${board.height}`)
    expect(html).toContain(`left:${(layout.headline.x / board.width) * 100}%`)
    expect(html).toContain(`top:${(layout.headline.y / board.height) * 100}%`)
    expect(html).toContain(`min-height:${(layout.headline.height / board.height) * 100}%`)
    expect(html).toContain(
      `font-size:${Math.max(1, layout.headline.fontSize * (132 / board.width))}px`,
    )
  })
})
