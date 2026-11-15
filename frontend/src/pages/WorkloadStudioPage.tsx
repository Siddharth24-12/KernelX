import { useEffect, useMemo, useState } from 'react'
import { Copy, Play, Plus, Save, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { workloadsApi, type Workload, type WorkloadInput, type WorkloadProcess, type WorkloadValidation } from '../api/workloads'
import { errorMessage } from '../api/client'
import { Button, Empty, ErrorBanner, Field, Loading, PageIntro, Panel } from '../components/common'
import type { Algorithm, MemoryStrategy } from '../types/api'
import { useNavigate } from 'react-router-dom'
import { PENDING_PREFERENCES_KEY } from './schedulerPreferences'

const blankProcess = (pid: number): WorkloadProcess => ({ pid, name: `process-${pid}`, priority: 5, arrivalTime: 0, burstTime: 4, memoryRequirement: 128, parentPid: -1 })
const emptyWorkload: WorkloadInput = { name: '', description: '', processes: [blankProcess(62001)], algorithm: 'FCFS', timeQuantum: 2, preemptivePriority: false, totalMemory: 1024, memoryAllocationStrategy: 'FIRST_FIT', speed: 1 }
const algorithms: Algorithm[] = ['FCFS', 'SJF', 'ROUND_ROBIN', 'PRIORITY']

export function WorkloadStudioPage() {
  const navigate = useNavigate()
  const [saved, setSaved] = useState<Workload[]>([]); const [templates, setTemplates] = useState<Workload[]>([])
  const [draft, setDraft] = useState<WorkloadInput>(emptyWorkload); const [editingId, setEditingId] = useState<string | null>(null)
  const [validation, setValidation] = useState<WorkloadValidation | null>(null); const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true)
  const ready = useMemo(() => draft.name.trim().length > 0 && draft.processes.length > 0, [draft])

  async function refresh() { const [items, builtins] = await Promise.all([workloadsApi.list(), workloadsApi.templates()]); setSaved(items.filter((item) => !item.id.startsWith('builtin-'))); setTemplates(builtins) }
  useEffect(() => { void refresh().catch((reason) => setError(errorMessage(reason))).finally(() => setLoading(false)) }, [])
  function retryLibrary() { setLoading(true); setError(''); void refresh().catch((reason) => setError(errorMessage(reason))).finally(() => setLoading(false)) }
  function set<K extends keyof WorkloadInput>(key: K, value: WorkloadInput[K]) { setDraft((current) => ({ ...current, [key]: value })); setValidation(null) }
  function updateProcess(index: number, update: Partial<WorkloadProcess>) { set('processes', draft.processes.map((process, i) => i === index ? { ...process, ...update } : process)) }
  function select(item: Workload) { setDraft({ name: item.name, description: item.description, processes: item.processes.map((process) => ({ ...process })), algorithm: item.algorithm, timeQuantum: item.timeQuantum, preemptivePriority: item.preemptivePriority, totalMemory: item.totalMemory, memoryAllocationStrategy: item.memoryAllocationStrategy, speed: item.speed }); setEditingId(item.id.startsWith('builtin-') ? null : item.id); setValidation(null); setNotice(`Loaded “${item.name}” into the editor.`); setError('') }
  async function act(action: () => Promise<void>) { setBusy(true); setError(''); setNotice(''); try { await action() } catch (reason) { setError(errorMessage(reason)) } finally { setBusy(false) } }
  async function validateDraft() { await act(async () => { const result = await workloadsApi.validate(draft); setValidation(result); setNotice(result.valid ? 'Workload validation passed.' : 'Resolve the validation errors before saving or running.') }) }
  async function saveDraft() { await act(async () => { const result = editingId ? await workloadsApi.update(editingId, draft) : await workloadsApi.create(draft); setEditingId(result.id); await refresh(); setNotice(`Saved “${result.name}”.`) }) }
  async function deleteDraft(id = editingId, name = draft.name) { if (!id || !window.confirm(`Delete saved workload “${name}”?`)) return; await act(async () => { await workloadsApi.remove(id); if (editingId === id) { setEditingId(null); setDraft(emptyWorkload); setValidation(null) } await refresh(); setNotice('Workload deleted.') }) }
  async function executeDraft() {
    await act(async () => {
      const valid = validation?.valid ? validation : await workloadsApi.validate(draft)
      setValidation(valid)
      if (!valid.valid) { setNotice('Resolve the validation errors before running this workload.'); return }
      let id = editingId
      if (!id) { const created = await workloadsApi.create(draft); id = created.id; setEditingId(id); await refresh() }
      const result = await workloadsApi.execute(id)
      setNotice(`Started ${result.simulation.algorithm} with ${result.createdPids.length} processes. Open CPU Scheduler to step the run.`)
    })
  }
  async function loadDraft() {
    await act(async () => {
      const valid = await workloadsApi.validate(draft)
      setValidation(valid)
      if (!valid.valid) { setNotice('Resolve the validation errors before loading this workload.'); return }
      let id = editingId
      if (!id) { const created = await workloadsApi.create(draft); id = created.id; setEditingId(id); await refresh() }
      await workloadsApi.load(id)
      localStorage.setItem(PENDING_PREFERENCES_KEY, JSON.stringify({ algorithm: draft.algorithm, timeQuantum: draft.timeQuantum, preemptivePriority: draft.preemptivePriority, totalMemory: draft.totalMemory, memoryAllocationStrategy: draft.memoryAllocationStrategy, speed: draft.speed }))
      navigate('/scheduler')
    })
  }

  return <div className="workload-studio">
    <PageIntro eyebrow="WORKLOAD / 06A" title="Workload Studio" description="Compose reusable process sets, validate their hierarchy and run them through the existing KernelX scheduler." action={<Button onClick={() => { setDraft({ ...emptyWorkload, processes: [blankProcess(nextPid(draft.processes))] }); setEditingId(null); setValidation(null); setNotice('New workload draft ready.'); setError('') }}><Plus size={15} /> New workload</Button>} />
    {error && <ErrorBanner message={error} onRetry={retryLibrary} />}{notice && <div className={notice.includes('passed') || notice.includes('Saved') || notice.includes('Started') || notice.includes('deleted') ? 'success-banner' : 'notice-banner'} role="status">{notice}</div>}
    <div className="workload-layout">
      <div className="workload-library">
        <Panel title="Saved workloads" meta={<span className="section-meta">{saved.length} STORED</span>}>
          {loading ? <Loading label="Loading workload library…" /> : saved.length ? <div className="workload-list">{saved.map((item) => <article key={item.id} className={`workload-list-item ${editingId === item.id ? 'selected' : ''}`}><button className="workload-load" onClick={() => select(item)}><b>{item.name}</b><small>{item.processes.length} processes · {item.algorithm.replace('_', ' ')}</small></button><Button variant="quiet" aria-label={`Delete ${item.name}`} onClick={() => void deleteDraft(item.id, item.name)}><Trash2 size={14} /></Button></article>)}</div> : <Empty title="No saved workloads" message="Save an edited workload to keep it in the local JSON library." />}
        </Panel>
        <Panel title="Built-in templates" meta={<span className="section-meta">6 DETERMINISTIC SETS</span>}>
          {loading ? <Loading label="Loading built-in templates…" /> : templates.length ? <div className="workload-list">{templates.map((item) => <article key={item.id} className="workload-list-item"><button className="workload-load" onClick={() => select(item)}><b>{item.name}</b><small>{item.description}</small></button><Copy size={14} aria-hidden="true" /></article>)}</div> : <Empty title="No built-in templates" message="The workload template endpoint returned no definitions." />}
        </Panel>
        <div className="workload-note"><ShieldCheck size={15} /><span>Templates are read-only. Loading a saved or built-in workload only changes this editor until you choose Run.</span></div>
      </div>
      <Panel className="workload-editor">
        <div className="workload-editor-head"><div><span className="eyebrow">{editingId ? 'SAVED WORKLOAD / EDIT' : 'WORKLOAD DEFINITION'}</span><h2>{draft.name || 'Untitled workload'}</h2></div><span className="workload-state">{editingId ? 'SAVED' : 'DRAFT'}</span></div>
        <div className="workload-meta-grid"><Field label="Workload name"><input maxLength={80} value={draft.name} onChange={(event) => set('name', event.target.value)} placeholder="e.g. Mixed arrival test" /></Field><Field label="Description"><input maxLength={500} value={draft.description} onChange={(event) => set('description', event.target.value)} placeholder="What should this workload demonstrate?" /></Field></div>
        <div className="workload-config-grid"><Field label="Scheduling algorithm"><select value={draft.algorithm} onChange={(event) => set('algorithm', event.target.value as Algorithm)}>{algorithms.map((algorithm) => <option key={algorithm}>{algorithm}</option>)}</select></Field>{draft.algorithm === 'ROUND_ROBIN' && <Field label="Time quantum"><input type="number" min="1" value={draft.timeQuantum} onChange={(event) => set('timeQuantum', Math.max(1, Number(event.target.value)))} /></Field>}{draft.algorithm === 'PRIORITY' && <label className="check-field"><input type="checkbox" checked={draft.preemptivePriority} onChange={(event) => set('preemptivePriority', event.target.checked)} /><span><b>Preemptive priority</b></span></label>}<Field label="Total memory"><input type="number" min="1" value={draft.totalMemory} onChange={(event) => set('totalMemory', Math.max(1, Number(event.target.value)))} /></Field><Field label="Memory strategy"><select value={draft.memoryAllocationStrategy} onChange={(event) => set('memoryAllocationStrategy', event.target.value as MemoryStrategy)}><option value="FIRST_FIT">First Fit</option><option value="BEST_FIT">Best Fit</option><option value="WORST_FIT">Worst Fit</option></select></Field><Field label="Simulation speed"><input type="number" min="0.1" max="10" step="0.1" value={draft.speed} onChange={(event) => set('speed', Math.min(10, Math.max(.1, Number(event.target.value))))} /></Field></div>
        <div className="workload-process-head"><div><h3>Process definitions</h3><small>Parent definitions are created before their children at execution time.</small></div><Button variant="secondary" onClick={() => set('processes', [...draft.processes, blankProcess(nextPid(draft.processes))])}><Plus size={14} /> Add process</Button></div>
        <div className="workload-process-table-wrap"><table className="workload-process-table"><thead><tr><th>PID</th><th>NAME</th><th>PRIORITY</th><th>ARRIVAL</th><th>BURST</th><th>MEMORY</th><th>PARENT</th><th /></tr></thead><tbody>{draft.processes.map((process, index) => <tr key={`${index}-${process.pid}`}><td><input aria-label={`PID row ${index + 1}`} type="number" min="1" value={process.pid} onChange={(event) => updateProcess(index, { pid: Number(event.target.value) })} /></td><td><input aria-label={`Name row ${index + 1}`} value={process.name} onChange={(event) => updateProcess(index, { name: event.target.value })} /></td><td><input aria-label={`Priority row ${index + 1}`} type="number" min="0" max="10" value={process.priority} onChange={(event) => updateProcess(index, { priority: Number(event.target.value) })} /></td><td><input aria-label={`Arrival row ${index + 1}`} type="number" min="0" value={process.arrivalTime} onChange={(event) => updateProcess(index, { arrivalTime: Number(event.target.value) })} /></td><td><input aria-label={`Burst row ${index + 1}`} type="number" min="1" value={process.burstTime} onChange={(event) => updateProcess(index, { burstTime: Number(event.target.value) })} /></td><td><input aria-label={`Memory row ${index + 1}`} type="number" min="1" value={process.memoryRequirement} onChange={(event) => updateProcess(index, { memoryRequirement: Number(event.target.value) })} /></td><td><select aria-label={`Parent row ${index + 1}`} value={process.parentPid} onChange={(event) => updateProcess(index, { parentPid: Number(event.target.value) })}><option value={-1}>Root</option>{draft.processes.filter((_, candidateIndex) => candidateIndex !== index).map((candidate) => <option key={candidate.pid} value={candidate.pid}>P{candidate.pid}</option>)}</select></td><td><button className="icon-button" aria-label={`Remove process row ${index + 1}`} disabled={draft.processes.length <= 1} onClick={() => set('processes', draft.processes.filter((_, i) => i !== index))}><Trash2 size={14} /></button></td></tr>)}</tbody></table></div>
        {validation && <div className={`workload-validation ${validation.valid ? 'valid' : 'invalid'}`}><b>{validation.valid ? 'VALIDATION PASSED' : 'VALIDATION ERRORS'}</b>{validation.errors.map((item, index) => <span key={`e${index}`}>{item}</span>)}{validation.warnings.map((item, index) => <span className="warning" key={`w${index}`}>{item}</span>)}</div>}
        <div className="workload-actions"><Button variant="quiet" disabled={busy || !ready} onClick={() => void validateDraft()}><ShieldCheck size={15} /> Validate</Button><Button variant="secondary" disabled={busy || !ready} onClick={() => void saveDraft()}><Save size={15} /> {editingId ? 'Update saved' : 'Save workload'}</Button>{editingId && <Button variant="danger" disabled={busy} onClick={() => void deleteDraft()}><Trash2 size={15} /> Delete</Button>}<Button variant="secondary" disabled={busy || !ready} onClick={() => void loadDraft()}><Upload size={15} /> Load into simulator</Button><Button disabled={busy || !ready} onClick={() => void executeDraft()}><Play size={15} /> Run workload</Button></div>
        <p className="workload-run-note"><Upload size={14} /> Loading creates real process records and transfers the saved scheduler settings to CPU Scheduler. Running starts the schedule immediately. Both require an empty process table and a READY simulation.</p>
      </Panel>
    </div>
  </div>
}

function nextPid(processes: WorkloadProcess[]) { return Math.max(62000, ...processes.map((process) => process.pid)) + 1 }
