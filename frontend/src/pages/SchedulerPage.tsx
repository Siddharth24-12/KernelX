import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Activity, FastForward, Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import { errorMessage } from '../api/client'
import { Button, Empty, ErrorBanner, Field, PageIntro, Panel, StatusPill } from '../components/common'
import type { useSystemData } from '../hooks/useSystemData'
import { simulationApi, type StartSimulationInput } from '../api/simulation'
import type { Algorithm, GanttSegment, MemoryStrategy, SchedulingResult } from '../types/api'
import { DEFAULT_PREFERENCES_KEY, PENDING_PREFERENCES_KEY, readPreferences } from './schedulerPreferences'

type Context = ReturnType<typeof useSystemData>
const algorithmLabels: Record<Algorithm, string> = { FCFS: 'First Come, First Served', SJF: 'Shortest Job First', ROUND_ROBIN: 'Round Robin', PRIORITY: 'Priority Scheduling' }
export function Gantt({ data, totalTime, currentTime, activePid }: { data: GanttSegment[]; totalTime: number; currentTime: number; activePid: number | null }) {
  if (!data.length || !totalTime) return <Empty title="No schedule to render" message="Start a run to ask the backend scheduler for its execution sequence." />
  const ticks = Array.from(new Set([0, ...data.map((segment) => segment.startTime), totalTime])).sort((a, b) => a - b)
  return <div className="gantt-container"><div className="gantt-ruler"><div className="gantt-ruler-spacer">CPU / CORE 0</div><div className="gantt-ruler-main">{ticks.map((tick) => <span key={tick} style={{ left: `${tick / totalTime * 100}%` }}><i />{tick}</span>)}</div></div><div className="gantt-line"><div className="gantt-label"><Activity size={15} /> EXECUTION</div><div className="gantt-track">{data.map((segment, i) => <div key={`${segment.startTime}-${segment.pid}-${i}`} className={`gantt-segment ${segment.idle ? 'gantt-idle' : segment.pid === activePid ? 'gantt-active' : 'gantt-process'}`} style={{ left: `${segment.startTime / totalTime * 100}%`, width: `${segment.duration / totalTime * 100}%` }} title={`${segment.processName}${segment.idle ? '' : ` · PID ${segment.pid}`} · [${segment.startTime}, ${segment.endTime})`}><b>{segment.idle ? 'IDLE' : `P${segment.pid}`}</b><small>{segment.startTime}—{segment.endTime}</small></div>)}<i className="playhead" style={{ left: `${Math.min(currentTime / totalTime * 100, 100)}%` }} title={`Simulation time ${currentTime}`} /></div></div><div className="gantt-x-label"><span>0 TICKS</span><span>SIMULATION TIMELINE</span><span>{totalTime} TICKS</span></div></div>
}

export function SchedulerPage() {
  const { processes, memory, simulation, refresh, setSimulation, connected } = useOutletContext<Context>()
  const [algorithm, setAlgorithm] = useState<Algorithm>('ROUND_ROBIN'); const [quantum, setQuantum] = useState(2); const [preemptive, setPreemptive] = useState(false); const [memoryStrategy, setMemoryStrategy] = useState<MemoryStrategy>('FIRST_FIT'); const [totalMemory, setTotalMemory] = useState<number | null>(null); const [speed, setSpeed] = useState(1); const [result, setResult] = useState<SchedulingResult | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [stepCount, setStepCount] = useState(1)
  const active = simulation?.status === 'RUNNING' || simulation?.status === 'PAUSED'
  useEffect(() => {
    const preferences = readPreferences(PENDING_PREFERENCES_KEY) ?? readPreferences(DEFAULT_PREFERENCES_KEY)
    if (!preferences) return
    setAlgorithm(preferences.algorithm); setQuantum(preferences.timeQuantum); setPreemptive(preferences.preemptivePriority)
    setMemoryStrategy(preferences.memoryAllocationStrategy); setTotalMemory(preferences.totalMemory); setSpeed(preferences.speed)
    localStorage.removeItem(PENDING_PREFERENCES_KEY)
  }, [])
  useEffect(() => { if (!simulation?.algorithm) { setResult(null); return } simulationApi.schedule().then(setResult).catch(() => setResult(null)) }, [simulation?.algorithm, simulation?.status])
  async function action(operation: () => Promise<unknown>) { setBusy(true); setError(''); try { const value = await operation(); if (value && typeof value === 'object' && 'status' in value) setSimulation(value as typeof simulation); await refresh(); if (simulation?.algorithm) setResult(await simulationApi.schedule()) } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) } }
  const run = () => action(async () => { const input: StartSimulationInput = { algorithm, memoryAllocationStrategy: memoryStrategy, speed, ...(totalMemory !== null || memory ? { totalMemory: totalMemory ?? memory!.totalMemory } : {}), ...(algorithm === 'ROUND_ROBIN' ? { timeQuantum: quantum } : {}), ...(algorithm === 'PRIORITY' ? { preemptivePriority: preemptive } : {}) }; return simulationApi.start(input) })
  const gantt = result?.gantt ?? simulation?.completedSegments ?? []
  return <div className="scheduler-page"><PageIntro eyebrow="CPU SUBSYSTEM / 03" title="CPU scheduler" description="Configure a policy, inspect its deterministic execution plan, then advance the simulation one tick at a time." action={<div className="scheduler-state"><span>SESSION</span><StatusPill state={simulation?.status ?? 'READY'} /></div>} />
    {error && <ErrorBanner message={error} />}
    <div className="scheduler-workspace">
      <Panel className="scheduler-config" title="Policy configuration" meta={<span className="section-meta">01 / SETUP</span>}>
        <Field label="Scheduling algorithm"><select value={algorithm} disabled={active || busy} onChange={(e) => setAlgorithm(e.target.value as Algorithm)}>{Object.entries(algorithmLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></Field>
        {algorithm === 'ROUND_ROBIN' && <Field label="Time quantum" hint="Positive number of ticks per turn."><div className="number-control"><button onClick={() => setQuantum((v) => Math.max(1, v - 1))} disabled={active || busy} aria-label="Decrease quantum">−</button><input type="number" min="1" max="100000" value={quantum} disabled={active || busy} onChange={(e) => setQuantum(Math.max(1, Number(e.target.value)))} /><span>TICKS</span><button onClick={() => setQuantum((v) => v + 1)} disabled={active || busy} aria-label="Increase quantum">+</button></div></Field>}
        {algorithm === 'PRIORITY' && <label className="check-field"><input type="checkbox" checked={preemptive} disabled={active || busy} onChange={(e) => setPreemptive(e.target.checked)} /><span><b>Preemptive priority</b><small>Switch when a strictly higher priority process arrives.</small></span></label>}
        <Field label="Memory placement"><select value={memoryStrategy} disabled={active || busy} onChange={(e) => setMemoryStrategy(e.target.value as MemoryStrategy)}><option value="FIRST_FIT">First Fit</option><option value="BEST_FIT">Best Fit</option><option value="WORST_FIT">Worst Fit</option></select></Field>
        <Field label="Total simulated memory" hint="Resizing requires all current allocations to be released."><input type="number" min="1" max="1000000" value={totalMemory ?? memory?.totalMemory ?? ''} disabled={active || busy} onChange={(e) => setTotalMemory(e.target.value === '' ? null : Number(e.target.value))} /></Field>
        <div className="policy-note"><span className="mono">{algorithm === 'ROUND_ROBIN' ? `q = ${quantum}` : algorithm}</span><p>{algorithmLabels[algorithm]} is computed by the backend scheduler at start. The browser only renders returned segments.</p></div>
        <div className="config-actions">{!active ? <Button onClick={() => void run()} disabled={!connected || busy || processes.length === 0}><Play size={15} /> Start simulation</Button> : <Button variant="secondary" disabled><Activity size={15} /> Session active</Button>}<Button variant="quiet" onClick={() => void action(() => simulationApi.reset())} disabled={!connected || busy}><RotateCcw size={15} /> Reset run</Button></div>
        {processes.length === 0 && <div className="inline-note">Add at least one process before starting a schedule.</div>}
      </Panel>
      <Panel className="scheduler-instrument" title="Run instrumentation" meta={<span className="section-meta">02 / LIVE CONTROL</span>}>
        <div className="instrument-clock"><span>SIMULATION CLOCK</span><strong>T+{String(simulation?.currentTime ?? 0).padStart(3, '0')}</strong><small>ticks elapsed</small></div>
        <div className="instrument-meta"><div><span>ALGORITHM</span><b>{simulation?.algorithm ?? '—'}</b></div><div><span>CPU PROCESS</span><b>{simulation?.runningPid ? `PID ${simulation.runningPid}` : 'IDLE'}</b></div></div>
        <div className="control-row">{simulation?.status === 'RUNNING' ? <Button variant="secondary" onClick={() => void action(simulationApi.pause)} disabled={busy}><Pause size={15} /> Pause</Button> : simulation?.status === 'PAUSED' ? <Button onClick={() => void action(simulationApi.resume)} disabled={busy}><Play size={15} /> Resume</Button> : <Button variant="secondary" disabled><Play size={15} /> {simulation?.status === 'COMPLETED' ? 'Completed' : 'Not running'}</Button>}
          <div className="step-control"><input aria-label="Ticks to advance" type="number" min="1" max="100000" value={stepCount} onChange={(e) => setStepCount(Math.max(1, Number(e.target.value)))} /><Button variant="quiet" onClick={() => void action(() => simulationApi.step(stepCount))} disabled={simulation?.status !== 'RUNNING' || busy}><SkipForward size={15} /> Step</Button><button className="step-fast" aria-label="Advance ten ticks" title="Advance 10 ticks" onClick={() => void action(() => simulationApi.step(10))} disabled={simulation?.status !== 'RUNNING' || busy}><FastForward size={15} /></button></div>
        </div><div className="session-progress"><span><i style={{ width: `${simulation?.totalTime ? Math.min((simulation.currentTime / simulation.totalTime) * 100, 100) : 0}%` }} /></span><small>{simulation?.currentTime ?? 0} / {simulation?.totalTime ?? 0} TICKS</small></div>
      </Panel>
      <Panel className="gantt-panel" title="CPU execution timeline" meta={<><span className="section-meta">03 / GANTT</span><span className="mono gantt-status">{gantt.length} SEGMENTS</span></>}>
        <Gantt data={gantt} totalTime={result?.totalTime ?? simulation?.totalTime ?? 0} currentTime={simulation?.currentTime ?? 0} activePid={simulation?.runningPid ?? null} />
        {gantt.length > 0 && <div className="gantt-legend"><span><i className="legend-chip legend-active" />PROCESS EXECUTION</span><span><i className="legend-chip legend-idle" />IDLE INTERVAL</span><span><i className="legend-playhead" />CURRENT TICK</span></div>}
      </Panel>
      <Panel className="metrics-panel" title="Scheduling metrics" meta={<span className="section-meta">BACKEND RESULT</span>}>
        {result ? <><div className="metric-averages"><div><span>AVG WAITING</span><b>{result.averageWaitingTime.toFixed(2)}<small> ticks</small></b></div><div><span>AVG TURNAROUND</span><b>{result.averageTurnaroundTime.toFixed(2)}<small> ticks</small></b></div><div><span>AVG RESPONSE</span><b>{result.averageResponseTime.toFixed(2)}<small> ticks</small></b></div><div><span>TOTAL RUN</span><b>{result.totalTime}<small> ticks</small></b></div></div><div className="metrics-table-scroll"><table className="metrics-table"><thead><tr><th>PID</th><th>PROCESS</th><th>COMPLETE</th><th>TURNAROUND</th><th>WAITING</th><th>RESPONSE</th></tr></thead><tbody>{result.processes.map((p) => <tr key={p.pid}><td className="mono">P{p.pid}</td><td>{p.name}</td><td className="mono">{p.completionTime}</td><td className="mono">{p.turnaroundTime}</td><td className="mono">{p.waitingTime}</td><td className="mono">{p.responseTime}</td></tr>)}</tbody></table></div></> : <Empty title="Metrics are not available" message="Start a run to retrieve completion, turnaround, waiting and response measurements from the backend." />}
      </Panel>
    </div>
  </div>
}
