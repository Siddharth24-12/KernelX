import { api } from './client'
import type { PmuListSnapshot, PmuTrace, PmuTraceSummary } from '../types/api'

export const pmuApi = {
  snapshot: async () => (await api.get<PmuListSnapshot>('/api/dsa/pmu/snapshot')).data,
  traces: async () => (await api.get<PmuTraceSummary[]>('/api/dsa/pmu/traces')).data,
  trace: async (traceId: string) => (await api.get<PmuTrace>(`/api/dsa/pmu/traces/${encodeURIComponent(traceId)}`)).data,
}
