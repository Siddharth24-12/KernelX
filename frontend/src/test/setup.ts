import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.resetAllMocks()
  vi.useRealTimers()
  localStorage.clear()
  sessionStorage.clear()
})

class ResizeObserverMock implements ResizeObserver {
  observe() { /* jsdom has no layout engine to observe */ }
  unobserve() { /* jsdom has no layout engine to observe */ }
  disconnect() { /* jsdom has no layout engine to observe */ }
}
globalThis.ResizeObserver = ResizeObserverMock
