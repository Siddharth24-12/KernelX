import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ArrowUpRight, Cpu, Database, Layers3, Radio, RefreshCw, Workflow } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { useSystemData } from '../hooks/useSystemData'
import { Button, Empty, ErrorBanner, Loading, PageIntro, Panel, StatusPill } from '../components/common'
import type { ProcessState } from '../types/api'

type Context = ReturnType<typeof useSystemData>
const states: ProcessState[] = ['RUNNING', 'READY', 'WAITING', 'PAUSED', 'NEW', 'TERMINATED']
const stateCounts = (processes: Context['processes']) => states.map((state) => ({ name: state, count: processes.filter((p) => p.state === state).length }))

export function OverviewPage() {
  const { processes, memory, simulation, events, connected, loading, error, refresh } = useOutletContext<Context>()
  const [range, setRange] = useState(0)
  const counts = useMemo(() => stateCounts(processes), [processes])
  const gantt = simulation?.completedSegments ?? []
  const latestEvents = events.slice(0, 6)
  const maxEnd = gantt.length ? gantt[gantt.length - 1].endTime : 0
  const freeBlocks = memory?.blocks.filter((block) => block.free).length ?? 0

  return <div className="dashboard-page">
    <PageIntro eyebrow="CONTROL ROOM / 01" title="System overview" description="A live view of the KernelX simulation runtime, process workload and contiguous memory." action={<Button variant="secondary" onClick={() => void refresh()}><RefreshCw size={15} /> Refresh telemetry</Button>} />
    {error && <ErrorBanner message={error} onRetry={() => void refresh()} />}
    {!connected && !loading ? <Panel className="offline-panel"><div className="offline-mark"><Radio size={22} /></div><div><h2>Runtime link unavailable</h2><p>Start the Spring Boot API and confirm the configured base URL. Live values appear here as soon as the health connection returns.</p></div><Button onClick={() => void refresh()}>Retry connection</Button></Panel> : loading ? <Loading /> : <>
      <div className="telemetry-strip">
        <div className="telemetry-lead"><div className="telemetry-icon"><Workflow size={18} /></div><div><span>PROCESS TABLE</span><strong>{processes.length.toString().padStart(2, '0')}</strong></div><small>resident processes</small></div>
        <div className="telemetry-states">{counts.filter((item) => item.count > 0).map(({ name, count }) => <div className="state-readout" key={name}><i className={`state-dot dot-${name.toLowerCase()}`} /><span>{name}</span><b>{count}</b></div>)}{processes.length === 0 && <span className="muted">No process records</span>}</div>
        <div className="telemetry-runtime"><div className="runtime-label"><span>SIMULATION STATE</span><StatusPill state={simulation?.status ?? 'READY'} /></div><div className="runtime-time"><span className="mono">T+{simulation?.currentTime ?? 0}</span><small>current tick</small></div><div className="runtime-bottom"><span>ALGORITHM</span><b>{simulation?.algorithm ?? 'NOT SELECTED'}</b></div></div>
      </div>
      <div className="overview-grid">
        <Panel title="CPU execution trace" className="trace-panel" meta={<span className="section-meta">{gantt.length} SEGMENTS <b>·</b> {maxEnd} TICKS</span>}>
          {gantt.length ? <div className="trace-wrap"><div className="trace-track" role="img" aria-label="Recent CPU execution segments">{gantt.map((segment, index) => { const width = maxEnd > 0 ? Math.max(segment.duration / maxEnd * 100, 1.5) : 0; const isCurrent = simulation?.runningPid === segment.pid && simulation.status === 'RUNNING'; return <div className={`trace-segment ${segment.idle ? 'trace-idle' : isCurrent ? 'trace-current' : 'trace-process'}`} key={`${segment.startTime}-${index}`} style={{ width: `${width}%` }} title={`${segment.processName}: ${segment.startTime}–${segment.endTime}`}><span>{segment.idle ? 'IDLE' : `P${segment.pid}`}</span></div> })}</div><div className="trace-axis"><span>0</span><span>{Math.round(maxEnd / 2)}</span><span>{maxEnd} TICKS</span></div><div className="trace-foot"><span><i className="legend-chip legend-active" /> ACTIVE PROCESS</span><span><i className="legend-chip legend-idle" /> IDLE CPU</span><Link to="/scheduler">Open scheduler <ArrowUpRight size={13} /></Link></div></div> : <Empty title="No execution trace yet" message="Choose a scheduling policy and start a run to generate a real CPU timeline." />}
        </Panel>
        <Panel title="Memory map" className="memory-overview" meta={<span className="section-meta">{memory ? `${Math.round(memory.allocatedMemory / Math.max(memory.totalMemory, 1) * 100)}% USED` : '—'}</span>}>
          {memory ? <><div className="memory-summary"><strong>{memory.allocatedMemory}<small> / {memory.totalMemory}</small></strong><span>UNITS ALLOCATED</span></div><div className="memory-bar" role="img" aria-label={`${memory.allocatedMemory} of ${memory.totalMemory} memory units allocated`}>{memory.blocks.map((block, index) => <i key={`${block.startAddress}-${index}`} className={block.free ? 'block-free' : 'block-used'} style={{ width: `${block.size / Math.max(memory.totalMemory, 1) * 100}%` }} title={`${block.free ? 'Free' : `PID ${block.pid}`} · ${block.size} units`} />)}</div><div className="memory-legend"><span><i className="legend-chip legend-active" />ALLOCATED</span><span><i className="legend-chip legend-idle" />FREE</span></div><div className="memory-facts"><span>{freeBlocks} <small>FREE BLOCKS</small></span><span>{memory.freeMemory} <small>UNITS AVAILABLE</small></span></div><Link className="text-link" to="/memory">Inspect memory layout <ArrowUpRight size={13} /></Link></> : <Loading label="Reading memory map…" />}
        </Panel>
        <Panel title="Process state distribution" className="distribution-panel" meta={<div className="segmented-control" aria-label="Distribution period"><button className={range === 0 ? 'selected' : ''} onClick={() => setRange(0)}>CURRENT</button><button className={range === 1 ? 'selected' : ''} onClick={() => setRange(1)}>ALL STATES</button></div>}>
          <div className="distribution-layout"><div className="distribution-chart"><ResponsiveContainer width="100%" height={150}><PieChart><Pie data={counts} dataKey="count" nameKey="name" innerRadius={43} outerRadius={64} paddingAngle={2} stroke="none">{counts.map(({ name }, index) => <Cell key={name} fill={['#C7F36B','#D6A66A','#A8ADA5','#858B82','#5D655C','#343A34'][index]} />)}</Pie><Tooltip formatter={(value) => [`${value} processes`, 'Count']} contentStyle={{ borderColor: '#414841', font: '10px JetBrains Mono', background: '#171B17', color: '#F1F0E8' }} /></PieChart></ResponsiveContainer><div className="distribution-center"><strong>{processes.length}</strong><small>PROCESSES</small></div></div><div className="distribution-bars">{counts.filter(({ count }) => range === 1 || count > 0).map(({ name, count }) => <div className="distribution-row" key={name}><span>{name}</span><div><i style={{ width: `${processes.length ? Math.max(count / processes.length * 100, count ? 5 : 0) : 0}%` }} className={`bar-${name.toLowerCase()}`} /></div><b>{count}</b></div>)}</div></div>
        </Panel>
        <Panel title="Event stream" className="events-panel" meta={<span className="section-meta">LIVE <i className="live-dot" /></span>}>
          {latestEvents.length ? <div className="event-list">{latestEvents.map((event) => <div className="event-row" key={event.eventId}><span className="event-id">E{String(event.eventId).padStart(4, '0')}</span><span className="event-kind">{event.type.replaceAll('_', ' ')}</span><span className="event-description">{event.description}</span><span className="event-tick">T+{event.simulationTime}</span></div>)}</div> : <Empty title="Event log is quiet" message="Process and simulation activity will appear here as the backend records it." />}
        </Panel>
      </div>
      <div className="overview-bottom"><span><Layers3 size={14} /> MEMORY ENGINE <b>{memory ? `${memory.blocks.length} CONTIGUOUS BLOCKS` : '—'}</b></span><span><Cpu size={14} /> SCHEDULER <b>{simulation?.algorithm ?? 'STANDBY'}</b></span><span><Database size={14} /> API POLL <b>3.5 SEC</b></span></div>
    </>}
  </div>
}
