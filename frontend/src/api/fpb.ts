import { api } from './client'
import type { FpbLiveSnapshot, FpbTrace, FpbTraceSummary } from '../types/api'

export const fpbApi = {
  snapshot: async () => (await api.get<FpbLiveSnapshot>('/api/dsa/fpb/snapshot')).data,
  traces: async () => (await api.get<FpbTraceSummary[]>('/api/dsa/fpb/traces')).data,
  trace: async (traceId: string) => (await api.get<FpbTrace>(`/api/dsa/fpb/traces/${encodeURIComponent(traceId)}`)).data,
}
