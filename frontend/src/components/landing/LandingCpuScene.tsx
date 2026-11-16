import { Component, useEffect, useRef, useState, type ErrorInfo, type MutableRefObject, type ReactNode, type PointerEvent } from 'react'
import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping } from 'three'
import { LandingEnvironment3D } from './LandingEnvironment3D'

const sceneLabels: Record<number, string> = {
  1: 'PCB MEMORY UNIT  /  LINKED LIST + PROCESS TREE',
  2: 'PRIORITY DISPATCH  /  MAX HEAP + FIFO BUFFER',
  3: 'PROCESSOR PACKAGE  /  EXECUTION FABRIC',
  4: 'MEMORY SYSTEM  /  HASH INDEX + ALLOCATION BANKS',
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])
  return reduced
}

function MachineStaticFallback() {
  return <div className="landing-scene-fallback" role="img" aria-label="Static KernelX computational system map with processor, linked list, max heap, hash table, FIFO queue, process tree and memory banks">
    <div className="fallback-machine-system">
      <span>PCB / TREE</span><i /><b>PRIORITY HEAP</b><i /><strong>PROCESSOR</strong><i /><span>HASH / MEMORY</span>
      <div className="fallback-machine-queue"><b>FIFO BUFFER</b><small>FRONT ───────────────── REAR</small></div>
    </div>
    <p>Static system view · WebGL unavailable</p>
  </div>
}

type BoundaryProps = { children: ReactNode }
type BoundaryState = { failed: boolean }
class SceneErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false }
  static getDerivedStateFromError(): BoundaryState { return { failed: true } }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* Keep the static system map available if WebGL fails. */ }
  render() { return this.state.failed ? <MachineStaticFallback /> : this.props.children }
}

export function LandingCpuScene({ scrollProgress, stage }: { scrollProgress: MutableRefObject<number>; stage: number }) {
  const reduced = useReducedMotion()
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 700px)').matches)
  const [visible, setVisible] = useState(true)
  const container = useRef<HTMLDivElement>(null)
  const invalidate = useRef<() => void>(() => {})
  const pointer = useRef<[number, number]>([0, 0])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(max-width: 700px)')
    const update = () => setCompact(media.matches)
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    const element = container.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting && !document.hidden), { threshold: .01 })
    observer.observe(element)
    const updateVisibility = () => {
      const rect = element.getBoundingClientRect()
      setVisible(!document.hidden && rect.bottom > 0 && rect.top < window.innerHeight)
    }
    document.addEventListener('visibilitychange', updateVisibility)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', updateVisibility)
    }
  }, [])

  useEffect(() => {
    if (!reduced) return
    const redraw = () => invalidate.current()
    window.addEventListener('scroll', redraw, { passive: true })
    window.addEventListener('resize', redraw, { passive: true })
    return () => {
      window.removeEventListener('scroll', redraw)
      window.removeEventListener('resize', redraw)
    }
  }, [reduced])

  const updatePointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    pointer.current = [((event.clientX - bounds.left) / bounds.width - .5) * 2, ((event.clientY - bounds.top) / bounds.height - .5) * 2]
    if (reduced) invalidate.current()
  }

  return <div
    ref={container}
    className="landing-canvas landing-real-3d"
    aria-label="Interactive three-dimensional semiconductor environment; illustrative, not live simulator data"
    onPointerMove={updatePointer}
    onPointerLeave={() => { pointer.current = [0, 0]; if (reduced) invalidate.current() }}
  >
    <SceneErrorBoundary>
      <Canvas
        dpr={compact || reduced ? 1 : [1, 1.5]}
        frameloop={!visible ? 'never' : reduced ? 'demand' : 'always'}
        camera={{ position: [0, 17.8, 27], fov: 36, near: .1, far: 90 }}
        shadows={!compact}
        fallback={<MachineStaticFallback />}
        gl={{ antialias: !compact, alpha: false, powerPreference: 'high-performance', stencil: false, depth: true, preserveDrawingBuffer: false }}
        onCreated={(state) => {
          invalidate.current = state.invalidate
          state.gl.shadowMap.enabled = !compact
          state.gl.toneMapping = ACESFilmicToneMapping
          state.gl.toneMappingExposure = 0.78
          state.invalidate()
        }}
      >
        <LandingEnvironment3D progress={scrollProgress} stage={stage} compact={compact} reduced={reduced} pointer={pointer} />
      </Canvas>
    </SceneErrorBoundary>
    {sceneLabels[stage] && <div className="landing-scene-active-label" aria-live="polite"><i />{sceneLabels[stage]}</div>}
  </div>
}
