import { Faq } from './components/Faq'
import { Features } from './components/Features'
import { FinalCta } from './components/FinalCta'
import { Footer } from './components/Footer'
import { Hero } from './components/Hero'
import { Nav } from './components/Nav'
import { Pricing } from './components/Pricing'
import { ProofStrip } from './components/ProofStrip'

/*
 * Le cadre à filets (`border-x`) est la signature blueprint : toute la page
 * se lit entre deux traits de plan, chaque section séparée d'un filet.
 */
export function Landing() {
  return (
    <>
      <Nav />
      <div className="mx-auto max-w-6xl border-x border-border/60">
        <main>
          <Hero />
          <ProofStrip />
          <Features />
          <Pricing />
          <Faq />
          <FinalCta />
        </main>
        <Footer />
      </div>
    </>
  )
}
