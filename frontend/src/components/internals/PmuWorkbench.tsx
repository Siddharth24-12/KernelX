import { ArrowLeft, ArrowRight, Camera, Pause, Play, RefreshCw, RotateCcw } from 'lucide-react'
import { Button, Empty, ErrorBanner, Loading } from '../common'
import type { PmuListSnapshot, PmuTrace, PmuTraceStep, PmuTraceSummary } from '../../types/api'

type ViewMode = 'LIVE' | 'HISTORICAL'

export function PmuWorkbench({ snapshot, traces, trace, selectedTraceId, stepIndex, mode, playing,
  loading, traceLoading, error, onRefresh, onSelectTrace, onStep, onModeChange, onTogglePlay,
  onFocus, onResetCamera,
}: {
  snapshot: PmuListSnapshot | null; traces: PmuTraceSummary[]; trace: PmuTrace | null; selectedTraceId: string
  stepIndex: number; mode: ViewMode; playing: boolean; loading: boolean; traceLoading: boolean; error: string
  onRefresh: () => void; onSelectTrace: (id: string) => void; onStep: (step: number) => void
  onModeChange: (mode: ViewMode) => void; onTogglePlay: () => void; onFocus: () => void; onResetCamera: () => void
}) {
  const current = trace && stepIndex >= 0 ? trace.steps[stepIndex] ?? null : null
  const displaySnapshot = mode === 'HISTORICAL' && trace
    ? current && (trace.steps.slice(0, stepIndex + 1).some((step) => step.kind === 'POINTER_UPDATE' || step.kind === 'HEAD_UPDATE'))
      ? trace.afterSnapshot : trace.beforeSnapshot
    : snapshot

  return <section className="pmu-workbench" aria-label="PCB Memory Unit inspector">
    <div className="pmu-workbench-head">
      <div><span className="chip-serial">PROCESS MANAGER · ACTUAL JAVA LINKED LIST</span><h2>PCB Memory Unit</h2>
        <p>Conceptual hardware view of ProcessManager’s custom singly linked list. Node IDs are logical handles, not physical addresses.</p></div>
      <div className="pmu-workbench-actions">
        <Button variant="quiet" onClick={onFocus}><Camera size={14} /> Focus PMU</Button>
        <Button variant="quiet" onClick={onResetCamera}><RotateCcw size={14} /> Reset camera</Button>
      </div>
    </div>
    {error && <ErrorBanner message={error} onRetry={onRefresh} />}
    <div className="pmu-mode-bar">
      <div className="pmu-mode-switch" role="group" aria-label="PMU view mode">
        <Button variant={mode === 'LIVE' ? 'primary' : 'quiet'} onClick={() => onModeChange('LIVE')}>Live list</Button>
        <Button variant={mode === 'HISTORICAL' ? 'primary' : 'quiet'} onClick={() => onModeChange('HISTORICAL')}>Recorded replay</Button>
      </div>
      <div className="pmu-trace-select"><label htmlFor="pmu-trace-select">RECORDED PROCESS-LIST OPERATION</label>
        <select id="pmu-trace-select" value={selectedTraceId} onChange={(event) => onSelectTrace(event.target.value)} disabled={!traces.length || traceLoading}>
          <option value="">Select a recorded trace</option>{traces.map((item) => <option key={item.traceId} value={item.traceId}>
            {item.operation}{item.targetPid === null ? '' : ` · P${item.targetPid}`} · {item.stepCount} steps · {new Date(item.recordedAt).toLocaleTimeString()}
          </option>)}
        </select>
      </div>
      <Button variant="quiet" onClick={onRefresh} disabled={loading || traceLoading}><RefreshCw size={14} /> Refresh list</Button>
    </div>

    <div className="pmu-status-strip">
      <span className={`history-tag ${mode === 'LIVE' ? 'history-ready' : ''}`}>{mode === 'LIVE' ? 'CURRENT LIVE SNAPSHOT' : 'HISTORICAL REPLAY · READ ONLY'}</span>
      {snapshot ? <><span>LIST {snapshot.listId.slice(0, 8)}</span><span>HEAD {snapshot.headNodeId === null ? 'NULL' : `N${snapshot.headNodeId}`}</span><span>TAIL {snapshot.tailNodeId === null ? 'NULL' : `N${snapshot.tailNodeId}`}</span><span>{snapshot.size} PCBS</span></>
        : <span>Live list snapshot unavailable</span>}
    </div>

    {loading && !snapshot ? <Loading label="Reading the live PCB list snapshot…" /> : <div className="pmu-workbench-grid">
      <section className="pmu-operation-panel" aria-label="PMU operation inspector">
        {mode === 'LIVE' ? <>
          <div className="pmu-panel-title"><span>LIVE LINKED-LIST SNAPSHOT</span><b>{snapshot?.size ?? 0} NODES</b></div>
          {!snapshot || snapshot.size === 0 ? <Empty title="Empty PCB list" message="Create a process from Process Manager to add a real linked-list node." /> :
            <div className="pmu-live-nodes" role="list" aria-label="Live linked-list nodes">{snapshot.nodes.map((node, index) => <div key={node.nodeId} className="pmu-live-node" role="listitem">
              <b>{index === 0 ? 'HEAD' : 'NODE'}</b><code>N{node.nodeId} · P{node.pid}</code><span>{node.name}</span><small>{node.state} · priority {node.priority} · next {node.nextNodeId === null ? 'NULL' : `N${node.nextNodeId}`}</small>
              {index === 0 && <i>HEAD</i>}
            </div>)}</div>}
          {snapshot?.truncated && <p className="pmu-limit-note">The live snapshot is truncated by the API response limit.</p>}
        </> : traceLoading ? <Loading label="Reading recorded linked-list operation…" /> : trace ? <>
          <div className="pmu-panel-title"><span>TRACE OPERATION</span><b>{current ? `${current.sequence} / ${trace.steps.length}` : 'BEFORE FIRST STEP'}</b></div>
          <div className="pmu-playback-controls">
            <Button variant="quiet" aria-label="Reset PMU replay" onClick={() => onStep(-1)} disabled={!trace.steps.length}><RotateCcw size={14} /></Button>
            <Button variant="quiet" aria-label="Previous PMU operation" onClick={() => onStep(stepIndex - 1)} disabled={stepIndex < 0}><ArrowLeft size={15} /></Button>
            <Button variant="quiet" aria-label={playing ? 'Pause PMU replay' : 'Play PMU replay'} onClick={onTogglePlay} disabled={!trace.steps.length}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? 'Pause' : 'Play'}</Button>
            <Button variant="quiet" aria-label="Next PMU operation" onClick={() => onStep(stepIndex + 1)} disabled={stepIndex >= trace.steps.length - 1}><ArrowRight size={15} /></Button>
          </div>
          <input className="pmu-range" aria-label="PMU recorded operation position" type="range" min="-1" max={Math.max(-1, trace.steps.length - 1)} value={stepIndex} onChange={(event) => onStep(Number(event.target.value))} />
          {current ? <>
            <div className="pmu-inspector-facts">
              <div><small>OPERATION</small><b>{current.kind.replaceAll('_', ' ')}</b></div>
              <div><small>PID</small><b>{current.pid === null ? '—' : `P${current.pid}`}</b></div>
              <div><small>NODE</small><b>{current.nodeId === null ? '—' : `N${current.nodeId}`}</b></div>
              <div><small>POSITION</small><b>{current.position ?? '—'}</b></div>
              <div><small>SIM TICK</small><b>{trace.simulationTime === null ? '—' : `T+${trace.simulationTime}`}</b></div>
              <div><small>TRACE ID</small><b title={trace.traceId}>{trace.traceId.slice(0, 8)}</b></div>
            </div>
            {(current.kind === 'POINTER_UPDATE' || current.kind === 'HEAD_UPDATE' || current.kind === 'TAIL_UPDATE') && <div className="pmu-pointer-change">
              <span>{current.kind.replaceAll('_', ' ')}</span>
              <b>{current.kind === 'POINTER_UPDATE' ? `N${current.ownerNodeId} .next` : current.kind.replace('_UPDATE', '')}</b>
              <code>{pointerValue(current)} <ArrowRight size={13} /> {pointerNewValue(current)}</code>
            </div>}
            {current.kind === 'SEARCH_COMPARE' && <div className="pmu-pointer-change"><span>PID COMPARISON</span><b>{current.result ? 'MATCH' : 'NO MATCH'}</b><code>Requested P{trace.targetPid} · visited P{current.node?.pid}</code></div>}
            {current.kind === 'NODE_VISIT' && <div className="pmu-pointer-change"><span>ACTUAL VISIT</span><b>NODE {current.position}</b><code>N{current.nodeId} · P{current.pid}</code></div>}
            <p className="pmu-step-description">{current.description}</p>
          </> : <p className="pmu-step-description">Replay begins from the captured before-operation snapshot. Advance to view only recorded visits and pointer changes.</p>}
        </> : <Empty title="Select a recorded operation" message="Process creation, normal process listing, and termination record operations from the actual custom linked list." />}
      </section>

      <section className="pmu-trace-panel" aria-label="PMU recorded operations">
        <div className="pmu-panel-title"><span>BOUNDED IN-MEMORY OPERATION HISTORY</span><b>{traces.length} / 32 TRACES</b></div>
        {trace ? <div className="pmu-trace-meta"><span>TRACE {trace.traceId.slice(0, 8)}</span><span>{trace.operation}{trace.targetPid === null ? '' : ` · P${trace.targetPid}`}</span><span>{trace.result === null ? 'IN PROGRESS' : trace.result ? 'SUCCESS' : 'NOT FOUND'}</span></div> : null}
        {trace ? <div className="pmu-trace-rows" role="list" aria-label="Recorded linked-list steps">{trace.steps.length ? trace.steps.map((step, index) => <button key={step.sequence} role="listitem" className={`pmu-trace-row ${index === stepIndex ? 'pmu-trace-row-active' : ''}`} onClick={() => onStep(index)}>
          <span>{String(step.sequence).padStart(3, '0')}</span><b>{step.kind.replaceAll('_', ' ')}</b><span>{step.pid === null ? '—' : `P${step.pid}`}</span><small>{step.nodeId === null ? '—' : `N${step.nodeId}`}</small>
        </button>) : <Empty title="No recorded steps" message="This operation completed without traversing or changing a node." />}</div>
          : <div className="pmu-trace-rows pmu-trace-list" role="list" aria-label="Recent linked-list traces">{traces.length ? traces.slice().reverse().map((item) => <button key={item.traceId} role="listitem" className="pmu-trace-row" onClick={() => onSelectTrace(item.traceId)}>
            <span>{item.operation}</span><b>{item.targetPid === null ? item.description ?? 'List traversal' : `P${item.targetPid}`}</b><span>{item.stepCount} steps</span><small>{new Date(item.recordedAt).toLocaleTimeString()}</small>
          </button>) : <Empty title="No PMU traces yet" message="Create, list, or terminate processes through normal KernelX workflows." />}</div>}
        {trace?.truncated && <p className="pmu-limit-note">This trace or its node snapshots reached the backend bound; replay covers only recorded data.</p>}
        {displaySnapshot && mode === 'HISTORICAL' && <p className="pmu-limit-note">Displayed node sequence is historical. The current live list remains available in the Live list view above.</p>}
      </section>
    </div>}
  </section>
}

function pointerValue(step: PmuTraceStep): string {
  const value = step.kind === 'POINTER_UPDATE' ? step.oldNextNodeId : step.kind === 'HEAD_UPDATE' ? step.oldHeadNodeId : step.oldTailNodeId
  return value === null ? 'NULL' : `N${value}`
}

function pointerNewValue(step: PmuTraceStep): string {
  const value = step.kind === 'POINTER_UPDATE' ? step.newNextNodeId : step.kind === 'HEAD_UPDATE' ? step.newHeadNodeId : step.newTailNodeId
  return value === null ? 'NULL' : `N${value}`
}
