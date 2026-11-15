import { api } from './client'
import type { ComparisonResult, ComparisonWinner } from './comparisons'
import type { Workload } from './workloads'
import type { Algorithm, MemoryStrategy, GanttSegment, ProcessMetric } from '../types/api'

export type ExperimentType = 'SCHEDULING' | 'MEMORY'
export interface ProcessChange { pid: number; arrivalTime?: number; burstTime?: number; priority?: number }
export interface MemoryOperation { operation: 'ALLOCATE' | 'DEALLOCATE'; pid: number; amount?: number }
export interface ExperimentVariantInput {
  variantId: string; label: string; algorithm?: Algorithm; timeQuantum?: number | null; preemptivePriority?: boolean
  processChanges?: ProcessChange[]; memoryStrategy?: MemoryStrategy
}
export interface ExperimentInput {
  name: string; description: string; baseWorkloadId: string; type: ExperimentType
  variants: ExperimentVariantInput[]; memoryOperations?: MemoryOperation[]
}
export interface ExperimentConfiguration { algorithm: Algorithm | null; timeQuantum: number | null; preemptivePriority: boolean; memoryStrategy: MemoryStrategy | null; totalMemory: number | null }
export interface MemoryOperationResult { index: number; operation: 'ALLOCATE' | 'DEALLOCATE'; pid: number; amount: number | null; succeeded: boolean; outcome: string }
export interface MemoryVariantResult {
  successfulAllocations: number; failedAllocations: number; successfulDeallocations: number; totalMemory: number
  allocatedMemory: number; freeMemory: number; largestFreeBlock: number; externalFragmentation: number
  blocks: Array<{ startAddress: number; size: number; pid: number | null; free: boolean }>; operations: MemoryOperationResult[]
}
export interface ExperimentVariantResult {
  variantId: string; label: string; configuration: ExperimentConfiguration; parameterChanges: string[]
  schedulingResult: ComparisonResult | null; memoryResult: MemoryVariantResult | null
}
export interface ExperimentMetricComparison { variantId: string; variantLabel: string; metric: string; baselineValue: number; variantValue: number; difference: number; absoluteDifference: number; percentageChange: number | null }
export interface ProcessMetricDelta { variantId: string; pid: number; processName: string; baselineWaitingTime: number; variantWaitingTime: number; waitingDifference: number; baselineTurnaroundTime: number; variantTurnaroundTime: number; turnaroundDifference: number; baselineResponseTime: number; variantResponseTime: number; responseDifference: number }
export interface ExperimentReport {
  experimentId: string; name: string; description: string; type: ExperimentType; baseWorkloadId: string; baseWorkloadName: string
  executedAt: string; workloadSnapshot: Workload; baseline: ExperimentVariantResult; variants: ExperimentVariantResult[]
  metricComparisons: ExperimentMetricComparison[]; processMetricDeltas: ProcessMetricDelta[]; winners: ComparisonWinner[]
}

export const experimentsApi = {
  execute: async (body: ExperimentInput) => (await api.post<ExperimentReport>('/api/experiments', body)).data,
  list: async () => (await api.get<ExperimentReport[]>('/api/experiments')).data,
  get: async (id: string) => (await api.get<ExperimentReport>(`/api/experiments/${encodeURIComponent(id)}`)).data,
  remove: (id: string) => api.delete(`/api/experiments/${encodeURIComponent(id)}`),
}

export type { Algorithm, MemoryStrategy, GanttSegment, ProcessMetric }
