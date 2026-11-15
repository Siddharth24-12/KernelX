import { api } from './client'
import type { Algorithm, GanttSegment, ProcessMetric } from '../types/api'
import type { Workload } from './workloads'

export interface ComparisonConfiguration { configurationId: string; label: string; algorithm: Algorithm; timeQuantum?: number | null; preemptivePriority: boolean }
export interface ComparisonRunInput { workloadId: string; configurations: ComparisonConfiguration[] }
export interface ComparisonResult {
  configurationId: string; label: string; algorithm: Algorithm; preemptive: boolean; timeQuantum: number
  gantt: GanttSegment[]; processes: ProcessMetric[]; averageWaitingTime: number; averageTurnaroundTime: number
  averageResponseTime: number; totalTime: number; cpuUtilization: number; throughput: number
}
export interface ComparisonWinner { metric: string; objective: 'MINIMIZE' | 'MAXIMIZE'; value: number; configurationIds: string[]; labels: string[] }
export interface ComparisonReport { comparisonId: string; workloadId: string; workloadName: string; createdAt: string; workloadSnapshot: Workload; results: ComparisonResult[]; winners: ComparisonWinner[] }

export const comparisonsApi = {
  run: async (body: ComparisonRunInput) => (await api.post<ComparisonReport>('/api/comparisons', body)).data,
  list: async () => (await api.get<ComparisonReport[]>('/api/comparisons')).data,
  get: async (id: string) => (await api.get<ComparisonReport>(`/api/comparisons/${encodeURIComponent(id)}`)).data,
  remove: (id: string) => api.delete(`/api/comparisons/${encodeURIComponent(id)}`),
}
