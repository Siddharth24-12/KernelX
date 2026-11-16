import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ArrowDownUp, Eye, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { errorMessage } from '../api/client'
import { processesApi, type CreateProcessInput } from '../api/processes'
import { Button, Empty, Field, PageIntro, Panel, StatusPill } from '../components/common'
import type { useSystemData } from '../hooks/useSystemData'
import type { ProcessRecord, ProcessState } from '../types/api'

type Context = ReturnType<typeof useSystemData>
type ProcessForm = { pid: string; name: string; priority: string; arrivalTime: string; burstTime: string; memoryRequirement: string }
type ProcessField = keyof ProcessForm
type ProcessErrors = Partial<Record<ProcessField, string>>
const blankForm = (): ProcessForm => ({ pid: '', name: '', priority: '5', arrivalTime: '0', burstTime: '5', memoryRequirement: '128' })
const fields: { key: ProcessField; label: string; min?: number; max?: number; hint: string }[] = [
  { key: 'pid', label: 'Process ID', min: 1, hint: 'Positive integer; must be unique.' },
  { key: 'name', label: 'Name', hint: 'A readable process name.' },
  { key: 'priority', label: 'Priority', min: 0, max: 10, hint: 'Integer from 0 to 10; zero is valid.' },
  { key: 'arrivalTime', label: 'Arrival tick', min: 0, hint: 'Integer zero or greater.' },
  { key: 'burstTime', label: 'CPU burst', min: 1, hint: 'Positive integer.' },
  { key: 'memoryRequirement', label: 'Memory units', min: 1, hint: 'Positive integer.' },
]

function validateForm(form: ProcessForm): ProcessErrors {
  const errors: ProcessErrors = {}
  if (!form.name.trim()) errors.name = 'Enter a process name.'
  for (const key of ['pid', 'priority', 'arrivalTime', 'burstTime', 'memoryRequirement'] as const) {
    const raw = form[key].trim()
    const value = Number(raw)
    if (!raw) { errors[key] = 'This value is required.'; continue }
    if (!Number.isInteger(value)) { errors[key] = 'Enter a whole number.'; continue }
    if (key === 'pid' && value < 1) errors.pid = 'PID must be a positive integer.'
    if (key === 'priority' && (value < 0 || value > 10)) errors.priority = 'Priority must be from 0 to 10.'
    if (key === 'arrivalTime' && value < 0) errors.arrivalTime = 'Arrival tick must be zero or greater.'
    if ((key === 'burstTime' || key === 'memoryRequirement') && value < 1) errors[key] = key === 'burstTime' ? 'CPU burst must be positive.' : 'Memory requirement must be positive.'
  }
  return errors
}

export function ProcessesPage() {
  const { processes, memory, simulation, refresh, setProcesses, connected } = useOutletContext<Context>()
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('ALL'); const [sort, setSort] = useState<'pid' | 'arrivalTime' | 'priority'>('pid')
  const [selected, setSelected] = useState<ProcessRecord | null>(null); const [createOpen, setCreateOpen] = useState(false); const [form, setForm] = useState<ProcessForm>(blankForm); const [formErrors, setFormErrors] = useState<ProcessErrors>({})
  const [parentPid, setParentPid] = useState(-1); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<ProcessRecord | null>(null); const [editPriority, setEditPriority] = useState(''); const [editError, setEditError] = useState('')
  const editable = simulation?.status !== 'RUNNING' && simulation?.status !== 'PAUSED'
  const rows = useMemo(() => processes.filter((p) => (filter === 'ALL' || p.state === filter) && `${p.pid} ${p.name}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => a[sort] - b[sort]), [processes, filter, query, sort])

  async function create(event: React.FormEvent) {
    event.preventDefault()
    const errors = validateForm(form)
    setFormErrors(errors)
    if (Object.keys(errors).length) return
    const body: CreateProcessInput = {
      pid: Number(form.pid), name: form.name.trim(), priority: Number(form.priority), arrivalTime: Number(form.arrivalTime),
      burstTime: Number(form.burstTime), memoryRequirement: Number(form.memoryRequirement), parentPid,
    }
    setBusy(true); setMessage('')
    try {
      const created = await processesApi.create(body)
      setProcesses((current) => [...current, created]); setCreateOpen(false); setForm(blankForm()); setParentPid(-1)
      setMessage(`Process ${created.pid} entered the process table.`); await refresh()
    } catch (cause) { setMessage(errorMessage(cause)) }
    finally { setBusy(false) }
  }

  async function remove(process: ProcessRecord) {
    if (!window.confirm(`Terminate PID ${process.pid} and any child processes?`)) return
    setBusy(true); setMessage('')
    try { await processesApi.remove(process.pid); setSelected(null); setMessage(`PID ${process.pid} terminated.`); await refresh() }
    catch (cause) { setMessage(errorMessage(cause)) }
    finally { setBusy(false) }
  }

  async function togglePause(process: ProcessRecord) { setBusy(true); try { await (process.state === 'PAUSED' ? processesApi.resume(process.pid) : processesApi.pause(process.pid)); await refresh() } catch (cause) { setMessage(errorMessage(cause)) } finally { setBusy(false) } }

  function openEdit(process: ProcessRecord) { setEditing(process); setEditPriority(String(process.priority)); setEditError('') }
  async function savePriority(event: React.FormEvent) {
    event.preventDefault()
    const value = Number(editPriority)
    if (!editPriority.trim() || !Number.isInteger(value) || value < 0 || value > 10) { setEditError('Priority must be a whole number from 0 to 10.'); return }
    if (!editing) return
    setBusy(true); setEditError('')
    try { const updated = await processesApi.priority(editing.pid, value); if (selected?.pid === updated.pid) setSelected(updated); setMessage(`Priority updated for PID ${editing.pid}.`); setEditing(null); await refresh() }
    catch (cause) { setEditError(errorMessage(cause)) }
    finally { setBusy(false) }
  }

  return <div className="process-page">
    <PageIntro eyebrow="WORKLOAD / 02" title="Process manager" description="Inspect process control blocks and manage the simulation workload." action={<Button onClick={() => { setCreateOpen(true); setFormErrors({}); setMessage('') }} disabled={!connected || !editable}><Plus size={17} /> New process</Button>} />
    {!editable && <div className="notice-banner">Process definition changes are locked while the simulation is {simulation?.status?.toLowerCase()}. Reset the run to edit the workload.</div>}
    {message && <div className={message.includes('entered') || message.includes('terminated') || message.includes('updated') ? 'success-banner' : 'notice-banner'} role="status">{message}</div>}
    <Panel className="process-panel">
      <div className="table-toolbar"><div className="table-count"><strong>{String(processes.length).padStart(2, '0')}</strong><span>PROCESS RECORDS</span></div><div className="toolbar-filters"><label className="search-field"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search PID or name" aria-label="Search processes" /></label><select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter process state"><option value="ALL">All states</option>{(['NEW', 'READY', 'RUNNING', 'WAITING', 'PAUSED', 'TERMINATED'] as ProcessState[]).map((state) => <option key={state}>{state}</option>)}</select><button className="sort-button" onClick={() => setSort((old) => old === 'pid' ? 'arrivalTime' : old === 'arrivalTime' ? 'priority' : 'pid')}><ArrowDownUp size={16} /> Sort by {sort === 'arrivalTime' ? 'arrival' : sort}</button></div></div>
      {rows.length ? <div className="table-scroll"><table className="process-table"><thead><tr><th>Identity</th><th>Arrival</th><th>Burst</th><th>Remaining</th><th>Priority</th><th>State</th><th>Memory / request</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{rows.map((process) => {
        const allocation = memory?.blocks.find((block) => block.pid === process.pid)
        return <tr key={process.pid} className={selected?.pid === process.pid ? 'row-selected' : ''}>
          <td><button className="process-identity" onClick={() => setSelected(process)}><span className="pid-badge">P{process.pid}</span><span><b>{process.name}</b><small>Parent {process.parentPid < 0 ? '—' : `P${process.parentPid}`}</small></span></button></td>
          <td className="mono">{process.arrivalTime}</td><td className="mono">{process.burstTime}</td><td className="mono remaining-value">{process.remainingTime}</td>
          <td><span className="process-priority-value">{process.priority}</span></td><td><StatusPill state={process.state} /></td>
          <td className="mono">{allocation ? allocation.size : '—'}<small className="cell-unit">{allocation ? 'ALLOCATED' : 'NOT ALLOCATED'} · request {process.memoryRequirement}</small></td>
          <td><div className="process-row-actions"><Button variant="quiet" className="process-edit-button" aria-label={`Edit priority for PID ${process.pid}`} onClick={() => openEdit(process)} disabled={!editable || busy}><Pencil size={15} /><span>Edit</span></Button><button className="icon-button" aria-label={`Inspect PID ${process.pid}`} onClick={() => setSelected(process)}><Eye size={17} /></button></div></td>
        </tr>
      })}</tbody></table></div> : <Empty title={processes.length ? 'No matching processes' : 'Process table is empty'} message={processes.length ? 'Adjust your search or state filter.' : 'Create the first process record to build a workload for the scheduler.'} />}
      <div className="table-foot"><span>ORDERED BY {sort === 'arrivalTime' ? 'ARRIVAL' : sort.toUpperCase()}</span><span>{rows.length} VISIBLE <b>·</b> {processes.length} TOTAL</span></div>
    </Panel>

    {createOpen && <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setCreateOpen(false); setForm(blankForm()); setFormErrors({}) } }}><section className="modal process-create-modal" role="dialog" aria-modal="true" aria-labelledby="create-title"><div className="modal-head"><div><span className="eyebrow">PROCESS TABLE / INSERT</span><h2 id="create-title">Create process</h2><p>Define the process control block and optional parent.</p></div><button className="icon-button" onClick={() => setCreateOpen(false)} aria-label="Close form"><X size={19} /></button></div>
      <form onSubmit={(event) => void create(event)} noValidate><div className="form-grid">{fields.map(({ key, label, min, max, hint }) => <Field key={key} label={label} hint={formErrors[key] ?? hint}>{key === 'name' ? <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} aria-invalid={Boolean(formErrors.name)} placeholder="e.g. compiler" /> : <input required type="number" inputMode="numeric" step="1" min={min} max={max} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} aria-invalid={Boolean(formErrors[key])} />}</Field>)}<Field label="Parent process" hint="Root process or an existing process."><select value={parentPid} onChange={(event) => setParentPid(Number(event.target.value))}><option value={-1}>Root process</option>{processes.filter((process) => process.state !== 'TERMINATED').map((process) => <option key={process.pid} value={process.pid}>PID {process.pid} · {process.name}</option>)}</select></Field></div>
        {Object.keys(formErrors).length > 0 && <p className="form-error-summary" role="alert">Review the highlighted fields before creating this process.</p>}
        <div className="modal-actions"><Button type="button" variant="quiet" onClick={() => { setCreateOpen(false); setForm(blankForm()); setFormErrors({}) }}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create process'}</Button></div>
      </form>
    </section></div>}

    {editing && <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null) }}><section className="modal process-edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-process-title"><div className="modal-head"><div><span className="eyebrow">PROCESS CONTROL BLOCK · P{editing.pid}</span><h2 id="edit-process-title">Edit process priority</h2><p>{editing.name} · {editing.state}</p></div><button className="icon-button" aria-label="Close edit dialog" onClick={() => setEditing(null)}><X size={19} /></button></div>
      <form onSubmit={(event) => void savePriority(event)} noValidate><Field label="Priority" hint={editError || 'Whole number from 0 to 10; zero is valid.'}><input aria-label="Priority value" type="number" inputMode="numeric" step="1" min="0" max="10" required value={editPriority} onChange={(event) => { setEditPriority(event.target.value); setEditError('') }} aria-invalid={Boolean(editError)} /></Field><p className="process-edit-limitation">Process identity, timing and memory fields are immutable through the current API. Only priority can be changed.</p>
        <div className="modal-actions"><Button type="button" variant="quiet" onClick={() => { setEditing(null); setEditError('') }}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save priority'}</Button></div>
      </form>
    </section></div>}

    {selected && <aside className="detail-drawer" aria-label={`Details for PID ${selected.pid}`}><div className="drawer-head"><div><span className="eyebrow">PROCESS CONTROL BLOCK</span><h2>{selected.name}</h2><span className="mono">PID {selected.pid}</span></div><button className="icon-button" aria-label="Close process details" onClick={() => setSelected(null)}><X size={19} /></button></div><div className="drawer-state"><span>STATE</span><StatusPill state={selected.state} /></div><dl className="detail-list">{[['Parent PID', selected.parentPid < 0 ? 'Root process' : selected.parentPid], ['Priority', selected.priority], ['Arrival time', selected.arrivalTime], ['CPU burst', selected.burstTime], ['Remaining time', selected.remainingTime], ['Memory request', `${selected.memoryRequirement} units`], ['Completion', selected.completionTime < 0 ? 'Not completed' : selected.completionTime], ['Waiting time', selected.waitingTime], ['Turnaround', selected.turnaroundTime < 0 ? '—' : selected.turnaroundTime], ['Response', selected.responseTime < 0 ? '—' : selected.responseTime]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className="drawer-actions">{selected.state === 'PAUSED' || selected.state === 'READY' || selected.state === 'NEW' ? <Button variant="secondary" disabled={!editable || busy} onClick={() => void togglePause(selected)}>{selected.state === 'PAUSED' ? 'Resume process' : 'Pause process'}</Button> : null}<Button variant="quiet" disabled={!editable || busy} onClick={() => openEdit(selected)}><Pencil size={16} /> Edit priority</Button><Button variant="danger" disabled={!editable || busy} onClick={() => void remove(selected)}><Trash2 size={16} /> Terminate process</Button></div></aside>}
  </div>
}
