import { api } from './client'
import type { MemorySnapshot, MemoryStrategy } from '../types/api'
export const memoryApi = {
  get: async () => (await api.get<MemorySnapshot>('/api/memory')).data,
  allocate: async (pid: number, strategy: MemoryStrategy) => (await api.post<{ success: boolean; memory: MemorySnapshot }>('/api/memory/allocate', { pid, strategy })).data,
  deallocate: async (pid: number) => (await api.post<{ success: boolean; memory: MemorySnapshot }>('/api/memory/deallocate', { pid })).data,
}
