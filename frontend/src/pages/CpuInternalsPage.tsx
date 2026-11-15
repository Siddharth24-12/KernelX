import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Camera, Cpu, Pause, Play, RefreshCw, RotateCcw } from 'lucide-react'
import { heapTracesApi } from '../api/heapTraces'
import { pmuApi } from '../api/pmu'
import { aluApi } from '../api/alu'
import { fpbApi } from '../api/fpb'
import { ptuApi } from '../api/ptu'
import { errorMessage } from '../api/client'
import { Button, Empty, ErrorBanner, Loading, PageIntro } from '../components/common'
import { PmuWorkbench } from '../components/internals/PmuWorkbench'
import { AluWorkbench } from '../components/internals/AluWorkbench'
import { FpbWorkbench, fpbQueueAtStep } from '../components/internals/FpbWorkbench'
import { PtuWorkbench } from '../components/internals/PtuWorkbench'
import { heapOperationLabel, projectRecordedHeap } from './cpuInternalsReplay'
import { projectPmuTrace } from './pmuReplay'
import type { HeapRunSummary, HeapRunTrace, PmuListSnapshot, PmuTrace, PmuTraceSummary } from '../types/api'
import type { AluTableSnapshot, AluTrace, AluTraceSummary } from '../types/api'
import type { FpbLiveSnapshot, FpbTrace, FpbTraceSummary } from '../types/api'
import type { PtuSnapshot, PtuTrace, PtuTraceSummary } from '../types/api'

const ProcessorDieScene = lazy(() => import('../components/internals/ProcessorDieScene').then((module) => ({ default: module.ProcessorDieScene })))

export function CpuInternalsPage() {
  const [runs, setRuns] = useState<HeapRunSummary[]>([]); const [runId, setRunId] = useState(''); const [trace, setTrace] = useState<HeapRunTrace | null>(null)
  const [stepIndex, setStepIndex] = useState(-1); const [focused, setFocused] = useState(false); const [resetKey, setResetKey] = useState(0)
  const [loading, setLoading] = useState(true); const [traceLoading, setTraceLoading] = useState(false); const [playing, setPlaying] = useState(false); const [error, setError] = useState('')
  const [pmuSnapshot, setPmuSnapshot] = useState<PmuListSnapshot | null>(null); const [pmuTraces, setPmuTraces] = useState<PmuTraceSummary[]>([])
  const [pmuTrace, setPmuTrace] = useState<PmuTrace | null>(null); const [pmuTraceId, setPmuTraceId] = useState(''); const [pmuStep, setPmuStep] = useState(-1)
  const [pmuMode, setPmuMode] = useState<'LIVE' | 'HISTORICAL'>('LIVE'); const [pmuPlaying, setPmuPlaying] = useState(false)
  const [pmuLoading, setPmuLoading] = useState(true); const [pmuTraceLoading, setPmuTraceLoading] = useState(false); const [pmuError, setPmuError] = useState('')
  const [aluSnapshot, setAluSnapshot] = useState<AluTableSnapshot | null>(null); const [aluTraces, setAluTraces] = useState<AluTraceSummary[]>([])
  const [aluTrace, setAluTrace] = useState<AluTrace | null>(null); const [aluTraceId, setAluTraceId] = useState(''); const [aluStep, setAluStep] = useState(-1)
  const [aluBucket, setAluBucket] = useState<number | null>(null); const [aluPlaying, setAluPlaying] = useState(false)
  const [aluLoading, setAluLoading] = useState(true); const [aluTraceLoading, setAluTraceLoading] = useState(false); const [aluError, setAluError] = useState('')
  const [fpbLive, setFpbLive] = useState<FpbLiveSnapshot | null>(null); const [fpbTraces, setFpbTraces] = useState<FpbTraceSummary[]>([])
  const [fpbTrace, setFpbTrace] = useState<FpbTrace | null>(null); const [fpbTraceId, setFpbTraceId] = useState(''); const [fpbStep, setFpbStep] = useState(-1)
  const [fpbPlaying, setFpbPlaying] = useState(false); const [fpbLoading, setFpbLoading] = useState(true); const [fpbTraceLoading, setFpbTraceLoading] = useState(false); const [fpbError, setFpbError] = useState('')
  const [ptuSnapshot, setPtuSnapshot] = useState<PtuSnapshot | null>(null); const [ptuTraces, setPtuTraces] = useState<PtuTraceSummary[]>([])
  const [ptuTrace, setPtuTrace] = useState<PtuTrace | null>(null); const [ptuTraceId, setPtuTraceId] = useState(''); const [ptuStep, setPtuStep] = useState(-1)
  const [ptuLoading, setPtuLoading] = useState(true); const [ptuTraceLoading, setPtuTraceLoading] = useState(false); const [ptuError, setPtuError] = useState('')
  const [focusTarget, setFocusTarget] = useState<'PDU' | 'PMU' | 'ALU' | 'FPB' | 'PTU'>('PDU')
  const loadAlu = useCallback(async () => {
    setAluError('')
    try { const [snapshot, traces] = await Promise.all([aluApi.snapshot(), aluApi.traces()]); setAluSnapshot(snapshot); setAluTraces(traces) }
    catch (cause) { setAluError(errorMessage(cause)) }
    finally { setAluLoading(false) }
  }, [])
  useEffect(() => { void loadAlu(); const timer = window.setInterval(() => void loadAlu(), 4000); return () => window.clearInterval(timer) }, [loadAlu])
  useEffect(() => {
    if (!aluTraceId) return
    let cancelled = false; setAluTraceLoading(true); setAluPlaying(false)
    aluApi.trace(aluTraceId).then((value) => { if (!cancelled) { setAluTrace(value); setAluStep(-1) } })
      .catch((cause) => { if (!cancelled) setAluError(errorMessage(cause)) }).finally(() => { if (!cancelled) setAluTraceLoading(false) })
    return () => { cancelled = true }
  }, [aluTraceId])
  useEffect(() => {
    if (!aluPlaying || !aluTrace) return
    const timer = window.setInterval(() => setAluStep((index) => { if (index >= aluTrace.steps.length - 1) { setAluPlaying(false); return index } return index + 1 }), 680)
    return () => window.clearInterval(timer)
  }, [aluPlaying, aluTrace])
  const loadFpb = useCallback(async () => {
    setFpbError('')
    try { const [snapshot, traces] = await Promise.all([fpbApi.snapshot(), fpbApi.traces()]); setFpbLive(snapshot); setFpbTraces(traces) }
    catch (cause) { setFpbError(errorMessage(cause)) }
    finally { setFpbLoading(false) }
  }, [])
  const loadPtu = useCallback(async () => {
    setPtuError('')
    try { const [snapshot, traces] = await Promise.all([ptuApi.snapshot(), ptuApi.traces()]); setPtuSnapshot(snapshot); setPtuTraces(traces) }
    catch (cause) { setPtuError(errorMessage(cause)) }
    finally { setPtuLoading(false) }
  }, [])
  useEffect(() => { void loadPtu(); const timer = window.setInterval(() => void loadPtu(), 4000); return () => window.clearInterval(timer) }, [loadPtu])
  useEffect(() => {
    if (!ptuTraceId) return
    let cancelled = false; setPtuTraceLoading(true)
    ptuApi.trace(ptuTraceId).then((value) => { if (!cancelled) { setPtuTrace(value); setPtuStep(-1) } })
      .catch((cause) => { if (!cancelled) setPtuError(errorMessage(cause)) }).finally(() => { if (!cancelled) setPtuTraceLoading(false) })
    return () => { cancelled = true }
  }, [ptuTraceId])
  useEffect(() => { void loadFpb(); const timer = window.setInterval(() => void loadFpb(), 4000); return () => window.clearInterval(timer) }, [loadFpb])
  useEffect(() => {
    if (!fpbTraceId) return
    let cancelled = false; setFpbTraceLoading(true); setFpbPlaying(false)
    fpbApi.trace(fpbTraceId).then((value) => { if (!cancelled) { setFpbTrace(value); setFpbStep(-1) } })
      .catch((cause) => { if (!cancelled) setFpbError(errorMessage(cause)) }).finally(() => { if (!cancelled) setFpbTraceLoading(false) })
    return () => { cancelled = true }
  }, [fpbTraceId])
  useEffect(() => {
    if (!fpbPlaying || !fpbTrace) return
    const timer = window.setInterval(() => setFpbStep((index) => { if (index >= fpbTrace.steps.length - 1) { setFpbPlaying(false); return index } return index + 1 }), 760)
    return () => window.clearInterval(timer)
  }, [fpbPlaying, fpbTrace])
  const loadPmu = useCallback(async () => {
    setPmuError('')
    try { const [snapshot, traces] = await Promise.all([pmuApi.snapshot(), pmuApi.traces()]); setPmuSnapshot(snapshot); setPmuTraces(traces) }
    catch (cause) { setPmuError(errorMessage(cause)) }
    finally { setPmuLoading(false) }
  }, [])
  useEffect(() => { void loadPmu(); const timer = window.setInterval(() => void loadPmu(), 4000); return () => window.clearInterval(timer) }, [loadPmu])
  useEffect(() => {
    if (!pmuTraceId) return
    let cancelled = false; setPmuTraceLoading(true); setPmuPlaying(false)
    pmuApi.trace(pmuTraceId).then((value) => { if (!cancelled) { setPmuTrace(value); setPmuStep(-1); setPmuMode('HISTORICAL') } })
      .catch((cause) => { if (!cancelled) setPmuError(errorMessage(cause)) }).finally(() => { if (!cancelled) setPmuTraceLoading(false) })
    return () => { cancelled = true }
  }, [pmuTraceId])
  useEffect(() => {
    if (!pmuPlaying || !pmuTrace) return
    const timer = window.setInterval(() => setPmuStep((index) => { if (index >= pmuTrace.steps.length - 1) { setPmuPlaying(false); return index } return index + 1 }), 680)
    return () => window.clearInterval(timer)
  }, [pmuPlaying, pmuTrace])
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
  const pmuProjection = useMemo(() => pmuTrace ? projectPmuTrace(pmuTrace, pmuStep) : null, [pmuTrace, pmuStep])
  const openFocused = () => { setFocusTarget('PDU'); setFocused(true) }
  const focusPmu = () => { setFocusTarget('PMU'); setFocused(true) }
  const focusAlu = () => { setFocusTarget('ALU'); setFocused(true) }
  const focusFpb = () => { setFocusTarget('FPB'); setFocused(true) }
  const focusPtu = () => { setFocusTarget('PTU'); setFocused(true) }
  const stepPtu = (index: number) => setPtuStep(Math.max(-1, Math.min(ptuTrace?.steps.length ?? 0, index)))
  const selectPtuTrace = (id: string) => { setPtuTraceId(id); setPtuTrace(null); setPtuError('') }
  const stepPmu = (index: number) => { setPmuPlaying(false); setPmuStep(Math.max(-1, Math.min(pmuTrace?.steps.length ?? 0, index))) }
  const selectPmuTrace = (id: string) => { setPmuTraceId(id); setPmuTrace(null); setPmuError('') }
  const selectAluTrace = (id: string) => { setAluTraceId(id); setAluTrace(null); setAluError('') }
  const stepAlu = (index: number) => { setAluPlaying(false); setAluStep(Math.max(-1, Math.min(aluTrace?.steps.length ?? 0, index))) }
  const selectFpbTrace = (id: string) => { setFpbTraceId(id); setFpbTrace(null); setFpbError('') }
  const stepFpb = (index: number) => { setFpbPlaying(false); setFpbStep(Math.max(-1, Math.min(fpbTrace?.steps.length ?? 0, index))) }
  const fpbQueue = fpbTrace ? fpbQueueAtStep(fpbTrace, fpbStep) : null

  return <div className="cpu-internals-page">
    <PageIntro eyebrow="DSA LAB / PROCESSOR EXPLORER" title="CPU INTERNALS" description="Explore KernelX’s scheduler structures inside an exposed processor die. Heap playback is a historical record of real Java operations." action={<div className="internals-intro-actions"><span className="internals-mode"><i /> RECORDED RUN REPLAY</span><Link className="button button-quiet" to="/scheduler"><Cpu size={15} /> Open CPU Scheduler</Link></div>} />
    {error && <ErrorBanner message={error} onRetry={() => void loadRuns()} />}
    <div className="internals-toolbar"><div className="internals-run-select"><label htmlFor="heap-run-select">SCHEDULING RUN</label><select id="heap-run-select" value={runId} onChange={(event) => changeRun(event.target.value)} disabled={!runs.length || traceLoading}><option value="">No recorded heap run</option>{runs.map((run) => <option value={run.runId} key={run.runId}>{run.algorithm} · {run.processCount} processes · {new Date(run.startedAt).toLocaleString()}</option>)}</select></div><div className="internals-toolbar-actions"><span className="live-heap-note">LIVE RUNTIME HAS NO PERSISTENT HEAP · REPLAY IS READ ONLY</span><Button variant="quiet" onClick={() => void loadRuns()} disabled={loading || traceLoading}><RefreshCw size={15} /> Refresh history</Button></div></div>

    <div className={`internals-workspace ${focused ? 'internals-focused' : ''}`}>
      <section className="processor-stage" aria-label="Interactive CPU die">
        <div className="processor-stage-top"><div><span className="chip-serial">KERNELX · SILICON ARCHITECTURE EXPLORER</span><b>{focused ? focusTarget === 'PMU' ? 'PCB MEMORY UNIT' : focusTarget === 'ALU' ? 'ASSOCIATIVE LOOKUP UNIT' : focusTarget === 'FPB' ? 'FIFO PROCESS BUFFER' : focusTarget === 'PTU' ? 'PROCESS TREE UNIT' : 'PRIORITY DISPATCH UNIT' : 'PROCESSOR DIE / SYSTEM INTERCONNECT'}</b></div><div className="camera-controls">{focused && <Button variant="quiet" onClick={() => setFocused(false)}><ArrowLeft size={14} /> Back to Processor</Button>}<Button variant="quiet" onClick={resetCamera} aria-label="Reset camera"><Camera size={14} /> Reset camera</Button></div></div>
        <div className="die-canvas"><Suspense fallback={<div className="die-scene-loading" role="status">Loading 3D processor view…</div>}><ProcessorDieScene focused={focused} focusTarget={focusTarget} resetKey={resetKey} entries={heap} active={current} onFocus={openFocused} onPmuFocus={focusPmu} onAluFocus={focusAlu} onFpbFocus={focusFpb} onPtuFocus={focusPtu} ptuSnapshot={ptuSnapshot} ptuActive={ptuTrace && ptuStep >= 0 ? ptuTrace.steps[ptuStep] ?? null : null} aluSnapshot={aluSnapshot} aluActive={aluTrace && aluStep >= 0 ? aluTrace.steps[aluStep] ?? null : null} fpbQueue={fpbQueue} fpbAlgorithm={fpbTrace?.algorithm ?? null} fpbActive={fpbTrace && fpbStep >= 0 ? fpbTrace.steps[fpbStep] ?? null : null}
          pmuSnapshot={pmuMode === 'HISTORICAL' && pmuProjection ? pmuProjection.snapshot : pmuSnapshot} pmuBeforeSnapshot={pmuTrace?.beforeSnapshot ?? null}
          pmuActive={pmuProjection?.active ?? null} pmuVisitedNodeIds={pmuProjection?.visitedNodeIds ?? []} pmuIncomingNodeId={pmuProjection?.incomingNodeId ?? null} pmuHistorical={pmuMode === 'HISTORICAL'} /></Suspense>
          <div className="die-hint">DRAG · ORBIT &nbsp; / &nbsp; SCROLL · ZOOM &nbsp; / &nbsp; RIGHT DRAG · PAN</div></div>
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
    <PmuWorkbench snapshot={pmuSnapshot} traces={pmuTraces} trace={pmuTrace} selectedTraceId={pmuTraceId} stepIndex={pmuStep} mode={pmuMode} playing={pmuPlaying}
      loading={pmuLoading} traceLoading={pmuTraceLoading} error={pmuError} onRefresh={() => void loadPmu()} onSelectTrace={selectPmuTrace} onStep={stepPmu}
      onModeChange={(mode) => { setPmuPlaying(false); setPmuMode(mode) }} onTogglePlay={() => { if (pmuTrace && pmuStep >= pmuTrace.steps.length - 1) setPmuStep(-1); setPmuPlaying((value) => !value) }} onFocus={focusPmu} onResetCamera={resetCamera} />
    <AluWorkbench snapshot={aluSnapshot} traces={aluTraces} trace={aluTrace} selectedTraceId={aluTraceId} bucketIndex={aluBucket} stepIndex={aluStep} loading={aluLoading} traceLoading={aluTraceLoading} playing={aluPlaying} error={aluError}
      onRefresh={() => void loadAlu()} onSelectTrace={selectAluTrace} onSelectBucket={setAluBucket} onStep={stepAlu} onTogglePlay={() => { if (aluTrace && aluStep >= aluTrace.steps.length - 1) setAluStep(-1); setAluPlaying((value) => !value) }} onFocus={focusAlu} />
    <FpbWorkbench live={fpbLive} traces={fpbTraces} trace={fpbTrace} selectedTraceId={fpbTraceId} stepIndex={fpbStep} playing={fpbPlaying} loading={fpbLoading} traceLoading={fpbTraceLoading} error={fpbError}
      onRefresh={() => void loadFpb()} onSelectTrace={selectFpbTrace} onStep={stepFpb} onTogglePlay={() => { if (fpbTrace && fpbStep >= fpbTrace.steps.length - 1) setFpbStep(-1); setFpbPlaying((value) => !value) }} onFocus={focusFpb} />
    <PtuWorkbench snapshot={ptuSnapshot} traces={ptuTraces} trace={ptuTrace} selectedTraceId={ptuTraceId} stepIndex={ptuStep} loading={ptuLoading} traceLoading={ptuTraceLoading} error={ptuError}
      onRefresh={() => void loadPtu()} onSelectTrace={selectPtuTrace} onStep={stepPtu} onFocus={focusPtu} />
    <div className="internals-footnote"><span>DIAGNOSTIC REPLAY · READ ONLY</span><span>Heap indices, comparisons and swaps are emitted by the Java implementation.</span></div>
  </div>
}

