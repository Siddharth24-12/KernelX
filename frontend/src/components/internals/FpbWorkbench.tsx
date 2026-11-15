import { ArrowLeft, ArrowRight, Pause, Play, RefreshCw, RotateCcw } from 'lucide-react'
import { Button, Empty, ErrorBanner, Loading } from '../common'
import type { FpbLiveSnapshot, FpbQueueSnapshot, FpbTrace, FpbTraceSummary } from '../../types/api'

export function fpbQueueAtStep(trace: FpbTrace, index: number): FpbQueueSnapshot {
  return index < 0 ? trace.initialQueue : trace.steps[Math.min(index, trace.steps.length - 1)]?.queueAfter ?? trace.initialQueue
}

export function FpbWorkbench({ live, traces, trace, selectedTraceId, stepIndex, playing, loading, traceLoading, error,
  onRefresh, onSelectTrace, onStep, onTogglePlay, onFocus }: {
  live: FpbLiveSnapshot | null; traces: FpbTraceSummary[]; trace: FpbTrace | null; selectedTraceId: string; stepIndex: number
  playing: boolean; loading: boolean; traceLoading: boolean; error: string
  onRefresh: () => void; onSelectTrace: (id: string) => void; onStep: (index: number) => void
  onTogglePlay: () => void; onFocus: () => void
}) {
  const queue = trace ? fpbQueueAtStep(trace, stepIndex) : null
  const active = trace && stepIndex >= 0 ? trace.steps[stepIndex] ?? null : null
  return <section className="pmu-workbench fpb-workbench" aria-label="FIFO Process Buffer">
    <div className="pmu-workbench-head"><div><span className="chip-serial">CPU INTERNALS / SCHEDULER READY SET</span><h2>FIFO PROCESS BUFFER</h2><p>The historical FCFS or Round Robin queue captured from the scheduler’s actual Java linked FIFO.</p></div><div className="pmu-workbench-actions"><Button variant="quiet" onClick={onFocus}>Focus FPB</Button><Button variant="quiet" onClick={onRefresh} disabled={loading}><RefreshCw size={15}/> Refresh history</Button></div></div>
    {error && <ErrorBanner message={error} onRetry={onRefresh}/>}
    {live?.active ? <div className="fpb-live-state">ACTIVE QUEUE · {live.queue?.size ?? 0} entries</div> : <div className="fpb-inactive-state">NO LIVE QUEUE · scheduler queues are temporary. The view below is historical replay data.</div>}
    {loading && !live ? <Loading label="Reading FIFO trace history…"/> : <>
      <div className="internals-run-select"><label htmlFor="fpb-trace-select">FIFO SCHEDULING RUN</label><select id="fpb-trace-select" value={selectedTraceId} onChange={(event) => onSelectTrace(event.target.value)} disabled={!traces.length || traceLoading}>
        <option value="">Select a recorded FCFS or Round Robin run</option>{traces.map((item) => <option value={item.traceId} key={item.traceId}>{item.algorithm} · {item.processCount} processes · {item.operationCount} operations · {new Date(item.startedAt).toLocaleString()}</option>)}
      </select></div>
      {traceLoading ? <Loading label="Reading recorded FIFO operations…"/> : trace ? <>
        <div className="fpb-provenance"><span>ALGORITHM</span><b>{trace.algorithm}</b><span>RUN ID</span><code>{trace.schedulingRunId}</code><span>TRACE ID</span><code>{trace.traceId}</code><span>QUEUE SIZE</span><b>{queue?.size ?? 0}</b></div>
        <div className="fpb-buffer" role="list" aria-label="Historical FIFO queue">
          <div className="fpb-pointer-row"><span>FRONT</span><span>REAR</span></div>
          {queue?.nodes.length ? <div className="fpb-nodes">{queue.nodes.map((node) => <div className={`fpb-node ${node.nodeId === queue.frontNodeId ? 'front' : ''} ${node.nodeId === queue.rearNodeId ? 'rear' : ''} ${active?.pid === node.process.pid ? 'active' : ''}`} role="listitem" key={node.nodeId}>
            {node.nodeId === queue.frontNodeId && <small>FRONT</small>}<b>P{node.process.pid}</b><span>{node.process.name}</span><code>remaining {node.process.remainingTime}</code>{node.nodeId === queue.rearNodeId && <small>REAR</small>}
          </div>)}</div> : <div className="fpb-empty-queue">QUEUE EMPTY AT THIS RECORDED STEP</div>}
          {queue?.truncated && <p className="trace-truncated">Queue snapshot is bounded; the omitted tail is not rendered.</p>}
        </div>
        <div className="fpb-controls"><Button variant="quiet" aria-label="Reset FPB replay" onClick={() => onStep(-1)} disabled={!trace.steps.length}><RotateCcw size={14}/></Button><Button variant="quiet" aria-label="Previous FPB operation" onClick={() => onStep(stepIndex - 1)} disabled={stepIndex < 0}><ArrowLeft size={15}/></Button><Button variant="quiet" aria-label={playing ? 'Pause FPB replay' : 'Play FPB replay'} onClick={onTogglePlay} disabled={!trace.steps.length}>{playing ? <Pause size={14}/> : <Play size={14}/>} {playing ? 'Pause' : 'Play'}</Button><Button variant="quiet" aria-label="Next FPB operation" onClick={() => onStep(stepIndex + 1)} disabled={stepIndex >= trace.steps.length - 1}><ArrowRight size={15}/></Button><span>{active ? `STEP ${active.sequence} / ${trace.steps.length} · ${active.operation}` : `INITIAL QUEUE · ${trace.initialQueue.size} entries`}</span></div>
        {active && <div className="fpb-step-detail"><b>{active.operation} · P{active.pid}</b><span>{active.description}</span><code>size {active.sizeBefore} → {active.sizeAfter} · front {active.oldFrontNodeId ?? 'NULL'} → {active.newFrontNodeId ?? 'NULL'} · rear {active.oldRearNodeId ?? 'NULL'} → {active.newRearNodeId ?? 'NULL'}</code></div>}
        <div className="alu-step-list" role="list" aria-label="Recorded FIFO operations">{trace.steps.map((step, index) => <button role="listitem" key={step.sequence} className={index === stepIndex ? 'active' : ''} onClick={() => onStep(index)}><code>{String(step.sequence).padStart(3, '0')}</code><b>{step.operation}</b><span>P{step.pid} · queue {step.sizeBefore} → {step.sizeAfter}</span></button>)}</div>
        <p className="alu-readonly">Historical scheduler queue · read only. Playback selects snapshots recorded from the Java queue; it does not run the scheduler again.</p>
        {trace.truncated && <p className="trace-truncated">The backend trace reached a configured step or per-snapshot bound.</p>}
      </> : traces.length ? null : <Empty title="No recorded FIFO runs" message="Run an FCFS or Round Robin simulation to capture the scheduler’s actual enqueue and dequeue operations."/>}
    </>}
  </section>
}
