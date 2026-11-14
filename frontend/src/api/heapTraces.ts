import { api } from './client'
import type { HeapRunSummary, HeapRunTrace } from '../types/api'

export const heapTracesApi = {
  runs: async () => (await api.get<HeapRunSummary[]>('/api/dsa/heap/runs')).data,
  run: async (runId: string) => (await api.get<HeapRunTrace>(`/api/dsa/heap/runs/${encodeURIComponent(runId)}`)).data,
}
