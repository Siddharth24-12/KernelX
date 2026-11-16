import { lazy, Suspense, useRef } from 'react'
import { ArrowDown, ArrowRight, Cpu, SkipForward } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLandingScroll } from '../components/landing/useLandingScroll'
import { LandingStoryOverlay } from '../components/landing/LandingStoryOverlay'

const LandingCpuScene = lazy(() => import('../components/landing/LandingCpuScene').then((module) => ({ default: module.LandingCpuScene })))

const chapters = [
  { id: 'arrival', label: 'Enter the machine' },
  { id: 'input', label: 'A process enters' },
  { id: 'structures', label: 'Structures organize work' },
  { id: 'execution', label: 'The CPU executes' },
  { id: 'memory', label: 'Memory and completion' },
  { id: 'enter', label: 'Enter KernelX' },
]

export function LandingPage() {
  const storyRef = useRef<HTMLDivElement>(null)
  const { progress, stage } = useLandingScroll(storyRef, chapters.length)

  return <main className="landing-cinematic-page">
    <header className="landing-cinematic-header">
      <Link to="/" className="landing-brand" aria-label="KernelX home">
        <span className="landing-brand-mark"><Cpu size={19} /></span>
        <span>KERNEL<span className="brand-x">X</span></span>
      </Link>
      <span className="landing-header-meta"><i /> CINEMATIC MACHINE STUDY / INTERACTIVE TOUR</span>
      <Link to="/overview" className="landing-skip-link"><SkipForward size={14} /> Skip tour <ArrowRight size={14} /></Link>
    </header>

    <div ref={storyRef} className="landing-cinematic-story" aria-label="Cinematic supercomputer tour">
      <div className="landing-cinematic-stage">
        <div className="landing-atmosphere" aria-hidden="true" />
        <div className="landing-canvas-wrap" aria-label="Illustrative 3D computational engine, not live simulator data">
          <Suspense fallback={<LandingSceneFallback />}>
            <LandingCpuScene scrollProgress={progress} stage={stage} />
          </Suspense>
        </div>
        <LandingStoryOverlay stage={stage} />
        <div className="landing-scene-progress" aria-hidden="true">
          {chapters.map((chapter, index) => <span key={chapter.id} className={stage === index ? 'is-active' : stage > index ? 'is-complete' : ''} />)}
        </div>
        <div className="landing-illustrative-note">ILLUSTRATIVE MODEL · NOT LIVE SIMULATION DATA</div>
        {stage < chapters.length - 1 && <div className="landing-scroll-prompt"><ArrowDown size={13} /> SCROLL TO EXPLORE</div>}
      </div>
      <div className="landing-story-track" aria-hidden="true">
        {chapters.map((chapter) => <section key={chapter.id} className="landing-story-beat" />)}
      </div>
    </div>
  </main>
}

function LandingSceneFallback() {
  return <div className="landing-scene-fallback" role="status">
    <div className="fallback-chip"><span>PROCESSING UNIT</span><strong>KERNEL<span>X</span></strong></div>
    <p>Preparing the illustrative computational environment…</p>
  </div>
}
