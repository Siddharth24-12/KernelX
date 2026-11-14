export type ProcessState = 'NEW' | 'READY' | 'RUNNING' | 'WAITING' | 'PAUSED' | 'TERMINATED'
export type SimulationStatus = 'READY' | 'RUNNING' | 'PAUSED' | 'COMPLETED'
export type Algorithm = 'FCFS' | 'SJF' | 'ROUND_ROBIN' | 'PRIORITY'
export type MemoryStrategy = 'FIRST_FIT' | 'BEST_FIT' | 'WORST_FIT'

export interface ProcessRecord {
  pid: number; name: string; priority: number; arrivalTime: number; burstTime: number
  remainingTime: number; memoryRequirement: number; parentPid: number; state: ProcessState
  completionTime: number; waitingTime: number; turnaroundTime: number; responseTime: number
}
export interface GanttSegment { pid: number; processName: string; startTime: number; endTime: number; duration: number; idle: boolean }
export interface SimulationSnapshot {
  status: SimulationStatus; algorithm: Algorithm | null; currentTime: number; totalTime: number; speed: number
  runningPid: number | null; readyPids: number[]; waitingPids: number[]; completedSegments: GanttSegment[]
}
export interface ProcessMetric { pid: number; name: string; completionTime: number; turnaroundTime: number; waitingTime: number; responseTime: number }
export interface SchedulingResult {
  algorithm: Algorithm; preemptive: boolean; timeQuantum: number; gantt: GanttSegment[]; processes: ProcessMetric[]
  averageWaitingTime: number; averageTurnaroundTime: number; averageResponseTime: number; totalTime: number
}
export interface MemoryBlock { startAddress: number; size: number; pid: number | null; free: boolean }
export interface MemorySnapshot { totalMemory: number; allocatedMemory: number; freeMemory: number; blocks: MemoryBlock[] }
export interface SystemEvent { eventId: number; simulationTime: number; pid: number | null; type: string; description: string }
export interface ProcessTreeNode extends Omit<ProcessRecord, 'completionTime' | 'waitingTime' | 'turnaroundTime' | 'responseTime'> { children: ProcessTreeNode[] }
export interface SavedSimulation { id: string; name: string; savedAt: string; scheduling: SchedulingResult; processes: unknown[]; memory: MemorySnapshot; events: SystemEvent[] }
export interface SavedConfiguration { id: string; name: string; createdAt: string; simulation: { algorithm: Algorithm; timeQuantum: number; preemptivePriority: boolean }; totalMemory: number; memoryAllocationStrategy: MemoryStrategy; speed: number }
export interface SchedulerPreferences { algorithm: Algorithm; timeQuantum: number; preemptivePriority: boolean; totalMemory: number; memoryAllocationStrategy: MemoryStrategy; speed: number }
export interface HeapEntrySnapshot { pid: number; name: string; priority: number; arrivalTime: number; burstTime: number; remainingTime: number }
export interface HeapSlotSnapshot { index: number; entry: HeapEntrySnapshot }
export interface HeapTraceStep {
  sequence: number; kind: 'HEAPIFY' | 'INSERT' | 'EXTRACT_MAX' | 'UPDATE' | 'COMPARE' | 'SWAP'
  simulationTime: number; pid: number | null; name: string | null; priority: number | null
  index: number | null; otherIndex: number | null; comparisonResult: number | null; comparisonPhase: string | null
  value: HeapEntrySnapshot | null; otherValue: HeapEntrySnapshot | null; values: HeapEntrySnapshot[]
  sizeBefore: number | null; sizeAfter: number | null
}
export interface HeapRunSummary { runId: string; algorithm: Algorithm; preemptive: boolean; processCount: number; startedAt: string; completedAt: string | null; operationCount: number; truncated: boolean }
export interface HeapRunTrace extends HeapRunSummary { finalHeap: HeapSlotSnapshot[]; steps: HeapTraceStep[] }
export interface ApiError { timestamp: string; status: number; error: string; message: string; path: string }
