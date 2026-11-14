import { api } from './client'
import type { ProcessRecord } from '../types/api'

export interface CreateProcessInput { pid: number; name: string; priority: number; arrivalTime: number; burstTime: number; memoryRequirement: number; parentPid?: number }
export const processesApi = {
  list: async () => (await api.get<ProcessRecord[]>('/api/processes')).data,
  get: async (pid: number) => (await api.get<ProcessRecord>(`/api/processes/${pid}`)).data,
  create: async (body: CreateProcessInput) => (await api.post<ProcessRecord>('/api/processes', body)).data,
  remove: (pid: number) => api.delete(`/api/processes/${pid}`),
  priority: async (pid: number, priority: number) => (await api.patch<ProcessRecord>(`/api/processes/${pid}/priority`, { priority })).data,
  pause: async (pid: number) => (await api.post<ProcessRecord>(`/api/processes/${pid}/pause`)).data,
  resume: async (pid: number) => (await api.post<ProcessRecord>(`/api/processes/${pid}/resume`)).data,
}
