import type { HeapEntrySnapshot, HeapRunTrace, HeapTraceStep } from '../types/api'

/** Applies only backend-recorded indices, insertions, replacements and swaps; it performs no heap comparisons. */
export function projectRecordedHeap(trace: HeapRunTrace, throughIndex: number): HeapEntrySnapshot[] {
  const heap: HeapEntrySnapshot[] = []
  for (const step of trace.steps.slice(0, throughIndex + 1)) {
    if (step.kind === 'HEAPIFY') heap.splice(0, heap.length, ...step.values)
    else if (step.kind === 'INSERT' && step.value && step.index !== null) heap[step.index] = step.value
    else if (step.kind === 'EXTRACT_MAX') {
      if (step.sizeAfter === 0) heap.splice(0)
      else {
        if (step.otherValue) heap[0] = step.otherValue
        if (step.sizeAfter !== null) heap.length = step.sizeAfter
      }
    } else if (step.kind === 'UPDATE' && step.otherValue && step.index !== null) heap[step.index] = step.otherValue
    else if (step.kind === 'SWAP' && step.index !== null && step.otherIndex !== null) {
      const value = heap[step.index]; heap[step.index] = heap[step.otherIndex]; heap[step.otherIndex] = value
    }
  }
  return heap
}

export function heapOperationLabel(step: HeapTraceStep | null): string {
  if (!step) return 'NO OPERATION SELECTED'
  if (step.kind === 'COMPARE') return `PARENT / CHILD COMPARISON · ${step.comparisonPhase ?? 'heap comparison'}`
  if (step.kind === 'SWAP') return `HEAP SWAP · INDEX ${step.index} ↔ ${step.otherIndex}`
  if (step.kind === 'INSERT') return `INSERT · INDEX ${step.index}`
  if (step.kind === 'EXTRACT_MAX') return 'EXTRACT MAX · ROOT'
  if (step.kind === 'UPDATE') return `PRIORITY UPDATE · INDEX ${step.index}`
  return 'BOTTOM-UP HEAPIFY'
}
