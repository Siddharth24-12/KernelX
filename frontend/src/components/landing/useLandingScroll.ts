import { useEffect, useRef, useState, type RefObject } from 'react'

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

export function landingCopyShift(viewportWidth: number, contentWidth: number, progress: number) {
  if (viewportWidth <= 600) return 0
  const margin = Math.min(96, Math.max(22, viewportWidth * 0.06))
  const centeredLeft = (viewportWidth - contentWidth) / 2
  return Math.min(0, margin - centeredLeft) * clamp01(progress / 0.18)
}

export function landingChapterOpacity(progress: number, index: number, chapterCount: number) {
  const count = Math.max(1, chapterCount)
  const span = 1 / count
  const fade = span * 0.2
  const smooth = (value: number) => {
    const t = clamp01(value)
    if (t < 1e-9) return 0
    if (1 - t < 1e-9) return 1
    return t * t * (3 - 2 * t)
  }
  const start = index * span
  const end = (index + 1) * span
  const enter = index === 0 ? 1 : smooth((progress - start) / fade)
  const leave = index === count - 1 ? 1 : smooth((end - progress) / fade)
  return Math.min(enter, leave)
}

/** Shares low-cost scroll progress with cinematic framing and the chapter overlay. */
export function useLandingScroll(storyRef: RefObject<HTMLElement | null>, chapterCount: number) {
  const progress = useRef(0)
  const [stage, setStage] = useState(0)

  useEffect(() => {
    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const story = storyRef.current
        if (!story) return
        const top = window.scrollY + story.getBoundingClientRect().top
        const range = Math.max(1, story.offsetHeight - window.innerHeight)
        const next = clamp01((window.scrollY - top) / range)
        const copy = story.querySelector<HTMLElement>('.landing-story-copy')
        const copyWidth = copy?.getBoundingClientRect().width ?? window.innerWidth * 0.7
        const shiftProgress = window.innerWidth <= 600 ? 0 : clamp01(next / 0.18)
        progress.current = next
        story.style.setProperty('--story-copy-shift', `${landingCopyShift(window.innerWidth, copyWidth, next)}px`)
        story.style.setProperty('--story-heading-reduction', `${shiftProgress * (window.innerWidth <= 600 ? 5 : 14)}px`)
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
        const activeStage = Math.min(chapterCount - 1, Math.floor(next * chapterCount))
        const smooth = (value: number) => {
          const t = clamp01(value)
          return t * t * (3 - 2 * t)
        }
        for (let index = 0; index < chapterCount; index += 1) {
          const span = 1 / Math.max(1, chapterCount)
          const fade = span * 0.2
          const start = index * span
          const end = (index + 1) * span
          const opacity = reducedMotion ? Number(index === activeStage) : landingChapterOpacity(next, index, chapterCount)
          const enter = index === 0 ? 1 : smooth((next - start) / fade)
          const leave = index === chapterCount - 1 ? 1 : smooth((end - next) / fade)
          const y = reducedMotion ? 0 : (1 - enter) * 18 - (1 - leave) * 18
          story.style.setProperty(`--chapter-${index}-opacity`, opacity.toFixed(4))
          story.style.setProperty(`--chapter-${index}-y`, `${y.toFixed(2)}px`)
          story.style.setProperty(`--chapter-${index}-scale`, (reducedMotion ? 1 : 0.985 + opacity * 0.015).toFixed(4))
        }
        setStage(activeStage)
      })
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [chapterCount, storyRef])

  return { progress, stage }
}
