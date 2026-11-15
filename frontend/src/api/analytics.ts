import { api } from './client'
import type { GanttSegment, ProcessState, SimulationSnapshot } from '../types/api'

export interface CpuTickSample {
  runId: string; simulationTime: number; runningPid: number | null; processName: string; readyProcessCount: number
  waitingProcessCount: number; completedProcessCount: number; cumulativeBusyTicks: number
  cumulativeIdleTicks: number; utilizationPercent: number
}
export interface ProcessAnalyticsRow {
  pid: number; name: string; state: ProcessState; arrivalTime: number; burstTime: number; remainingTime: number
  completionTime: number; waitingTime: number; turnaroundTime: number; responseTime: number
}
export interface AnalyticsSnapshot {
  capturedAt: string
  cpu: {
    status: SimulationSnapshot['status']; currentTime: number; totalTime: number; currentRunningPid: number | null
    readyPids: number[]; completedProcessCount: number; runId: string | null; observedBusyTicks: number | null
    observedIdleTicks: number | null; observedUtilizationPercent: number | null; samples: CpuTickSample[]
    observedGantt: GanttSegment[]; scheduledGantt: GanttSegment[]; completedGantt: GanttSegment[]; sampleIntervalTicks: number
    maxRetainedSamples: number; retainedSampleCount: number; historyTruncated: boolean
  }
  memory: {
    totalMemory: number; allocatedMemory: number; freeMemory: number; allocatedBlockCount: number
    freeBlockCount: number; largestFreeBlock: number; utilizationPercent: number
    externalFragmentationPercent: number; allocationFailures: number
  }
  processes: { stateCounts: Record<ProcessState, number>; processes: ProcessAnalyticsRow[]; processTableCount: number }
}

export const analyticsApi = {
  snapshot: async () => (await api.get<AnalyticsSnapshot>('/api/analytics/snapshot')).data,
}
