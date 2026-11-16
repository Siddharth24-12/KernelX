import { describe, expect, it } from 'vitest'
import { landingChapterOpacity, landingCopyShift } from './useLandingScroll'

const widths = [1920, 1440, 1280, 1024, 768, 390]

function expectedCopyWidth(viewportWidth: number) {
  if (viewportWidth <= 600) return viewportWidth * 0.88
  if (viewportWidth <= 900) return Math.min(600, viewportWidth * 0.78)
  return Math.min(660, viewportWidth * 0.62)
}

describe('scroll-driven landing copy bounds', () => {
  it.each(widths)('keeps the hero copy inside a %i px viewport while centering then shifting left', (viewportWidth) => {
    const contentWidth = expectedCopyWidth(viewportWidth)
    const initialLeft = (viewportWidth - contentWidth) / 2 + landingCopyShift(viewportWidth, contentWidth, 0)
    const finalLeft = (viewportWidth - contentWidth) / 2 + landingCopyShift(viewportWidth, contentWidth, 0.18)

    expect(initialLeft).toBeGreaterThanOrEqual(0)
    expect(initialLeft + contentWidth).toBeLessThanOrEqual(viewportWidth)
    expect(finalLeft).toBeGreaterThanOrEqual(0)
    expect(finalLeft + contentWidth).toBeLessThanOrEqual(viewportWidth)
    if (viewportWidth > 600) expect(finalLeft).toBeLessThanOrEqual(initialLeft)
    else expect(finalLeft).toBe(initialLeft)
  })
})

describe('landing chapter transitions', () => {
  it('transitions between neighboring titles without overlapping them', () => {
    const count = 6
    for (let index = 0; index < count - 1; index += 1) {
      const boundary = (index + 1) / count
      expect(landingChapterOpacity(boundary, index, count)).toBe(0)
      expect(landingChapterOpacity(boundary, index + 1, count)).toBe(0)
      expect(landingChapterOpacity(boundary - 0.001, index, count)).toBeGreaterThan(0)
      expect(landingChapterOpacity(boundary + 0.001, index + 1, count)).toBeGreaterThan(0)
    }
  })

  it('reverses the outgoing and incoming fades symmetrically', () => {
    const boundary = 3 / 6
    const before = [landingChapterOpacity(boundary - 0.004, 2, 6), landingChapterOpacity(boundary - 0.004, 3, 6)]
    const after = [landingChapterOpacity(boundary + 0.004, 2, 6), landingChapterOpacity(boundary + 0.004, 3, 6)]
    expect(before[0]).toBeGreaterThan(0)
    expect(before[1]).toBe(0)
    expect(after[1]).toBeGreaterThan(0)
    expect(after[0]).toBe(0)
    expect(before[0]).toBeCloseTo(after[1], 4)
    expect(landingChapterOpacity(0, 0, 6)).toBe(1)
    expect(landingChapterOpacity(1, 5, 6)).toBe(1)
  })
})
