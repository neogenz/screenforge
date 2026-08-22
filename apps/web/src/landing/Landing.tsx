import { useState } from 'react'
import { PrivacyConsent } from '@/components/privacy/PrivacyConsent'
import { AgentSection } from './components/AgentSection'
import { Faq } from './components/Faq'
import { Features } from './components/Features'
import { FinalCta } from './components/FinalCta'
import { Footer } from './components/Footer'
import { Hero } from './components/Hero'
import { Marquee } from './components/Marquee'
import { Nav } from './components/Nav'
import { Pricing } from './components/Pricing'
import { ProductShowcase } from './components/ProductShowcase'
import { ProofStrip } from './components/ProofStrip'
import { useLang } from './i18n'

export function Landing() {
  const { t } = useLang()
  const [privacyOpen, setPrivacyOpen] = useState(false)

  return (
    <>
      <Nav />
      <div>
        <main id="content">
          <Hero />
          <ProductShowcase />
          <Marquee />
          <ProofStrip />
          <Features />
          <AgentSection />
          <Pricing />
          <Faq />
          <FinalCta />
        </main>
        <Footer onPrivacyPreferences={() => setPrivacyOpen(true)} />
      </div>
      <PrivacyConsent copy={t.privacy} open={privacyOpen} onOpenChange={setPrivacyOpen} />
    </>
  )
}
