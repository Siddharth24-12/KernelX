import { useMemo } from 'react'
import { ArrowLeft, ArrowRight, Play, Pause, RefreshCw } from 'lucide-react'
import { Button, Empty, ErrorBanner, Loading } from '../common'
import type { AluTableSnapshot, AluTrace, AluTraceSummary } from '../../types/api'

export function AluWorkbench({ snapshot, traces, trace, selectedTraceId, bucketIndex, stepIndex, loading, traceLoading, playing, error,
  onRefresh, onSelectTrace, onSelectBucket, onStep, onTogglePlay, onFocus }: {
  snapshot: AluTableSnapshot | null; traces: AluTraceSummary[]; trace: AluTrace | null; selectedTraceId: string; bucketIndex: number | null
  stepIndex: number; loading: boolean; traceLoading: boolean; playing: boolean; error: string
  onRefresh: () => void; onSelectTrace: (id: string) => void; onSelectBucket: (index: number | null) => void
  onStep: (index: number) => void; onTogglePlay: () => void; onFocus: () => void
}) {
  const active = trace && stepIndex >= 0 ? trace.steps[stepIndex] : null
  const buckets = useMemo(() => snapshot?.buckets ?? [], [snapshot])
  return <section className="pmu-workbench alu-workbench" aria-label="Associative Lookup Unit">
    <div className="pmu-workbench-head"><div><span className="chip-serial">CPU INTERNALS / PID INDEX</span><h2>ASSOCIATIVE LOOKUP UNIT</h2><p>Actual separate-chaining table used by ProcessManager for PID lookup.</p></div><div className="pmu-workbench-actions"><Button variant="quiet" onClick={onFocus}>Focus ALU</Button><Button variant="quiet" onClick={onRefresh} disabled={loading}><RefreshCw size={15}/> Refresh</Button></div></div>
    {error && <ErrorBanner message={error} onRetry={onRefresh}/>}
    {loading && !snapshot ? <Loading label="Reading live PID table…"/> : snapshot && <>
      <div className="alu-metrics"><div><small>CAPACITY</small><b>{snapshot.capacity}</b></div><div><small>ENTRIES</small><b>{snapshot.size}</b></div><div><small>LOAD FACTOR</small><b>{snapshot.loadFactor.toFixed(3)}</b></div><div><small>OCCUPIED BUCKETS</small><b>{snapshot.buckets.filter((b) => b.chainLength > 0).length}</b></div><div><small>NONEMPTY COLLISION CHAINS</small><b>{snapshot.buckets.filter((b) => b.chainLength > 1).length}</b></div></div>
      {snapshot.size === 0 ? <Empty title="PID table is empty" message="Create a process in Process Manager to populate the actual lookup table."/> : <div className="alu-bucket-grid" aria-label="Live bucket distribution">{buckets.map((bucket) => <button key={bucket.index} className={`alu-bucket ${bucketIndex === bucket.index ? 'selected' : ''} ${bucket.chainLength > 1 ? 'collision' : ''}`} onClick={() => onSelectBucket(bucketIndex === bucket.index ? null : bucket.index)} aria-label={`Bucket ${bucket.index}, ${bucket.chainLength} entries`}><small>{String(bucket.index).padStart(2,'0')}</small><span>{bucket.chainLength ? bucket.entries.map((e) => `P${e.pid}`).join(' → ') : '—'}</span></button>)}</div>}
      {bucketIndex !== null && <div className="alu-selected-chain"><b>BUCKET {bucketIndex} / CHAIN ORDER</b>{buckets.find((b) => b.index === bucketIndex)?.entries.map((entry, index) => <span key={entry.entryId}>{index + 1}. P{entry.pid} · {entry.name} · {entry.state} · next {entry.nextEntryId ?? 'NULL'}</span>) ?? <span>Bucket not present in the current render window.</span>}</div>}
      {snapshot.truncated && <p className="trace-truncated">Snapshot rendering is bounded; some bucket or entry details are omitted.</p>}
    </>}
    <div className="alu-replay"><div className="internals-run-select"><label htmlFor="alu-trace-select">RECORDED TABLE OPERATION</label><select id="alu-trace-select" value={selectedTraceId} onChange={(e) => onSelectTrace(e.target.value)}><option value="">Select an actual PID table operation</option>{traces.map((item) => <option key={item.traceId} value={item.traceId}>{item.operation} P{item.pid} · bucket {item.bucketIndex} · {new Date(item.recordedAt).toLocaleTimeString()}</option>)}</select></div>
      {traceLoading ? <Loading label="Reading historical operation…"/> : trace ? <><div className="alu-playback"><Button variant="quiet" aria-label="Previous ALU step" onClick={() => onStep(stepIndex - 1)} disabled={stepIndex <= 0}><ArrowLeft size={15}/></Button><Button variant="quiet" aria-label={playing ? 'Pause ALU replay' : 'Play ALU replay'} onClick={onTogglePlay} disabled={!trace.steps.length}>{playing ? <Pause size={15}/> : <Play size={15}/>} {playing ? 'Pause' : 'Play'}</Button><Button variant="quiet" aria-label="Next ALU step" onClick={() => onStep(stepIndex + 1)} disabled={stepIndex >= trace.steps.length - 1}><ArrowRight size={15}/></Button><span>{active ? `${active.sequence} / ${trace.steps.length} · ${active.kind.replaceAll('_',' ')}` : `${trace.operation} P${trace.pid} · ${trace.description}`}</span></div><div className="alu-step-list" role="list" aria-label="Recorded ALU steps">{trace.steps.map((step, i) => <button role="listitem" key={step.sequence} className={i === stepIndex ? 'active' : ''} onClick={() => onStep(i)}><code>{String(step.sequence).padStart(3,'0')}</code><b>{step.kind.replaceAll('_',' ')}</b><span>{step.description}</span></button>)}</div><p className="alu-readonly">Historical view · read only. Replaying never changes the live table.</p></> : !traces.length ? <Empty title="No recorded PID operations" message="Process creation, lookup and deletion will appear here as actual table operations."/> : null}
    </div>
  </section>
}
