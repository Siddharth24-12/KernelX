import { describe, expect, it, vi } from 'vitest'

const queuedMock = vi.fn()

describe('shared test environment cleanup', () => {
  it('clears browser state, spies, fake timers, and queued mock behavior between tests', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.useFakeTimers()
    localStorage.setItem('leaked', 'value')
    queuedMock.mockResolvedValueOnce('stale')
    expect(vi.isMockFunction(window.confirm)).toBe(true)
    expect(vi.isFakeTimers()).toBe(true)
    expect(localStorage.getItem('leaked')).toBe('value')
    expect(queuedMock).not.toHaveBeenCalled()
  })

  it('starts with the original browser API and clean storage and timer state', () => {
    expect(vi.isMockFunction(window.confirm)).toBe(false)
    expect(vi.isFakeTimers()).toBe(false)
    expect(localStorage.getItem('leaked')).toBeNull()
    expect(sessionStorage.length).toBe(0)
    expect(queuedMock()).toBeUndefined()
  })
})
