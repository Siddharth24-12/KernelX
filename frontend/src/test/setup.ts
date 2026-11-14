import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)

class ResizeObserverMock implements ResizeObserver {
  observe() { /* jsdom has no layout engine to observe */ }
  unobserve() { /* jsdom has no layout engine to observe */ }
  disconnect() { /* jsdom has no layout engine to observe */ }
}
globalThis.ResizeObserver = ResizeObserverMock
