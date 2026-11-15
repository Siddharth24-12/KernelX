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
export interface PmuNodeSnapshot {
  nodeId: number; pid: number; name: string; state: ProcessState; priority: number
  arrivalTime: number; burstTime: number; remainingTime: number; memoryRequirement: number
  parentPid: number; completionTime: number; waitingTime: number; turnaroundTime: number
  responseTime: number; nextNodeId: number | null
}
export interface PmuListSnapshot {
  listId: string; headNodeId: number | null; tailNodeId: number | null
  size: number; nodes: PmuNodeSnapshot[]; truncated: boolean
}
export type PmuStepKind = 'NODE_VISIT' | 'SEARCH_COMPARE' | 'NODE_CREATE' | 'POINTER_UPDATE' | 'HEAD_UPDATE' | 'TAIL_UPDATE' | 'INSERT' | 'DELETE' | 'OPERATION_COMPLETE'
export interface PmuTraceStep {
  sequence: number; kind: PmuStepKind; pid: number | null; nodeId: number | null; position: number | null
  ownerNodeId: number | null; oldNextNodeId: number | null; newNextNodeId: number | null
  oldHeadNodeId: number | null; newHeadNodeId: number | null
  oldTailNodeId: number | null; newTailNodeId: number | null
  result: boolean | null; node: PmuNodeSnapshot | null; description: string
}
export interface PmuTraceSummary {
  traceId: string; listId: string; operation: 'INSERT' | 'TRAVERSE' | 'SEARCH' | 'DELETE'
  targetPid: number | null; simulationTime: number | null; recordedAt: string
  stepCount: number; result: boolean | null; truncated: boolean; description: string | null
}
export interface PmuTrace extends PmuTraceSummary {
  beforeSnapshot: PmuListSnapshot; afterSnapshot: PmuListSnapshot; steps: PmuTraceStep[]
}
export interface AluEntrySnapshot {
  entryId: number; pid: number; name: string; state: ProcessState; priority: number; arrivalTime: number
  burstTime: number; remainingTime: number; memoryRequirement: number; parentPid: number; completionTime: number
  waitingTime: number; turnaroundTime: number; responseTime: number; nextEntryId: number | null
}
export interface AluBucketSnapshot { index: number; chainLength: number; entries: AluEntrySnapshot[]; truncated: boolean }
export interface AluTableSnapshot { tableId: string; capacity: number; size: number; loadFactor: number; buckets: AluBucketSnapshot[]; truncated: boolean }
export type AluStepKind = 'NODE_VISITED' | 'KEY_COMPARED' | 'COLLISION' | 'NODE_CREATED' | 'BUCKET_HEAD_UPDATED' | 'NEXT_POINTER_UPDATED' | 'VALUE_REPLACED' | 'ENTRY_REMOVED' | 'RESIZE_STARTED' | 'ENTRY_REHASHED' | 'RESIZE_COMPLETED' | 'OPERATION_COMPLETED'
export interface AluTraceStep {
  sequence: number; kind: AluStepKind; pid: number | null; entryId: number | null; bucketIndex: number | null
  oldBucketIndex: number | null; newBucketIndex: number | null; chainPosition: number | null; collisionChainLength: number | null
  spreadHash: number | null; oldCapacity: number | null; newCapacity: number | null; ownerEntryId: number | null
  oldNextEntryId: number | null; newNextEntryId: number | null; oldBucketHeadEntryId: number | null
  newBucketHeadEntryId: number | null; result: boolean | null; entry: AluEntrySnapshot | null; description: string
}
export interface AluTraceSummary {
  traceId: string; tableId: string; operation: 'PUT' | 'GET' | 'REMOVE'; pid: number; spreadHash: number
  bucketIndex: number; simulationTime: number | null; recordedAt: string; stepCount: number
  result: boolean | null; truncated: boolean; description: string
}
export interface AluTrace extends AluTraceSummary {
  beforeSnapshot: AluTableSnapshot | null; afterSnapshot: AluTableSnapshot | null
  bucketBefore: AluBucketSnapshot | null; bucketAfter: AluBucketSnapshot | null; steps: AluTraceStep[]
}
export interface FpbProcessSnapshot { pid: number; name: string; priority: number; arrivalTime: number; burstTime: number; remainingTime: number }
export interface FpbQueueNodeSnapshot { nodeId: number; process: FpbProcessSnapshot; nextNodeId: number | null }
export interface FpbQueueSnapshot { queueId: string; size: number; frontNodeId: number | null; rearNodeId: number | null; nodes: FpbQueueNodeSnapshot[]; truncated: boolean }
export interface FpbLiveSnapshot { active: boolean; queue: FpbQueueSnapshot | null; message: string }
export type FpbOperation = 'ENQUEUE' | 'DEQUEUE'
export interface FpbTraceStep {
  sequence: number; operation: FpbOperation; pid: number; sizeBefore: number; sizeAfter: number
  oldFrontNodeId: number | null; newFrontNodeId: number | null; oldRearNodeId: number | null; newRearNodeId: number | null
  process: FpbProcessSnapshot; queueAfter: FpbQueueSnapshot; description: string
}
export interface FpbTraceSummary {
  traceId: string; schedulingRunId: string; queueId: string; algorithm: 'FCFS' | 'ROUND_ROBIN'
  processCount: number; operationCount: number; startedAt: string; completedAt: string | null
  complete: boolean; truncated: boolean
}
export interface FpbTrace extends FpbTraceSummary {
  initialQueue: FpbQueueSnapshot; finalQueue: FpbQueueSnapshot; steps: FpbTraceStep[]
}
export interface PtuNodeSnapshot { nodeId: number; pid: number; name: string; state: ProcessState | string; parentPid: number; firstChildPid: number | null; nextSiblingPid: number | null }
export interface PtuSnapshot { size: number; rootCount: number; rootPids: number[]; nodes: PtuNodeSnapshot[]; truncated: boolean }
export interface PtuTraceStep { sequence: number; operation: string; currentPid: number | null; parentPid: number | null; firstChildBefore: number | null; firstChildAfter: number | null; nextSiblingBefore: number | null; nextSiblingAfter: number | null; visitedPid: number | null; pointerChange: string | null; pointerBeforePid: number | null; pointerAfterPid: number | null; description: string }
export interface PtuTraceSummary { traceId: string; operation: string; targetPid: number | null; recordedAt: string; stepCount: number; truncated: boolean }
export interface PtuTrace extends PtuTraceSummary { finalTree: PtuNodeSnapshot[]; steps: PtuTraceStep[] }
export interface ApiError { timestamp: string; status: number; error: string; message: string; path: string }
