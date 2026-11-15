import { api } from './client'
import type { PtuSnapshot, PtuTrace, PtuTraceSummary } from '../types/api'
export const ptuApi = {
  snapshot: async () => (await api.get<PtuSnapshot>('/api/dsa/ptu/snapshot')).data,
  traces: async () => (await api.get<PtuTraceSummary[]>('/api/dsa/ptu/traces')).data,
  trace: async (id: string) => (await api.get<PtuTrace>(`/api/dsa/ptu/traces/${encodeURIComponent(id)}`)).data,
}
