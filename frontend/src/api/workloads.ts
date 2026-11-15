import { api } from './client'
import type { Algorithm, MemoryStrategy } from '../types/api'

export interface WorkloadProcess { pid: number; name: string; priority: number; arrivalTime: number; burstTime: number; memoryRequirement: number; parentPid: number }
export interface Workload { id: string; name: string; description: string; createdAt: string | null; updatedAt: string | null; processes: WorkloadProcess[]; algorithm: Algorithm; timeQuantum: number; preemptivePriority: boolean; totalMemory: number; memoryAllocationStrategy: MemoryStrategy; speed: number }
export type WorkloadInput = Omit<Workload, 'id' | 'createdAt' | 'updatedAt'>
export interface WorkloadValidation { valid: boolean; errors: string[]; warnings: string[] }
export interface WorkloadExecution { workloadId: string; createdPids: number[]; simulation: { status: string; algorithm: Algorithm; currentTime: number; totalTime: number } }
export interface WorkloadLoad { workloadId: string; processes: Array<{ pid: number; name: string }> }

export const workloadsApi = {
  list: async () => (await api.get<Workload[]>('/api/workloads')).data,
  templates: async () => (await api.get<Workload[]>('/api/workloads/templates')).data,
  get: async (id: string) => (await api.get<Workload>(`/api/workloads/${encodeURIComponent(id)}`)).data,
  create: async (body: WorkloadInput) => (await api.post<Workload>('/api/workloads', body)).data,
  update: async (id: string, body: WorkloadInput) => (await api.put<Workload>(`/api/workloads/${encodeURIComponent(id)}`, body)).data,
  remove: (id: string) => api.delete(`/api/workloads/${encodeURIComponent(id)}`),
  validate: async (body: WorkloadInput) => (await api.post<WorkloadValidation>('/api/workloads/validate', body)).data,
  load: async (id: string) => (await api.post<WorkloadLoad>(`/api/workloads/${encodeURIComponent(id)}/load`)).data,
  execute: async (id: string) => (await api.post<WorkloadExecution>(`/api/workloads/${encodeURIComponent(id)}/execute`)).data,
}
