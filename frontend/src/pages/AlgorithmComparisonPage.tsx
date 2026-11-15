import { useEffect, useMemo, useState } from 'react'
import { GitCompareArrows, Plus, Trash2, Trophy } from 'lucide-react'
import { comparisonsApi, type ComparisonConfiguration, type ComparisonReport, type ComparisonResult } from '../api/comparisons'
import { errorMessage } from '../api/client'
import { workloadsApi, type Workload } from '../api/workloads'
import { Button, Empty, ErrorBanner, Loading, PageIntro, Panel } from '../components/common'

interface Selection extends ComparisonConfiguration { enabled: boolean; quantum?: number }
const initialSelections: Selection[] = [
  { configurationId: 'fcfs', label: 'FCFS', algorithm: 'FCFS', preemptivePriority: false, enabled: true },
  { configurationId: 'sjf', label: 'SJF', algorithm: 'SJF', preemptivePriority: false, enabled: true },
  { configurationId: 'rr-1', label: 'Round Robin · q2', algorithm: 'ROUND_ROBIN', timeQuantum: 2, quantum: 2, preemptivePriority: false, enabled: true },
  { configurationId: 'priority-np', label: 'Priority · non-preemptive', algorithm: 'PRIORITY', preemptivePriority: false, enabled: true },
  { configurationId: 'priority-p', label: 'Priority · preemptive', algorithm: 'PRIORITY', preemptivePriority: true, enabled: true },
]
const metricDefinitions = [
  { key: 'averageWaitingTime', label: 'Average waiting', direction: 'MINIMIZE' },
  { key: 'averageTurnaroundTime', label: 'Average turnaround', direction: 'MINIMIZE' },
  { key: 'averageResponseTime', label: 'Average response', direction: 'MINIMIZE' },
  { key: 'cpuUtilization', label: 'CPU utilization', direction: 'MAXIMIZE' },
  { key: 'throughput', label: 'Throughput', direction: 'MAXIMIZE' },
] as const

export function AlgorithmComparisonPage() {
  const [workloads, setWorkloads] = useState<Workload[]>([]); const [reports, setReports] = useState<ComparisonReport[]>([])
  const [workloadId, setWorkloadId] = useState(''); const [selections, setSelections] = useState<Selection[]>(initialSelections)
  const [report, setReport] = useState<ComparisonReport | null>(null); const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('')
  const [nextRoundRobinId, setNextRoundRobinId] = useState(2)

  async function refresh() {
    const [availableWorkloads, savedReports] = await Promise.all([workloadsApi.list(), comparisonsApi.list()])
    setWorkloads(availableWorkloads)
    setReports(savedReports)
    setWorkloadId((current) => current || availableWorkloads[0]?.id || '')
  }
  useEffect(() => { void refresh().catch((reason) => setError(errorMessage(reason))).finally(() => setLoading(false)) }, [])
  const enabled = selections.filter((selection) => selection.enabled)
  const invalidQuantum = enabled.some((selection) => selection.algorithm === 'ROUND_ROBIN' && (!Number.isInteger(selection.quantum) || (selection.quantum ?? 0) <= 0))
  const maximumTime = useMemo(() => Math.max(1, ...(report?.results.map((result) => result.totalTime) ?? [])), [report])

  function updateSelection(id: string, changes: Partial<Selection>) {
    setSelections((current) => current.map((selection) => selection.configurationId === id ? { ...selection, ...changes } : selection))
  }
  function addRoundRobin() {
    const id = `rr-${nextRoundRobinId}`
    setSelections((current) => [...current, { configurationId: id, label: `Round Robin · q${nextRoundRobinId + 1}`, algorithm: 'ROUND_ROBIN', timeQuantum: nextRoundRobinId + 1, quantum: nextRoundRobinId + 1, preemptivePriority: false, enabled: true }])
    setNextRoundRobinId((current) => current + 1)
  }
  function configLabel(selection: Selection) {
    if (selection.algorithm === 'ROUND_ROBIN') return `Round Robin · q${selection.quantum ?? 0}`
    if (selection.algorithm === 'PRIORITY') return selection.preemptivePriority ? 'Priority · preemptive' : 'Priority · non-preemptive'
    return selection.algorithm
  }

  async function runComparison() {
    setError(''); setNotice('')
    if (!workloadId) { setError('Select a workload before comparing.'); return }
    if (enabled.length < 2) { setError('Select at least two scheduling configurations.'); return }
    if (invalidQuantum) { setError('Round Robin requires a positive whole-number quantum.'); return }
    setBusy(true)
    try {
      const result = await comparisonsApi.run({ workloadId, configurations: enabled.map((selection) => ({
        configurationId: selection.configurationId, label: configLabel(selection), algorithm: selection.algorithm,
        timeQuantum: selection.algorithm === 'ROUND_ROBIN' ? selection.quantum : null,
        preemptivePriority: selection.algorithm === 'PRIORITY' && selection.preemptivePriority,
      })) })
      setReport(result); setReports(await comparisonsApi.list()); setNotice(`Comparison saved · ${result.results.length} isolated runs.`)
    } catch (reason) { setError(errorMessage(reason)) } finally { setBusy(false) }
  }
  async function openReport(id: string) {
    setBusy(true); setError('')
    try { setReport(await comparisonsApi.get(id)) } catch (reason) { setError(errorMessage(reason)) } finally { setBusy(false) }
  }
  async function deleteReport(item: ComparisonReport) {
    if (!window.confirm(`Delete comparison report for “${item.workloadName}”?`)) return
    setBusy(true); setError('')
    try { await comparisonsApi.remove(item.comparisonId); setReports((current) => current.filter((entry) => entry.comparisonId !== item.comparisonId)); if (report?.comparisonId === item.comparisonId) setReport(null) }
    catch (reason) { setError(errorMessage(reason)) } finally { setBusy(false) }
  }

  return <div className="comparison-page">
    <PageIntro eyebrow="EXPERIMENT / 06B" title="Algorithm comparison" description="Run one immutable workload through isolated scheduler instances and compare the backend results." action={<Button onClick={() => void runComparison()} disabled={busy || loading || !workloadId || enabled.length < 2 || invalidQuantum}><GitCompareArrows size={16} /> {busy ? 'Comparing…' : 'Run comparison'}</Button>} />
    {error && <ErrorBanner message={error} />}{notice && <div className="success-banner" role="status">{notice}</div>}
    <div className="comparison-layout">
      <aside className="comparison-controls">
        <Panel title="Experiment setup" meta={<span className="section-meta">ISOLATED RUNS</span>}>
          <label className="field"><span>Workload</span><select value={workloadId} onChange={(event) => setWorkloadId(event.target.value)} disabled={loading || workloads.length === 0} aria-label="Comparison workload">{workloads.map((item) => <option value={item.id} key={item.id}>{item.name}{item.id.startsWith('builtin-') ? ' · TEMPLATE' : ''}</option>)}</select></label>
          <p className="comparison-workload-note">Every configuration receives a fresh scheduler state from this saved definition. The active simulator is not used.</p>
          <div className="comparison-config-head"><div><h3>Scheduling configurations</h3><small>{enabled.length} selected</small></div><Button variant="quiet" onClick={addRoundRobin} disabled={selections.length >= 12}><Plus size={14} /> Add RR quantum</Button></div>
          <div className="comparison-config-list">{selections.map((selection) => <div className={`comparison-config ${selection.enabled ? 'enabled' : ''}`} key={selection.configurationId}>
            <label className="comparison-config-toggle"><input type="checkbox" checked={selection.enabled} onChange={(event) => updateSelection(selection.configurationId, { enabled: event.target.checked })} aria-label={`Compare ${configLabel(selection)}`} /><span>{configLabel(selection)}</span></label>
            {selection.algorithm === 'ROUND_ROBIN' && <label className="comparison-quantum"><span>Quantum</span><input type="number" min="1" step="1" value={selection.quantum ?? ''} onChange={(event) => updateSelection(selection.configurationId, { quantum: event.target.value === '' ? undefined : Number(event.target.value) })} aria-label={`Quantum ${selection.configurationId}`} /></label>}
            {selection.configurationId.startsWith('rr-') && selection.configurationId !== 'rr-1' && <button className="icon-button" aria-label={`Remove ${selection.configurationId}`} onClick={() => setSelections((current) => current.filter((item) => item.configurationId !== selection.configurationId))}><Trash2 size={14} /></button>}
          </div>)}</div>
          {invalidQuantum && <p className="comparison-inline-error">Quantum must be a positive whole number.</p>}
          <Button className="comparison-run-button" onClick={() => void runComparison()} disabled={busy || loading || !workloadId || enabled.length < 2 || invalidQuantum}><GitCompareArrows size={15} /> Run selected configurations</Button>
        </Panel>
        <Panel title="Saved reports" meta={<span className="section-meta">{reports.length} COMPARISONS</span>}>
          {loading ? <Loading label="Loading comparison history…" /> : reports.length ? <div className="comparison-history">{reports.map((item) => <article className={`comparison-history-item ${report?.comparisonId === item.comparisonId ? 'selected' : ''}`} key={item.comparisonId}>
            <button onClick={() => void openReport(item.comparisonId)}><b>{item.workloadName}</b><small>{new Date(item.createdAt).toLocaleString()} · {item.results.length} runs</small></button><button className="icon-button" aria-label={`Delete report ${item.comparisonId}`} disabled={busy} onClick={() => void deleteReport(item)}><Trash2 size={14} /></button>
          </article>)}</div> : <Empty title="No saved comparisons" message="Completed comparisons appear here. Failed runs are not saved." />}
        </Panel>
      </aside>
      <section className="comparison-results" aria-label="Comparison results">
        {loading ? <Panel><Loading label="Loading workloads and reports…" /></Panel> : !report ? <Panel><Empty title={workloads.length ? 'Ready to compare' : 'No workloads available'} message={workloads.length ? 'Select a workload and at least two configurations. Results will use a shared time scale and the same process definitions.' : 'Create or select a workload in Workload Studio before starting a comparison.'} /></Panel> : <>
          <Panel className="comparison-report-head"><div><span className="eyebrow">COMPARISON REPORT / {report.comparisonId.slice(0, 8).toUpperCase()}</span><h2>{report.workloadName}</h2><p>{report.workloadSnapshot.processes.length} process definitions · {new Date(report.createdAt).toLocaleString()}</p></div><span className="comparison-snapshot-tag">IMMUTABLE WORKLOAD SNAPSHOT</span></Panel>
          <Panel title="Metric leaders" meta={<span className="section-meta">TIES ARE PRESERVED</span>}><div className="comparison-winners">{report.winners.map((winner) => <div className="comparison-winner" key={winner.metric}><small>{metricTitle(winner.metric)}</small><b>{formatMetric(winner.metric, winner.value)}</b><span><Trophy size={13} /> {winner.labels.join(' · ')}</span></div>)}</div></Panel>
          <Panel title="Metric comparison" meta={<span className="section-meta">COMMON SCALE PER METRIC</span>}><div className="comparison-metric-grid">{metricDefinitions.map((metric) => <MetricBars key={metric.key} metric={metric.key} title={metric.label} results={report.results} direction={metric.direction} />)}</div></Panel>
          <Panel title="Gantt comparison" meta={<span className="section-meta">TIME 0 → {maximumTime} · IDLE INTERVALS SHOWN</span>}><div className="comparison-gantt-list">{report.results.map((result) => <GanttRow key={result.configurationId} result={result} scale={maximumTime} />)}</div></Panel>
          <Panel title="Per-process results" meta={<span className="section-meta">BACKEND METRICS</span>}><div className="comparison-process-results">{report.results.map((result) => <details key={result.configurationId}><summary><span>{result.label}</span><small>{result.totalTime} ticks · {result.processes.length} processes</small></summary><div className="metrics-table-scroll"><table className="metrics-table"><thead><tr><th>PID</th><th>PROCESS</th><th>COMPLETION</th><th>TURNAROUND</th><th>WAITING</th><th>RESPONSE</th></tr></thead><tbody>{result.processes.map((process) => <tr key={process.pid}><td>{process.pid}</td><td>{process.name}</td><td>{process.completionTime}</td><td>{process.turnaroundTime}</td><td>{process.waitingTime}</td><td>{process.responseTime}</td></tr>)}</tbody></table></div></details>)}</div></Panel>
        </>}
      </section>
    </div>
  </div>
}

function MetricBars({ metric, title, results, direction }: { metric: string; title: string; results: ComparisonResult[]; direction: 'MINIMIZE' | 'MAXIMIZE' }) {
  const key = metric as keyof ComparisonResult; const values = results.map((result) => Number(result[key])); const max = Math.max(...values, 0.000001)
  const best = direction === 'MINIMIZE' ? Math.min(...values) : Math.max(...values)
  return <div className="comparison-metric"><h3>{title}<small>{direction === 'MINIMIZE' ? 'LOWER IS BETTER' : 'HIGHER IS BETTER'}</small></h3>{results.map((result, index) => <div className="comparison-metric-row" key={result.configurationId}><span title={result.label}>{result.label}</span><div className="comparison-meter"><i className={values[index] === best ? 'winner' : ''} style={{ width: `${Math.max(values[index] / max * 100, values[index] === 0 ? 0 : 1)}%` }} /></div><b>{formatMetric(metric, values[index])}</b></div>)}</div>
}

function GanttRow({ result, scale }: { result: ComparisonResult; scale: number }) {
  return <div className="comparison-gantt-row"><div className="comparison-gantt-label"><b>{result.label}</b><small>0 — {scale}</small></div><div className="comparison-gantt-track" role="img" aria-label={`Gantt chart for ${result.label}`}>
    {result.gantt.map((segment, index) => <div key={`${segment.startTime}-${index}`} className={`comparison-gantt-segment ${segment.idle ? 'idle' : index % 2 ? 'alternate' : ''}`} style={{ left: `${segment.startTime / scale * 100}%`, width: `${segment.duration / scale * 100}%` }} title={`${segment.idle ? 'CPU idle' : `${segment.processName} (PID ${segment.pid})`}: ${segment.startTime}–${segment.endTime}`}><span>{segment.idle ? 'IDLE' : `P${segment.pid}`}</span></div>)}
    </div></div>
}

function metricTitle(metric: string) { return metricDefinitions.find((item) => item.key === metric)?.label ?? metric }
function formatMetric(metric: string, value: number) { if (metric === 'cpuUtilization') return `${value.toFixed(1)}%`; if (metric === 'throughput') return `${value.toFixed(3)} / tick`; return value.toFixed(2) }
