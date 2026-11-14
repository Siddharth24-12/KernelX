import { api } from './client'
import type { Algorithm, GanttSegment, MemoryStrategy, SchedulingResult, SimulationSnapshot, SystemEvent } from '../types/api'

export interface StartSimulationInput { algorithm: Algorithm; timeQuantum?: number; preemptivePriority?: boolean; totalMemory?: number; memoryAllocationStrategy: MemoryStrategy; speed?: number }
export const simulationApi = {
  state: async () => (await api.get<SimulationSnapshot>('/api/simulation/state')).data,
  start: async (body: StartSimulationInput) => (await api.post<SimulationSnapshot>('/api/simulation/start', body)).data,
  pause: async () => (await api.post<SimulationSnapshot>('/api/simulation/pause')).data,
  resume: async () => (await api.post<SimulationSnapshot>('/api/simulation/resume')).data,
  step: async (ticks = 1) => (await api.post<SimulationSnapshot>('/api/simulation/step', { ticks })).data,
  reset: async () => (await api.post<SimulationSnapshot>('/api/simulation/reset')).data,
  schedule: async () => (await api.get<SchedulingResult>('/api/simulation/scheduling')).data,
  gantt: async () => (await api.get<GanttSegment[]>('/api/simulation/gantt')).data,
  events: async (params?: { pid?: number; type?: string }) => (await api.get<SystemEvent[]>('/api/simulation/events', { params })).data,
}
