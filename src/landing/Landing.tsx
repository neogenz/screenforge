import { Features } from './components/Features'
import { Hero } from './components/Hero'
import { Nav } from './components/Nav'
import { ProofStrip } from './components/ProofStrip'

export function Landing() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <ProofStrip />
        <Features />
        <section id="pricing" />
        <section id="faq" />
      </main>
      <footer />
    </>
  )
}
