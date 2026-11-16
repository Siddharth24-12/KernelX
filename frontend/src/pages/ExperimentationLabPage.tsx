import { useEffect, useMemo, useState } from 'react'
import { FlaskConical, Plus, Play, Trash2 } from 'lucide-react'
import { errorMessage } from '../api/client'
import { experimentsApi, type ExperimentInput, type ExperimentReport, type ExperimentVariantInput, type MemoryOperation } from '../api/experiments'
import { workloadsApi, type Workload } from '../api/workloads'
import { Button, Empty, ErrorBanner, Loading, PageIntro, Panel } from '../components/common'
import type { Algorithm } from '../types/api'

interface DraftVariant extends ExperimentVariantInput { timeQuantum?: number | null; preemptivePriority: boolean }
const algorithms: Algorithm[] = ['FCFS', 'SJF', 'ROUND_ROBIN', 'PRIORITY']
const metricNames: Record<string, string> = {
  averageWaitingTime: 'Average waiting', averageTurnaroundTime: 'Average turnaround', averageResponseTime: 'Average response',
  cpuUtilization: 'CPU utilization', throughput: 'Throughput', successfulAllocations: 'Successful allocations',
  failedAllocations: 'Failed allocations', totalFreeMemory: 'Total free memory', largestFreeBlock: 'Largest free block',
  allocatedMemory: 'Allocated memory', externalFragmentation: 'External fragmentation',
}

export function ExperimentationLabPage() {
  const [workloads, setWorkloads] = useState<Workload[]>([])
  const [reports, setReports] = useState<ExperimentReport[]>([])
  const [workloadId, setWorkloadId] = useState('')
  const [type, setType] = useState<'SCHEDULING' | 'MEMORY'>('SCHEDULING')
  const [name, setName] = useState('Scheduling experiment')
  const [description, setDescription] = useState('')
  const [variants, setVariants] = useState<DraftVariant[]>([])
  const [operations, setOperations] = useState<MemoryOperation[]>([])
  const [nextId, setNextId] = useState(1)
  const [report, setReport] = useState<ExperimentReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const workload = workloads.find((item) => item.id === workloadId)

  async function refresh() {
    const [available, saved] = await Promise.all([workloadsApi.list(), experimentsApi.list()])
    setWorkloads(available); setReports(saved)
    setWorkloadId((current) => current || available[0]?.id || '')
  }
  useEffect(() => { void refresh().catch((reason) => setError(errorMessage(reason))).finally(() => setLoading(false)) }, [])
  useEffect(() => {
    if (!workload) return
    const alternate: Algorithm = workload.algorithm === 'FCFS' ? 'SJF' : 'FCFS'
    setVariants([{ variantId: 'variant-1', label: 'Variant 1', algorithm: alternate,
      timeQuantum: null, preemptivePriority: false, processChanges: [] }])
  }, [workloadId, workload?.algorithm, workload?.timeQuantum, workload?.preemptivePriority])

  const validationErrors = useMemo(() => {
    const issues: string[] = []
    if (!workloadId) issues.push('Select a saved workload.')
    if (!name.trim()) issues.push('Enter an experiment name.')
    if (type === 'SCHEDULING') {
      if (variants.length === 0) issues.push('Add at least one variant.')
    variants.forEach((variant) => {
        if (variant.label.trim().length === 0) issues.push('Every scheduling variant needs a label.')
        if (variant.algorithm === 'ROUND_ROBIN' && (!Number.isInteger(variant.timeQuantum) || (variant.timeQuantum ?? 0) < 1)) issues.push(`${variant.label}: Round Robin quantum must be a positive whole number.`)
        if (variant.algorithm !== 'PRIORITY' && variant.preemptivePriority) issues.push(`${variant.label}: preemption is only supported for Priority.`)
        for (const change of variant.processChanges ?? []) if (change.arrivalTime !== undefined && (!Number.isInteger(change.arrivalTime) || change.arrivalTime < 0)
          || change.burstTime !== undefined && (!Number.isInteger(change.burstTime) || change.burstTime < 1)
          || change.priority !== undefined && (!Number.isInteger(change.priority) || change.priority < 0 || change.priority > 10)) issues.push(`${variant.label}: process changes have invalid values.`)
      })
    } else {
      if (operations.length === 0) issues.push('Add at least one ordered memory operation.')
      if (operations.length > 512) issues.push('Memory request sequences are limited to 512 operations.')
      if (operations.filter((operation) => operation.operation === 'ALLOCATE').some((operation) => !Number.isInteger(operation.amount) || (operation.amount ?? 0) < 1 || (operation.amount ?? 0) > (workload?.totalMemory ?? 0))) issues.push('Allocation sizes must fit within the workload memory size.')
      if (!operations.some((operation) => operation.operation === 'ALLOCATE')) issues.push('Add an allocation request.')
      const activePids = new Set<number>(); const knownPids = new Set<number>()
      operations.forEach((operation, index) => {
        if (!Number.isInteger(operation.pid) || operation.pid <= 0) issues.push(`Operation ${index + 1} needs a positive integer PID.`)
        if (operation.operation === 'ALLOCATE') {
          if (activePids.has(operation.pid)) issues.push(`Operation ${index + 1}: deallocate PID ${operation.pid} before requesting it again.`)
          activePids.add(operation.pid); knownPids.add(operation.pid)
        } else {
          if (!knownPids.has(operation.pid)) issues.push(`Operation ${index + 1}: PID ${operation.pid} needs an earlier allocation request.`)
          activePids.delete(operation.pid)
        }
      })
    }
    return [...new Set(issues)]
  }, [name, operations, type, variants, workload?.totalMemory, workloadId])

  function updateVariant(id: string, update: Partial<DraftVariant>) {
    setVariants((current) => current.map((variant) => variant.variantId === id ? { ...variant, ...update } : variant))
  }
  function addVariant() {
    const id = `variant-${nextId + 1}`
    setVariants((current) => [...current, { variantId: id, label: `Variant ${nextId + 1}`, algorithm: 'ROUND_ROBIN', timeQuantum: 2, preemptivePriority: false, processChanges: [] }])
    setNextId((current) => current + 1)
  }
  function updateProcessChange(variant: DraftVariant, pid: number, key: 'arrivalTime' | 'burstTime' | 'priority', value: string) {
    const original = workload?.processes.find((process) => process.pid === pid)
    if (!original) return
    const changes = [...(variant.processChanges ?? [])]
    const index = changes.findIndex((change) => change.pid === pid)
    const change = { ...(index >= 0 ? changes[index] : { pid }), [key]: value === '' ? undefined : Number(value) }
    if (index >= 0) changes[index] = change
    else changes.push(change)
    const cleaned = Object.fromEntries(Object.entries(change).filter(([, item]) => item !== undefined)) as typeof change
    const baseline = key === 'arrivalTime' ? original.arrivalTime : key === 'burstTime' ? original.burstTime : original.priority
    if (Number(value) === baseline || value === '') delete cleaned[key]
    const final = changes.filter((item) => item.pid !== pid)
    if (Object.keys(cleaned).length > 1) final.push(cleaned)
    updateVariant(variant.variantId, { processChanges: final })
  }
  function addMemoryOperation(operation: 'ALLOCATE' | 'DEALLOCATE') {
    const pid = workload?.processes[0]?.pid ?? 1
    setOperations((current) => [...current, operation === 'ALLOCATE' ? { operation, pid, amount: 64 } : { operation, pid }])
  }
  function updateMemoryOperation(index: number, changes: Partial<MemoryOperation>) {
    setOperations((current) => current.map((operation, i) => i === index ? { ...operation, ...changes } : operation))
  }

  async function execute() {
    setError(''); setNotice('')
    if (validationErrors.length) { setError(validationErrors.join(' ')); return }
    if (!workload) return
    const body: ExperimentInput = {
      name, description, baseWorkloadId: workloadId, type,
      variants: type === 'SCHEDULING' ? variants.map((variant) => ({ ...variant,
        timeQuantum: variant.algorithm === 'ROUND_ROBIN' ? variant.timeQuantum : null,
        preemptivePriority: variant.algorithm === 'PRIORITY' && variant.preemptivePriority,
      })) : [
        { variantId: 'best-fit', label: 'Best Fit', memoryStrategy: 'BEST_FIT' },
        { variantId: 'worst-fit', label: 'Worst Fit', memoryStrategy: 'WORST_FIT' },
      ],
      ...(type === 'MEMORY' ? { memoryOperations: operations } : {}),
    }
    setBusy(true)
    try { const saved = await experimentsApi.execute(body); setReport(saved); setReports(await experimentsApi.list()); setNotice(`Completed experiment saved · ${saved.variants.length} isolated variants.`) }
    catch (reason) { setError(errorMessage(reason)) } finally { setBusy(false) }
  }
  async function openReport(id: string) {
    setError(''); setBusy(true)
    try { setReport(await experimentsApi.get(id)) } catch (reason) { setError(errorMessage(reason)) } finally { setBusy(false) }
  }
  async function deleteReport(item: ExperimentReport) {
    if (!window.confirm(`Delete experiment “${item.name}”?`)) return
    setError(''); setBusy(true)
    try { await experimentsApi.remove(item.experimentId); setReports((current) => current.filter((entry) => entry.experimentId !== item.experimentId)); if (report?.experimentId === item.experimentId) setReport(null) }
    catch (reason) { setError(errorMessage(reason)) } finally { setBusy(false) }
  }

  return <div className="experiment-page">
    <PageIntro eyebrow="CONTROLLED TESTING / 06D" title="Experimentation lab" description="Change workload parameters or memory fit policy in isolated runs, then compare the measured results." action={<Button onClick={() => void execute()} disabled={busy || loading || validationErrors.length > 0}><Play size={15} /> {busy ? 'Running…' : 'Run experiment'}</Button>} />
    {error && <ErrorBanner message={error} />}{notice && <div className="success-banner" role="status">{notice}</div>}
    <div className="experiment-layout">
      <aside className="experiment-controls">
        <Panel title="Experiment setup" meta={<span className="section-meta">ISOLATED EXECUTION</span>}>
          <label className="field"><span>Saved base workload</span><select aria-label="Experiment workload" value={workloadId} onChange={(event) => setWorkloadId(event.target.value)} disabled={loading || workloads.length === 0}>{workloads.map((item) => <option key={item.id} value={item.id}>{item.name}{item.id.startsWith('builtin-') ? ' · TEMPLATE' : ''}</option>)}</select></label>
          <label className="field"><span>Experiment type</span><select aria-label="Experiment type" value={type} onChange={(event) => setType(event.target.value as 'SCHEDULING' | 'MEMORY')}><option value="SCHEDULING">Scheduling</option><option value="MEMORY">Memory allocation</option></select></label>
          <label className="field"><span>Name</span><input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} aria-label="Experiment name" /></label>
          <label className="field"><span>Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} aria-label="Experiment description" rows={2} /></label>
          {workload && <p className="experiment-note">{workload.processes.length} processes · {workload.totalMemory} memory units · original workload is read-only during the run.</p>}
        </Panel>
        {type === 'SCHEDULING' ? <Panel title="Scheduling variants" meta={<Button variant="quiet" onClick={addVariant} disabled={variants.length >= 12}><Plus size={14} /> Add variant</Button>}>
          <div className="experiment-variant-editors">{variants.map((variant, index) => <article className="experiment-variant-editor" key={variant.variantId}>
            <div className="experiment-variant-title"><span className="experiment-variant-number">{String(index + 1).padStart(2, '0')}</span><input value={variant.label} aria-label={`Variant ${index + 1} label`} onChange={(event) => updateVariant(variant.variantId, { label: event.target.value })} /><button className="icon-button" aria-label={`Remove ${variant.label}`} disabled={variants.length <= 1} onClick={() => setVariants((current) => current.filter((entry) => entry.variantId !== variant.variantId))}><Trash2 size={14} /></button></div>
            <label className="field"><span>Algorithm</span><select aria-label={`${variant.label} algorithm`} value={variant.algorithm} onChange={(event) => updateVariant(variant.variantId, { algorithm: event.target.value as Algorithm, preemptivePriority: false, timeQuantum: event.target.value === 'ROUND_ROBIN' ? 2 : null })}>{algorithms.map((algorithm) => <option key={algorithm} value={algorithm}>{algorithm}</option>)}</select></label>
            {variant.algorithm === 'ROUND_ROBIN' && <label className="field"><span>Quantum</span><input aria-label={`${variant.label} quantum`} type="number" min="1" value={variant.timeQuantum ?? ''} onChange={(event) => updateVariant(variant.variantId, { timeQuantum: event.target.value === '' ? null : Number(event.target.value) })} /></label>}
            {variant.algorithm === 'PRIORITY' && <label className="experiment-check"><input type="checkbox" checked={variant.preemptivePriority} onChange={(event) => updateVariant(variant.variantId, { preemptivePriority: event.target.checked })} /> Preemptive priority</label>}
            <details className="experiment-process-edits"><summary>Process parameter changes <small>{variant.processChanges?.length ?? 0} modified</small></summary><div className="metrics-table-scroll"><table className="metrics-table"><thead><tr><th>Process</th><th>Arrival</th><th>Burst</th><th>Priority</th></tr></thead><tbody>{workload?.processes.map((process) => {
              const change = variant.processChanges?.find((item) => item.pid === process.pid)
              return <tr key={process.pid}><td>{process.name} · {process.pid}</td>{(['arrivalTime', 'burstTime', 'priority'] as const).map((key) => <td key={key}><input type="number" aria-label={`${variant.label} ${process.name} ${key}`} min={key === 'priority' ? 0 : key === 'arrivalTime' ? 0 : 1} max={key === 'priority' ? 10 : undefined} value={change?.[key] ?? (key === 'arrivalTime' ? process.arrivalTime : key === 'burstTime' ? process.burstTime : process.priority)} onChange={(event) => updateProcessChange(variant, process.pid, key, event.target.value)} /></td>)}</tr>
            })}</tbody></table></div></details>
          </article>)}</div>
        </Panel> : <Panel title="Shared memory request sequence" meta={<span className="section-meta">SAME ORDER FOR ALL FIT POLICIES</span>}>
          <p className="experiment-note">Baseline: First Fit · variants: Best Fit and Worst Fit. Failed allocations are recorded per strategy; deallocating a PID that failed to allocate is a no-op for that strategy.</p>
          <div className="experiment-op-actions"><Button variant="quiet" onClick={() => addMemoryOperation('ALLOCATE')}><Plus size={14} /> Allocate</Button><Button variant="quiet" onClick={() => addMemoryOperation('DEALLOCATE')}><Plus size={14} /> Deallocate</Button></div>
          {!operations.length ? <Empty title="No memory operations" message="Add an ordered sequence of allocations and releases to compare the fit strategies." /> : <ol className="experiment-memory-operations">{operations.map((operation, index) => <li key={`${index}-${operation.pid}`}><span className="experiment-op-index">{String(index + 1).padStart(2, '0')}</span><select value={operation.operation} aria-label={`Operation ${index + 1}`} onChange={(event) => updateMemoryOperation(index, event.target.value === 'ALLOCATE' ? { operation: 'ALLOCATE', amount: 64 } : { operation: 'DEALLOCATE', amount: undefined })}><option value="ALLOCATE">Allocate</option><option value="DEALLOCATE">Deallocate</option></select><label>PID<input type="number" min="1" value={operation.pid} aria-label={`Operation ${index + 1} PID`} onChange={(event) => updateMemoryOperation(index, { pid: Number(event.target.value) })} /></label>{operation.operation === 'ALLOCATE' && <label>Units<input type="number" min="1" max={workload?.totalMemory ?? 0} value={operation.amount ?? ''} aria-label={`Operation ${index + 1} amount`} onChange={(event) => updateMemoryOperation(index, { amount: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>}<button className="icon-button" aria-label={`Remove operation ${index + 1}`} onClick={() => setOperations((current) => current.filter((_, i) => i !== index))}><Trash2 size={14} /></button></li>)}</ol>}
        </Panel>}
        {validationErrors.length > 0 && <div className="experiment-validation" role="status"><b>Before running</b><ul>{validationErrors.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>}
        <Button className="experiment-run-button" onClick={() => void execute()} disabled={busy || loading || validationErrors.length > 0}><FlaskConical size={15} /> Run isolated experiment</Button>
        <Panel title="Saved reports" meta={<span className="section-meta">{reports.length} EXPERIMENTS</span>}>
          {loading ? <Loading label="Loading experiment history…" /> : reports.length ? <div className="comparison-history">{reports.map((item) => <article className={`comparison-history-item ${report?.experimentId === item.experimentId ? 'selected' : ''}`} key={item.experimentId}><button onClick={() => void openReport(item.experimentId)}><b>{item.name}</b><small>{item.baseWorkloadName} · {new Date(item.executedAt).toLocaleString()}</small></button><button className="icon-button" aria-label={`Delete experiment ${item.name}`} disabled={busy} onClick={() => void deleteReport(item)}><Trash2 size={14} /></button></article>)}</div> : <Empty title="No saved experiments" message="Completed reports appear here. A failed run is not persisted." />}
        </Panel>
      </aside>
      <section className="experiment-results" aria-label="Experiment results">
        {loading ? <Panel><Loading label="Loading saved workloads and experiments…" /></Panel> : !report ? <Panel><Empty title="Ready to experiment" message="Configure at least one variant or a shared memory request sequence. Each run receives a fresh isolated execution context." /></Panel> : <ExperimentResults report={report} />}
      </section>
    </div>
  </div>
}

function ExperimentResults({ report }: { report: ExperimentReport }) {
  const rows = [report.baseline, ...report.variants]
  return <div className="experiment-report" aria-label="Experiment report">
    <Panel className="experiment-report-head"><div><span className="eyebrow">{report.type} EXPERIMENT / {report.experimentId.slice(0, 8).toUpperCase()}</span><h2>{report.name}</h2><p>{report.baseWorkloadName} · immutable snapshot · {new Date(report.executedAt).toLocaleString()}</p></div><span className="comparison-snapshot-tag">ISOLATED / LIVE SIMULATION UNCHANGED</span></Panel>
    <Panel title="Variant configurations" meta={<span className="section-meta">BASELINE AND VARIANTS</span>}><div className="experiment-result-grid">{rows.map((row, index) => <article className={`experiment-result-card ${index === 0 ? 'baseline' : ''}`} key={row.variantId}><small>{index === 0 ? 'BASELINE' : `VARIANT ${index}`}</small><h3>{row.label}</h3><p>{row.configuration.algorithm ? `${row.configuration.algorithm}${row.configuration.timeQuantum ? ` · q${row.configuration.timeQuantum}` : ''}${row.configuration.preemptivePriority ? ' · preemptive' : ''}` : row.configuration.memoryStrategy}</p><ul>{row.parameterChanges.map((change) => <li key={change}>{change}</li>)}</ul></article>)}</div></Panel>
    <Panel title="Baseline comparison" meta={<span className="section-meta">DIFFERENCES ARE VARIANT − BASELINE</span>}><div className="experiment-delta-grid">{report.metricComparisons.map((metric) => { const unchanged = metric.difference === 0; const improved = isMaximizedMetric(metric.metric) ? metric.difference > 0 : metric.difference < 0; return <article key={`${metric.variantId}-${metric.metric}`}><small>{metric.variantLabel} · {metricNames[metric.metric] ?? metric.metric} · {isMaximizedMetric(metric.metric) ? 'HIGHER TARGET' : 'LOWER TARGET'}</small><b>{formatValue(metric.variantValue, metric.metric)}</b><span className={unchanged ? '' : improved ? 'delta-improved' : 'delta-tradeoff'}>{unchanged ? 'NO CHANGE' : improved ? 'IMPROVED' : 'TRADE-OFF'} · Δ {metric.difference > 0 ? '+' : ''}{formatValue(metric.difference, metric.metric)} · |Δ| {formatValue(metric.absoluteDifference, metric.metric)}{metric.percentageChange === null ? '' : ` (${metric.percentageChange > 0 ? '+' : ''}${metric.percentageChange.toFixed(1)}%)`}</span><em>Baseline {formatValue(metric.baselineValue, metric.metric)}</em></article> })}</div><div className="experiment-winners"><b>Best measured values · ties preserved</b>{report.winners.map((winner) => <span key={winner.metric}>{metricNames[winner.metric] ?? winner.metric}: <strong>{winner.labels.join(' · ')}</strong></span>)}</div></Panel>
    {report.type === 'SCHEDULING' ? <>
      <Panel title="Gantt comparison" meta={<span className="section-meta">SCHEDULER OUTPUT</span>}><div className="comparison-gantt-list">{rows.map((row) => row.schedulingResult && <ScheduleGantt key={row.variantId} label={row.label} gantt={row.schedulingResult.gantt} />)}</div></Panel>
      <Panel title="Per-process differences" meta={<span className="section-meta">WAIT / TURNAROUND / RESPONSE</span>}><div className="metrics-table-scroll"><table className="metrics-table"><thead><tr><th>Variant</th><th>PID</th><th>Process</th><th>Δ Waiting</th><th>Δ Turnaround</th><th>Δ Response</th></tr></thead><tbody>{report.processMetricDeltas.map((delta) => <tr key={`${delta.variantId}-${delta.pid}`}><td>{report.variants.find((item) => item.variantId === delta.variantId)?.label}</td><td>{delta.pid}</td><td>{delta.processName}</td><td>{signed(delta.waitingDifference)}</td><td>{signed(delta.turnaroundDifference)}</td><td>{signed(delta.responseDifference)}</td></tr>)}</tbody></table></div></Panel>
      <Panel title="Per-process metrics" meta={<span className="section-meta">BACKEND RESULTS</span>}><div className="experiment-result-grid">{rows.map((row) => <details key={row.variantId} className="experiment-process-results"><summary>{row.label} <small>{row.schedulingResult?.processes.length} processes</small></summary><div className="metrics-table-scroll"><table className="metrics-table"><thead><tr><th>PID</th><th>Process</th><th>Waiting</th><th>Turnaround</th><th>Response</th></tr></thead><tbody>{row.schedulingResult?.processes.map((process) => <tr key={process.pid}><td>{process.pid}</td><td>{process.name}</td><td>{process.waitingTime}</td><td>{process.turnaroundTime}</td><td>{process.responseTime}</td></tr>)}</tbody></table></div></details>)}</div></Panel>
    </> : <Panel title="Final memory layouts" meta={<span className="section-meta">SAME REQUEST ORDER · ISOLATED ARENAS</span>}><div className="experiment-memory-layouts">{rows.map((row) => row.memoryResult && <article key={row.variantId}><h3>{row.label}</h3><div className="experiment-memory-bar" role="img" aria-label={`${row.label} final memory layout`}>{row.memoryResult.blocks.map((block) => <div key={block.startAddress} className={block.free ? 'free' : 'used'} style={{ width: `${block.size / Math.max(1, row.memoryResult!.totalMemory) * 100}%` }} aria-label={`${block.free ? 'Free' : `PID ${block.pid}`} · ${block.size} units`} tabIndex={0}><span className="memory-layout-label">{block.free ? 'FREE' : `P${block.pid}`}</span><span className="chart-hover-tooltip" aria-hidden="true">{block.free ? 'Free' : `PID ${block.pid}`} · {block.size} units</span></div>)}</div><p>{row.memoryResult.allocatedMemory} allocated · {row.memoryResult.freeMemory} free · largest {row.memoryResult.largestFreeBlock} · {row.memoryResult.externalFragmentation.toFixed(1)}% fragmented</p><details><summary>Request outcomes</summary><ol>{row.memoryResult.operations.map((operation) => <li key={operation.index} className={operation.succeeded ? '' : 'failed'}>{operation.operation} PID {operation.pid}{operation.amount ? ` · ${operation.amount} units` : ''}: {operation.outcome}</li>)}</ol></details></article>)}</div></Panel>}
  </div>
}

function ScheduleGantt({ label, gantt }: { label: string; gantt: Array<{ pid: number; processName: string; startTime: number; endTime: number; duration: number; idle: boolean }> }) {
  const scale = Math.max(1, ...gantt.map((segment) => segment.endTime))
  return <div className="comparison-gantt-row"><div className="comparison-gantt-label"><b>{label}</b><small>0 — {scale}</small></div><div className="comparison-gantt-track" role="img" aria-label={`Gantt chart for ${label}`}>{gantt.map((segment, index) => { const detail = `${segment.idle ? 'CPU idle' : `${segment.processName} PID ${segment.pid}`}: ${segment.startTime}–${segment.endTime}`; return <div key={`${segment.startTime}-${index}`} className={`comparison-gantt-segment ${segment.idle ? 'idle' : index % 2 ? 'alternate' : ''}`} style={{ left: `${segment.startTime / scale * 100}%`, width: `${segment.duration / scale * 100}%` }} aria-label={detail} tabIndex={0}><span className="gantt-segment-label">{segment.idle ? 'IDLE' : `P${segment.pid}`}</span><span className="chart-hover-tooltip" aria-hidden="true">{detail}</span></div> })}</div></div>
}

function formatValue(value: number, metric: string) { return metric === 'cpuUtilization' || metric === 'externalFragmentation' ? `${value.toFixed(1)}%` : metric === 'throughput' ? `${value.toFixed(3)} / tick` : Number.isInteger(value) ? String(value) : value.toFixed(2) }
function isMaximizedMetric(metric: string) { return ['cpuUtilization', 'throughput', 'successfulAllocations', 'totalFreeMemory', 'largestFreeBlock', 'allocatedMemory'].includes(metric) }
function signed(value: number) { return `${value > 0 ? '+' : ''}${value}` }
