import { api } from './client'
import type { AluTableSnapshot, AluTrace, AluTraceSummary } from '../types/api'

export const aluApi = {
  snapshot: async () => (await api.get<AluTableSnapshot>('/api/dsa/alu/snapshot')).data,
  traces: async () => (await api.get<AluTraceSummary[]>('/api/dsa/alu/traces')).data,
  trace: async (traceId: string) => (await api.get<AluTrace>(`/api/dsa/alu/traces/${encodeURIComponent(traceId)}`)).data,
}
