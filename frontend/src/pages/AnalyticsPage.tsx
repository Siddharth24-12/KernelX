import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, ChartNoAxesCombined, Clock3, RefreshCw, Workflow } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { analyticsApi, type AnalyticsSnapshot } from '../api/analytics'
import { comparisonsApi, type ComparisonReport, type ComparisonResult } from '../api/comparisons'
import { errorMessage } from '../api/client'
import { eventsApi } from '../api/events'
import type { SystemEvent } from '../types/api'
import { Empty, ErrorBanner, Loading, PageIntro, Panel } from '../components/common'

const metricOptions = [
  { key: 'averageWaitingTime', label: 'Average waiting time' },
  { key: 'averageTurnaroundTime', label: 'Average turnaround time' },
  { key: 'averageResponseTime', label: 'Average response time' },
  { key: 'cpuUtilization', label: 'CPU utilization' },
  { key: 'throughput', label: 'Throughput' },
] as const
const stateOrder = ['NEW', 'READY', 'RUNNING', 'WAITING', 'PAUSED', 'TERMINATED'] as const

export function AnalyticsPage() {
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null)
  const [events, setEvents] = useState<SystemEvent[]>([])
  const [reports, setReports] = useState<ComparisonReport[]>([])
  const [selectedReport, setSelectedReport] = useState<ComparisonReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [snapshotError, setSnapshotError] = useState('')
  const [eventError, setEventError] = useState('')
  const [reportError, setReportError] = useState('')
  const [workloadFilter, setWorkloadFilter] = useState('')
  const [algorithmFilter, setAlgorithmFilter] = useState('')
  const [metricFilter, setMetricFilter] = useState<(typeof metricOptions)[number]['key']>('averageWaitingTime')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [eventPid, setEventPid] = useState('')

  const refreshSnapshot = useCallback(async () => {
    try { setSnapshot(await analyticsApi.snapshot()); setSnapshotError('') }
    catch (error) { setSnapshotError(errorMessage(error)) }
  }, [])
  const refreshHistory = useCallback(async () => {
    const [eventResult, reportResult] = await Promise.allSettled([eventsApi.list(), comparisonsApi.list()])
    if (eventResult.status === 'fulfilled') { setEvents(eventResult.value); setEventError('') }
    else setEventError(errorMessage(eventResult.reason))
    if (reportResult.status === 'fulfilled') { setReports(reportResult.value); setReportError('') }
    else setReportError(errorMessage(reportResult.reason))
  }, [])
  const refreshAll = useCallback(async () => { await Promise.all([refreshSnapshot(), refreshHistory()]) }, [refreshHistory, refreshSnapshot])

  useEffect(() => {
    void refreshAll().finally(() => setLoading(false))
    const timer = window.setInterval(() => void refreshSnapshot(), 3500)
    return () => window.clearInterval(timer)
  }, [refreshAll, refreshSnapshot])

  const processEventRows = useMemo(() => events.filter((event) => eventPid === '' || event.pid === Number(eventPid))
    .sort((a, b) => a.eventId - b.eventId), [eventPid, events])
  const eventFrequency = useMemo(() => {
    const bins = new Map<number, number>()
    for (const event of processEventRows) bins.set(event.simulationTime, (bins.get(event.simulationTime) ?? 0) + 1)
    return [...bins].sort(([a], [b]) => a - b).map(([simulationTime, count]) => ({ simulationTime, count }))
  }, [processEventRows])
  const typeFrequency = useMemo(() => {
    const counts = new Map<string, number>()
    for (const event of processEventRows) counts.set(event.type, (counts.get(event.type) ?? 0) + 1)
    return [...counts].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count)
  }, [processEventRows])
  const workloadOptions = useMemo(() => [...new Map(reports.map((report) => [report.workloadId, report.workloadName])).entries()], [reports])
  const historicalRows = useMemo(() => reports
    .filter((report) => !workloadFilter || report.workloadId === workloadFilter)
    .filter((report) => !dateFrom || report.createdAt.slice(0, 10) >= dateFrom)
    .filter((report) => !dateTo || report.createdAt.slice(0, 10) <= dateTo)
    .flatMap((report) => report.results.filter((result) => !algorithmFilter || result.algorithm === algorithmFilter)
      .map((result) => ({ report, result, label: `${report.createdAt.slice(0, 10)} · ${result.label}`, value: result[metricFilter] })))
    .sort((a, b) => a.report.createdAt.localeCompare(b.report.createdAt)),
  [algorithmFilter, dateFrom, dateTo, metricFilter, reports, workloadFilter])
  const currentCpuSamples = snapshot?.cpu.runId
    ? snapshot.cpu.samples.filter((sample) => sample.runId === snapshot.cpu.runId)
    : []

  async function openReport(id: string) {
    try { setSelectedReport(await comparisonsApi.get(id)); setReportError('') }
    catch (error) { setReportError(errorMessage(error)) }
  }

  return <div className="analytics-page">
    <PageIntro eyebrow="OBSERVATORY / 06C" title="System analytics" description="Inspect live simulator measurements, recorded lifecycle events and saved scheduling experiments." action={<button className="button button-secondary" onClick={() => void refreshAll()}><RefreshCw size={15} /> Refresh data</button>} />
    {snapshotError && <ErrorBanner message={snapshotError} onRetry={() => void refreshSnapshot()} />}
    {loading && !snapshot ? <Panel><Loading label="Loading backend analytics…" /></Panel> : snapshot ? <>
      <div className="analytics-section-label"><Activity size={15} /> LIVE SIMULATOR <span>Updated {new Date(snapshot.capturedAt).toLocaleTimeString()}</span></div>
      <div className="analytics-overview-grid">
        <Panel title="CPU observatory" meta={<span className="section-meta">ACTUAL TICK SAMPLES</span>}>
          <div className="analytics-stat-grid">
            <Stat label="Observed utilization" value={snapshot.cpu.observedUtilizationPercent === null ? '—' : `${snapshot.cpu.observedUtilizationPercent.toFixed(1)}%`} detail={cpuHistoryLabel(snapshot)} />
            <Stat label="Running / idle ticks" value={snapshot.cpu.observedBusyTicks === null ? '—' : `${snapshot.cpu.observedBusyTicks} / ${snapshot.cpu.observedIdleTicks}`} detail="Observed in latest run" />
            <Stat label="Completed processes" value={String(snapshot.cpu.completedProcessCount)} detail="Completed in current process table" />
            <Stat label="Current tick" value={`${snapshot.cpu.currentTime} / ${snapshot.cpu.totalTime}`} detail={snapshot.cpu.currentRunningPid === null ? 'CPU currently idle' : `Running PID ${snapshot.cpu.currentRunningPid}`} />
          </div>
          {currentCpuSamples.length ? <div className="analytics-chart analytics-cpu-chart"><ResponsiveContainer width="100%" height={220}><AreaChart data={currentCpuSamples}><CartesianGrid strokeDasharray="3 3" stroke="#3C423B" /><XAxis dataKey="simulationTime" stroke="#A8ADA5" tickLine={false} /><YAxis domain={[0, 100]} unit="%" stroke="#A8ADA5" tickLine={false} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Cumulative utilization']} labelFormatter={(label) => `Simulation tick ${label}`} /><Area type="stepAfter" dataKey="utilizationPercent" stroke="#C7F36B" fill="#C7F36B" fillOpacity={0.12} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div> : <Empty title="No tick samples yet" message="CPU history appears after simulation ticks are actually executed. Reads do not create samples." />}
          <div className="analytics-subheading">EXECUTED INTERVALS · LATEST RUN</div>
          <Gantt segments={snapshot.cpu.observedGantt} />
          {snapshot.cpu.scheduledGantt.length > 0 && <details className="analytics-schedule-details"><summary>View full scheduled Gantt plan</summary><Gantt segments={snapshot.cpu.scheduledGantt} /></details>}
          <small className="analytics-note">A sample is written once after each real simulation tick. Executed intervals are grouped from those actual per-tick observations; the full scheduler plan is shown separately.</small>
        </Panel>
        <Panel title="Memory observatory" meta={<span className="section-meta">LIVE MEMORY MANAGER</span>}>
          <div className="analytics-stat-grid">
            <Stat label="Total memory" value={snapshot.memory.totalMemory.toLocaleString()} detail="Simulated units" />
            <Stat label="Allocated / free" value={`${snapshot.memory.allocatedMemory} / ${snapshot.memory.freeMemory}`} detail={`${snapshot.memory.utilizationPercent.toFixed(1)}% utilized`} />
            <Stat label="Blocks allocated / free" value={`${snapshot.memory.allocatedBlockCount} / ${snapshot.memory.freeBlockCount}`} detail={`Largest free block ${snapshot.memory.largestFreeBlock}`} />
            <Stat label="Allocation failures" value={String(snapshot.memory.allocationFailures)} detail="Recorded backend events" />
          </div>
          <div className="analytics-chart analytics-memory-chart"><ResponsiveContainer width="100%" height={190}><BarChart data={[{ kind: 'Memory', allocated: snapshot.memory.allocatedMemory, free: snapshot.memory.freeMemory }]}><CartesianGrid strokeDasharray="3 3" stroke="#3C423B" /><XAxis dataKey="kind" stroke="#A8ADA5" /><YAxis stroke="#A8ADA5" /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="allocated" stackId="memory" fill="#C7F36B" name="Allocated" isAnimationActive={false} /><Bar dataKey="free" stackId="memory" fill="#8C9288" name="Free" isAnimationActive={false} /></BarChart></ResponsiveContainer></div>
          <div className="analytics-fragmentation"><span>EXTERNAL FRAGMENTATION</span><b>{snapshot.memory.externalFragmentationPercent.toFixed(1)}%</b></div>
          <small className="analytics-note">100 × (1 − largest free block ÷ total free memory). It measures unusable split free space, not total free capacity; zero when no memory is free.</small>
        </Panel>
      </div>

      <div className="analytics-section-label"><Workflow size={15} /> PROCESS OBSERVATORY <span>LIVE COUNTS · HISTORICAL EVENTS</span></div>
      <div className="analytics-overview-grid">
        <Panel title="Process states" meta={<span className="section-meta">CURRENT PCB TABLE</span>}>
          <div className="analytics-chart"><ResponsiveContainer width="100%" height={235}><BarChart data={stateOrder.map((state) => ({ state, count: snapshot.processes.stateCounts[state] ?? 0 }))}><CartesianGrid strokeDasharray="3 3" stroke="#3C423B" /><XAxis dataKey="state" stroke="#A8ADA5" tickLine={false} /><YAxis allowDecimals={false} stroke="#A8ADA5" tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="count" fill="#8C9288" isAnimationActive={false} /></BarChart></ResponsiveContainer></div>
          {!snapshot.processes.processTableCount && <Empty title="No current processes" message="Live state counts are empty until processes are created." />}
          {snapshot.processes.processes.length > 0 && <div className="analytics-process-table-wrap"><table className="analytics-process-table"><thead><tr><th>PID / PROCESS</th><th>STATE</th><th>ARRIVAL</th><th>WAIT</th><th>TURNAROUND</th><th>RESPONSE</th></tr></thead><tbody>{snapshot.processes.processes.map((process) => <tr key={process.pid}><td>{process.pid} · {process.name}</td><td>{process.state}</td><td>{process.arrivalTime}</td><td>{process.waitingTime}</td><td>{process.turnaroundTime < 0 ? '—' : process.turnaroundTime}</td><td>{process.responseTime < 0 ? '—' : process.responseTime}</td></tr>)}</tbody></table></div>}
          <small className="analytics-note">Terminated processes remain in this count only while their PCB remains in the process table. Manually terminated and removed PCBs remain represented by lifecycle events.</small>
        </Panel>
        <Panel title="Process lifecycle timeline" meta={<span className="section-meta">EVENT HISTORY · SIMULATION TIME</span>}>
          {eventError && <ErrorBanner message={eventError} />}
          {processEventRows.length ? <div className="analytics-event-timeline">{processEventRows.filter(isLifecycleEvent).slice(-40).reverse().map((event) => <EventRow event={event} key={event.eventId} />)}</div> : <Empty title="No lifecycle events" message="Process creation, state transition and termination events will appear here as the backend records them." />}
          <small className="analytics-note">Lifecycle rows use persisted event IDs and simulation ticks. Reset events do not include inferred per-process transitions; manually removed processes remain visible here even when absent from the live PCB table.</small>
        </Panel>
      </div>

      <div className="analytics-section-label"><Clock3 size={15} /> EVENT OBSERVATORY <span>STRUCTURED PERSISTENT HISTORY · {events.length} EVENTS</span></div>
      <div className="analytics-overview-grid">
        <Panel title="Event frequency over simulation time" meta={<span className="section-meta">EVENTS / TICK</span>}>
          {eventError ? <ErrorBanner message={eventError} /> : eventFrequency.length ? <div className="analytics-chart"><ResponsiveContainer width="100%" height={220}><AreaChart data={eventFrequency}><CartesianGrid strokeDasharray="3 3" stroke="#3C423B" /><XAxis dataKey="simulationTime" stroke="#A8ADA5" tickLine={false} /><YAxis allowDecimals={false} stroke="#A8ADA5" tickLine={false} /><Tooltip contentStyle={tooltipStyle} labelFormatter={(label) => `Simulation tick ${label}`} /><Area type="monotone" dataKey="count" stroke="#C7F36B" fill="#C7F36B" fillOpacity={0.13} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div> : <Empty title="No event history" message="Event charts use only structured events returned by the backend." />}
          {eventFrequency.length > 0 && <div className="analytics-type-counts" aria-label="Event counts by simulation tick">{eventFrequency.map((item) => <span key={item.simulationTime}>T+{item.simulationTime} <b>{item.count}</b></span>)}</div>}
        </Panel>
        <Panel title="Events grouped by type" meta={<span className="section-meta">PERSISTED EVENT COUNTS</span>}>
          {typeFrequency.length ? <div className="analytics-chart"><ResponsiveContainer width="100%" height={220}><BarChart data={typeFrequency} layout="vertical" margin={{ left: 15 }}><CartesianGrid strokeDasharray="3 3" stroke="#3C423B" /><XAxis type="number" allowDecimals={false} stroke="#A8ADA5" /><YAxis type="category" dataKey="type" width={150} stroke="#A8ADA5" tick={{ fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="count" fill="#8C9288" isAnimationActive={false} /></BarChart></ResponsiveContainer></div> : <Empty title="No event types yet" message="Event type counts will appear when the backend has recorded activity." />}
          {typeFrequency.length > 0 && <div className="analytics-type-counts">{typeFrequency.map((item) => <span key={item.type}>{item.type} <b>{item.count}</b></span>)}</div>}
        </Panel>
      </div>
      <Panel title="Recent activity" meta={<label className="analytics-inline-filter">PROCESS <select aria-label="Filter events by process" value={eventPid} onChange={(event) => setEventPid(event.target.value)}><option value="">All processes</option>{[...new Set(events.flatMap((event) => event.pid === null ? [] : [event.pid]))].sort((a, b) => a - b).map((pid) => <option key={pid} value={pid}>PID {pid}</option>)}</select></label>}>
        {processEventRows.length ? <div className="analytics-recent-events">{[...processEventRows].sort((a, b) => b.eventId - a.eventId).slice(0, 30).map((event) => <EventRow event={event} key={event.eventId} />)}</div> : <Empty title="No matching events" message="Try another process filter, or wait for the backend to record activity." />}
      </Panel>
      <small className="analytics-note">System events contain monotonic event IDs and simulation-time values, but no wall-clock timestamp or run ID. Event counts at the same simulation tick therefore combine across simulation resets.</small>

      <div className="analytics-section-label"><ChartNoAxesCombined size={15} /> PERFORMANCE OBSERVATORY <span>HISTORICAL · SAVED PHASE 6B COMPARISONS</span></div>
      <Panel title="Historical comparison metrics" meta={<span className="section-meta">NOT LIVE SIMULATOR MEASUREMENTS</span>}>
        {reportError && <ErrorBanner message={reportError} />}
        <div className="analytics-filter-grid">
          <label className="field"><span>Workload</span><select aria-label="Filter comparisons by workload" value={workloadFilter} onChange={(event) => setWorkloadFilter(event.target.value)}><option value="">All workloads</option>{workloadOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <label className="field"><span>Algorithm</span><select aria-label="Filter comparisons by algorithm" value={algorithmFilter} onChange={(event) => setAlgorithmFilter(event.target.value)}><option value="">All algorithms</option>{['FCFS', 'SJF', 'ROUND_ROBIN', 'PRIORITY'].map((algorithm) => <option key={algorithm} value={algorithm}>{algorithm.replaceAll('_', ' ')}</option>)}</select></label>
          <label className="field"><span>From date</span><input aria-label="Comparison from date" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label className="field"><span>To date</span><input aria-label="Comparison to date" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
          <label className="field"><span>Metric</span><select aria-label="Comparison metric" value={metricFilter} onChange={(event) => setMetricFilter(event.target.value as typeof metricFilter)}>{metricOptions.map((metric) => <option key={metric.key} value={metric.key}>{metric.label}</option>)}</select></label>
        </div>
        {reportError && reports.length === 0 ? <Empty title="Comparison history unavailable" message="Saved Phase 6B reports could not be loaded." /> : historicalRows.length ? <div className="analytics-chart"><ResponsiveContainer width="100%" height={260}><LineChart data={historicalRows}><CartesianGrid strokeDasharray="3 3" stroke="#3C423B" /><XAxis dataKey="label" stroke="#A8ADA5" tickLine={false} tick={{ fontSize: 11 }} /><YAxis stroke="#A8ADA5" tickLine={false} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatMetric(metricFilter, Number(value)), metricOptions.find((metric) => metric.key === metricFilter)?.label]} /><Line type="monotone" dataKey="value" stroke="#C7F36B" strokeWidth={2} dot={{ fill: '#C7F36B', r: 3 }} isAnimationActive={false} /></LineChart></ResponsiveContainer></div> : <Empty title={reports.length ? 'No comparisons match these filters' : 'No saved comparisons'} message={reports.length ? 'Change the workload, algorithm or date range.' : 'Run and save an Algorithm Comparison to build historical performance data.'} />}
        {historicalRows.length > 0 && <div className="analytics-type-counts">{historicalRows.map((row) => <span key={`${row.report.comparisonId}-${row.result.configurationId}`}>{row.label} <b>{formatMetric(metricFilter, row.value)}</b></span>)}</div>}
        <div className="analytics-report-history"><h3>Saved comparison reports</h3>{reports.length ? reports.map((report) => <button key={report.comparisonId} className={selectedReport?.comparisonId === report.comparisonId ? 'selected' : ''} onClick={() => void openReport(report.comparisonId)}><b>{report.workloadName}</b><span>{new Date(report.createdAt).toLocaleString()} · {report.results.length} runs</span></button>) : <small>No saved reports available.</small>}</div>
      </Panel>
      {selectedReport && <Panel title={`Historical report · ${selectedReport.workloadName}`} meta={<span className="section-meta">{new Date(selectedReport.createdAt).toLocaleString()}</span>}>
        <div className="analytics-detail-grid">{selectedReport.results.map((result) => <HistoricalResult result={result} key={result.configurationId} />)}</div>
      </Panel>}
    </> : !snapshotError && <Panel><Empty title="Analytics are unavailable" message="The backend has not returned an analytics snapshot." /></Panel>}
  </div>
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="analytics-stat"><span>{label}</span><b>{value}</b><small>{detail}</small></div> }
function EventRow({ event }: { event: SystemEvent }) { return <div className="analytics-event-row"><time>T+{event.simulationTime}</time><b>{event.type}</b><span>{event.pid === null ? 'SYSTEM' : `PID ${event.pid}`}</span><p>{event.description}</p></div> }
function HistoricalResult({ result }: { result: ComparisonResult }) {
  return <article className="analytics-historical-result"><h3>{result.label}</h3><small>{result.algorithm.replaceAll('_', ' ')}{result.algorithm === 'PRIORITY' ? (result.preemptive ? ' · PREEMPTIVE' : ' · NON-PREEMPTIVE') : ''}</small><dl><dt>Avg waiting</dt><dd>{result.averageWaitingTime.toFixed(2)}</dd><dt>Avg turnaround</dt><dd>{result.averageTurnaroundTime.toFixed(2)}</dd><dt>Avg response</dt><dd>{result.averageResponseTime.toFixed(2)}</dd><dt>CPU utilization</dt><dd>{result.cpuUtilization.toFixed(1)}%</dd><dt>Throughput</dt><dd>{result.throughput.toFixed(3)} / tick</dd></dl><Gantt segments={result.gantt} />{result.processes.length > 0 && <div className="analytics-process-table-wrap"><table className="analytics-process-table"><thead><tr><th>PID</th><th>WAIT</th><th>TURNAROUND</th><th>RESPONSE</th></tr></thead><tbody>{result.processes.map((process) => <tr key={process.pid}><td>{process.pid}</td><td>{process.waitingTime}</td><td>{process.turnaroundTime}</td><td>{process.responseTime}</td></tr>)}</tbody></table></div>}</article>
}
function Gantt({ segments }: { segments: ComparisonResult['gantt'] }) {
  if (!segments.length) return <div className="analytics-gantt-empty">No backend Gantt plan available yet.</div>
  const total = Math.max(1, segments.at(-1)?.endTime ?? 1)
  return <div className="analytics-gantt" aria-label="Backend Gantt intervals">{segments.map((segment, index) => <div key={`${segment.startTime}-${index}`} className={segment.idle ? 'idle' : ''} style={{ left: `${segment.startTime / total * 100}%`, width: `${segment.duration / total * 100}%` }} title={`${segment.idle ? 'Idle' : `${segment.processName} PID ${segment.pid}`} · ${segment.startTime}–${segment.endTime}`}><span>{segment.idle ? 'IDLE' : `P${segment.pid}`}</span></div>)}</div>
}
function isLifecycleEvent(event: SystemEvent) { return event.type === 'PROCESS_CREATED' || event.type === 'STATE_CHANGED' || event.type === 'PROCESS_TERMINATED' }
function cpuHistoryLabel(snapshot: AnalyticsSnapshot) {
  const currentRunHasSamples = snapshot.cpu.runId !== null && snapshot.cpu.samples.some((sample) => sample.runId === snapshot.cpu.runId)
  return !currentRunHasSamples ? 'No executed ticks in this run' : snapshot.cpu.status === 'READY' ? 'Last run · historical' : `${snapshot.cpu.status} · latest run`
}
function formatMetric(metric: string, value: number) { return metric === 'cpuUtilization' ? `${value.toFixed(1)}%` : metric === 'throughput' ? `${value.toFixed(3)} / tick` : value.toFixed(2) }
const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--cloud)', fontSize: 13 }
