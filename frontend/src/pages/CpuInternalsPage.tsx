import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Camera, Cpu, Pause, Play, RefreshCw, RotateCcw } from 'lucide-react'
import { heapTracesApi } from '../api/heapTraces'
import { errorMessage } from '../api/client'
import { Button, Empty, ErrorBanner, Loading, PageIntro } from '../components/common'
import { ProcessorDieScene } from '../components/internals/ProcessorDieScene'
import { heapOperationLabel, projectRecordedHeap } from './cpuInternalsReplay'
import type { HeapRunSummary, HeapRunTrace } from '../types/api'

export function CpuInternalsPage() {
  const [runs, setRuns] = useState<HeapRunSummary[]>([]); const [runId, setRunId] = useState(''); const [trace, setTrace] = useState<HeapRunTrace | null>(null)
  const [stepIndex, setStepIndex] = useState(-1); const [focused, setFocused] = useState(false); const [resetKey, setResetKey] = useState(0)
  const [loading, setLoading] = useState(true); const [traceLoading, setTraceLoading] = useState(false); const [playing, setPlaying] = useState(false); const [error, setError] = useState('')
  const loadRuns = useCallback(async () => {
    setError('')
    try {
      const values = await heapTracesApi.runs(); setRuns(values)
      if (values.length && !values.some((run) => run.runId === runId)) setRunId(values[values.length - 1].runId)
      if (!values.length) { setRunId(''); setTrace(null); setStepIndex(-1) }
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setLoading(false) }
  }, [runId])
  useEffect(() => { void loadRuns() }, [loadRuns])
  useEffect(() => {
    if (!runId) return
    let cancelled = false
    setTraceLoading(true); setPlaying(false)
    heapTracesApi.run(runId).then((value) => { if (!cancelled) { setTrace(value); setStepIndex(value.steps.length - 1) } })
      .catch((cause) => { if (!cancelled) setError(errorMessage(cause)) })
      .finally(() => { if (!cancelled) setTraceLoading(false) })
    return () => { cancelled = true }
  }, [runId])
  useEffect(() => {
    if (!playing || !trace) return
    const timer = window.setInterval(() => setStepIndex((index) => {
      if (index >= trace.steps.length - 1) { setPlaying(false); return index }
      return index + 1
    }), 760)
    return () => window.clearInterval(timer)
  }, [playing, trace])

  const current = trace && stepIndex >= 0 ? trace.steps[stepIndex] ?? null : null
  const heap = useMemo(() => trace ? projectRecordedHeap(trace, stepIndex) : [], [trace, stepIndex])
  const changeRun = (next: string) => { setRunId(next); setTrace(null); setError('') }
  const resetCamera = () => setResetKey((key) => key + 1)
  const goToStep = (index: number) => { setPlaying(false); setStepIndex(Math.max(-1, Math.min(trace?.steps.length ?? 0, index))) }
  const operationTitle = heapOperationLabel(current)
  const openFocused = () => setFocused(true)

  return <div className="cpu-internals-page">
    <PageIntro eyebrow="DSA LAB / PROCESSOR EXPLORER" title="CPU INTERNALS" description="Explore KernelX’s scheduler structures inside an exposed processor die. Heap playback is a historical record of real Java operations." action={<div className="internals-intro-actions"><span className="internals-mode"><i /> RECORDED RUN REPLAY</span><Link className="button button-quiet" to="/scheduler"><Cpu size={15} /> Open CPU Scheduler</Link></div>} />
    {error && <ErrorBanner message={error} onRetry={() => void loadRuns()} />}
    <div className="internals-toolbar"><div className="internals-run-select"><label htmlFor="heap-run-select">SCHEDULING RUN</label><select id="heap-run-select" value={runId} onChange={(event) => changeRun(event.target.value)} disabled={!runs.length || traceLoading}><option value="">No recorded heap run</option>{runs.map((run) => <option value={run.runId} key={run.runId}>{run.algorithm} · {run.processCount} processes · {new Date(run.startedAt).toLocaleString()}</option>)}</select></div><div className="internals-toolbar-actions"><span className="live-heap-note">LIVE RUNTIME HAS NO PERSISTENT HEAP · REPLAY IS READ ONLY</span><Button variant="quiet" onClick={() => void loadRuns()} disabled={loading || traceLoading}><RefreshCw size={15} /> Refresh history</Button></div></div>

    <div className={`internals-workspace ${focused ? 'internals-focused' : ''}`}>
      <section className="processor-stage" aria-label="Interactive CPU die">
        <div className="processor-stage-top"><div><span className="chip-serial">KERNELX · SILICON ARCHITECTURE EXPLORER</span><b>{focused ? 'PRIORITY DISPATCH UNIT' : 'PROCESSOR DIE / SYSTEM INTERCONNECT'}</b></div><div className="camera-controls">{focused && <Button variant="quiet" onClick={() => setFocused(false)}><ArrowLeft size={14} /> Back to Processor</Button>}<Button variant="quiet" onClick={resetCamera} aria-label="Reset camera"><Camera size={14} /> Reset camera</Button></div></div>
        <div className="die-canvas"><ProcessorDieScene focused={focused} resetKey={resetKey} entries={heap} active={current} onFocus={openFocused} /><div className="die-hint">DRAG · ORBIT &nbsp; / &nbsp; SCROLL · ZOOM &nbsp; / &nbsp; RIGHT DRAG · PAN</div></div>
        {!focused && <button className="focus-hotspot" onClick={openFocused}><span>01 / PRIORITY DISPATCH UNIT</span><b>Focus module <ArrowRight size={14} /></b></button>}
      </section>
      <aside className="operation-inspector">
        <div className="inspector-head"><div><span className="chip-serial">HEAP TRACE INSPECTOR</span><h2>Operation sequence</h2></div><span className={`history-tag ${trace ? 'history-ready' : ''}`}>{trace ? 'HISTORICAL' : 'NO TRACE'}</span></div>
        {loading || traceLoading ? <Loading label="Reading recorded scheduler operations…" /> : trace ? <>
          <div className="run-provenance"><span>RUN ID</span><code>{trace.runId}</code><span>ALGORITHM</span><b>{trace.algorithm}{trace.preemptive ? ' · PREEMPTIVE' : ''}</b><span>PROCESSES</span><b>{trace.processCount}</b></div>
          <div className="trace-playback"><div className="trace-state"><span>{operationTitle}</span><b>{current ? `STEP ${current.sequence} / ${trace.steps.length}` : 'INITIAL HEAP STATE'}</b></div>
            <div className="playback-buttons"><Button variant="quiet" aria-label="Reset replay" title="Reset replay" onClick={() => goToStep(-1)} disabled={!trace.steps.length}><RotateCcw size={15} /></Button><Button variant="quiet" aria-label="Previous operation" onClick={() => goToStep(stepIndex - 1)} disabled={stepIndex < 0}><ArrowLeft size={16} /></Button><Button variant="quiet" aria-label={playing ? 'Pause replay' : 'Play replay'} onClick={() => { if (stepIndex >= trace.steps.length - 1) setStepIndex(-1); setPlaying((value) => !value) }} disabled={!trace.steps.length}>{playing ? <Pause size={15} /> : <Play size={15} />}{playing ? 'Pause' : 'Play'}</Button><Button variant="quiet" aria-label="Next operation" onClick={() => goToStep(stepIndex + 1)} disabled={stepIndex >= trace.steps.length - 1}><ArrowRight size={16} /></Button></div>
            <input aria-label="Recorded operation position" className="trace-range" type="range" min="-1" max={Math.max(-1, trace.steps.length - 1)} value={stepIndex} onChange={(event) => goToStep(Number(event.target.value))} />
          </div>
          {current ? <div className="operation-detail"><div className="operation-detail-title"><span>RECORDED OPERATION</span><b>{current.kind.replaceAll('_', ' ')}</b></div><div className="operation-facts"><div><small>PID</small><b>{current.pid === null ? '—' : `P${current.pid}`}</b></div><div><small>PRIORITY</small><b>{current.priority ?? '—'}</b></div><div><small>HEAP INDEX</small><b>{current.index ?? '—'}</b></div><div><small>SIM TICK</small><b>T+{current.simulationTime}</b></div></div>
              {current.kind === 'COMPARE' && <div className="trace-callout"><span>PARENT COMPARISON</span><p>Index {current.index} ({current.value?.name ?? '—'} · P{current.value?.pid ?? '—'}) vs index {current.otherIndex} ({current.otherValue?.name ?? '—'} · P{current.otherValue?.pid ?? '—'})</p><b>Comparator returned {current.comparisonResult}</b></div>}
              {current.kind === 'SWAP' && <div className="trace-callout"><span>HEAP SWAP</span><p>Move P{current.value?.pid} from slot {current.index} with P{current.otherValue?.pid} from slot {current.otherIndex}.</p></div>}
              {current.kind === 'INSERT' && <div className="trace-callout"><span>INCOMING DESCRIPTOR</span><p>{current.value?.name} · P{current.value?.pid} · priority {current.value?.priority} enters at the recorded array index.</p></div>}
              {current.kind === 'EXTRACT_MAX' && <div className="trace-callout"><span>ROOT REMOVAL</span><p>Extract P{current.value?.pid}; replacement from the final slot: {current.otherValue ? `P${current.otherValue.pid}` : 'none'}.</p></div>}
              {current.kind === 'UPDATE' && <div className="trace-callout"><span>PRIORITY UPDATE</span><p>P{current.value?.pid}: priority {current.value?.priority} → {current.otherValue?.priority}; heap repair follows the recorded comparator and swaps.</p></div>}
              {current.kind === 'HEAPIFY' && <div className="trace-callout"><span>INITIAL ARRAY</span><p>{current.values.length} entries provided to the actual bottom-up heapify operation.</p></div>}
            </div> : <div className="operation-empty"><strong>Replay reset</strong><span>Use Next or Play to apply the recorded backend steps to the visual projection.</span></div>}
          <div className="trace-history-head"><span>RECORDED STEPS</span><b>{trace.steps.length} / {trace.truncated ? 'TRUNCATED' : 'COMPLETE'}</b></div>
          <div className="trace-history" role="list" aria-label="Recorded heap operations">{trace.steps.length ? trace.steps.map((step, index) => <button key={step.sequence} role="listitem" className={`trace-row ${index === stepIndex ? 'trace-row-active' : ''}`} onClick={() => goToStep(index)}><span>{String(step.sequence).padStart(3, '0')}</span><b>{step.kind.replaceAll('_', ' ')}</b><span>{step.pid === null ? '—' : `P${step.pid}`}</span><small>T+{step.simulationTime}</small></button>) : <Empty title="No heap operations" message="This run did not produce heap operations." />}</div>
          {trace.truncated && <p className="trace-truncated">Trace reached the backend’s per-run bound. Only the recorded prefix is replayable.</p>}
          {!trace.steps.some((step) => step.kind === 'UPDATE') && <p className="trace-limit-note">No priority update was recorded: scheduler priorities are fixed in the run’s start snapshot. The custom heap’s update hook records changes only when the backend actually invokes it.</p>}
        </> : <Empty title="No recorded heap run" message="Start an SJF or Priority scheduling run in CPU Scheduler. Its actual heap operations will appear here after the backend finishes planning." />}
      </aside>
    </div>
    <div className="internals-footnote"><span>DIAGNOSTIC REPLAY · READ ONLY</span><span>Heap indices, comparisons and swaps are emitted by the Java implementation.</span></div>
  </div>
}

