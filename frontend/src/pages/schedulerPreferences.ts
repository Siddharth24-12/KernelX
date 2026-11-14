import type { SchedulerPreferences } from '../types/api'

export const DEFAULT_PREFERENCES: SchedulerPreferences = { algorithm: 'ROUND_ROBIN', timeQuantum: 2, preemptivePriority: false, totalMemory: 1024, memoryAllocationStrategy: 'FIRST_FIT', speed: 1 }
export const DEFAULT_PREFERENCES_KEY = 'kernelx.defaultSchedulerConfig'
export const PENDING_PREFERENCES_KEY = 'kernelx.pendingSchedulerConfig'
export function readPreferences(key: string): SchedulerPreferences | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (!value || typeof value !== 'object') return null
    const item = value as Partial<SchedulerPreferences>
    if (!['FCFS', 'SJF', 'ROUND_ROBIN', 'PRIORITY'].includes(item.algorithm ?? '') || !Number.isFinite(item.totalMemory) || !['FIRST_FIT', 'BEST_FIT', 'WORST_FIT'].includes(item.memoryAllocationStrategy ?? '')) return null
    return { ...DEFAULT_PREFERENCES, ...item }
  } catch { return null }
}
