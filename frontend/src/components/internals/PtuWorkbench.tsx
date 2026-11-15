import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, Empty, ErrorBanner, Loading } from '../common'
import type { PtuNodeSnapshot, PtuSnapshot, PtuTrace, PtuTraceSummary } from '../../types/api'

export function PtuWorkbench({ snapshot, traces, trace, selectedTraceId, stepIndex, loading, traceLoading, error, onRefresh, onSelectTrace, onStep, onFocus }: {
  snapshot: PtuSnapshot | null; traces: PtuTraceSummary[]; trace: PtuTrace | null; selectedTraceId: string; stepIndex: number
  loading: boolean; traceLoading: boolean; error: string; onRefresh: () => void; onSelectTrace: (id: string) => void; onStep: (index: number) => void; onFocus: () => void
}) {
  const [selectedPid, setSelectedPid] = useState<number | null>(null)
  const nodes = trace?.finalTree ?? snapshot?.nodes ?? []
  const byPid = useMemo(() => new Map(nodes.map((n) => [n.pid, n])), [nodes])
  const selected = selectedPid == null ? null : byPid.get(selectedPid) ?? null
  const active = trace && stepIndex >= 0 ? trace.steps[stepIndex] ?? null : null
  return <section className="pmu-workbench ptu-workbench" aria-label="Process Tree Visualization Unit">
    <div className="pmu-workbench-head"><div><span className="chip-serial">CPU INTERNALS / PROCESS HIERARCHY</span><h2>PROCESS TREE VISUALIZATION UNIT</h2><p>Actual Java first-child / next-sibling links. A child chain represents multiple children; links are not binary-tree branches.</p></div><div className="pmu-workbench-actions"><Button variant="quiet" onClick={onFocus}>Focus PTU</Button><Button variant="quiet" onClick={onRefresh} disabled={loading}><RefreshCw size={15}/> Refresh</Button></div></div>
    {error && <ErrorBanner message={error} onRetry={onRefresh}/>}
    {loading && !snapshot ? <Loading label="Reading process tree snapshot…"/> : snapshot ? <>
      <div className="ptu-metrics"><span>{snapshot.size} NODES</span><span>{snapshot.rootCount} ROOTS</span><span>{trace ? 'RECORDED FINAL TREE' : 'LIVE TREE'}</span><span>{snapshot.truncated ? 'SNAPSHOT TRUNCATED' : 'SNAPSHOT COMPLETE'}</span></div>
      <div className="ptu-table-wrap"><table className="ptu-table"><thead><tr><th>Process</th><th>State</th><th>Parent PID</th><th>First child</th><th>Next sibling</th></tr></thead><tbody>
        {nodes.map((node: PtuNodeSnapshot) => <tr key={node.nodeId} className={`${selectedPid === node.pid ? 'selected' : ''} ${active?.visitedPid === node.pid || active?.currentPid === node.pid ? 'active' : ''}`} onClick={() => setSelectedPid(node.pid)}><td><button onClick={() => setSelectedPid(node.pid)}>P{node.pid} · {node.name}</button></td><td>{node.state}</td><td>{node.parentPid === -1 ? 'ROOT' : `P${node.parentPid}`}</td><td>{node.firstChildPid == null ? 'NULL' : `P${node.firstChildPid}`}</td><td>{node.nextSiblingPid == null ? 'NULL' : `P${node.nextSiblingPid}`}</td></tr>)}
      </tbody></table>{!nodes.length && <Empty title="Empty process forest" message="Create a root process in Process Manager to populate the PTU."/>}</div>
      {selected ? <div className="ptu-selected"><b>SELECTED · P{selected.pid} / {selected.name}</b><span>Parent: {selected.parentPid === -1 ? 'none (root)' : `P${selected.parentPid}`} · First child: {selected.firstChildPid ?? 'NULL'} · Next sibling: {selected.nextSiblingPid ?? 'NULL'}</span></div> : <p className="alu-readonly">Select a process row to inspect its actual links.</p>}
      <div className="internals-run-select ptu-trace-select"><label htmlFor="ptu-trace-select">PROCESS TREE OPERATION HISTORY</label><select id="ptu-trace-select" value={selectedTraceId} onChange={(e) => onSelectTrace(e.target.value)} disabled={!traces.length || traceLoading}><option value="">Live hierarchy · no trace selected</option>{traces.map((item) => <option key={item.traceId} value={item.traceId}>{item.operation} · PID {item.targetPid ?? '—'} · {item.stepCount} steps · {new Date(item.recordedAt).toLocaleString()}</option>)}</select></div>
      {traceLoading ? <Loading label="Loading recorded tree operation…"/> : trace ? <>
        <div className="ptu-controls"><Button variant="quiet" aria-label="Previous PTU operation" disabled={stepIndex < 0} onClick={() => onStep(stepIndex - 1)}><ArrowLeft size={15}/> Previous</Button><Button variant="quiet" aria-label="Next PTU operation" disabled={stepIndex >= trace.steps.length - 1} onClick={() => onStep(stepIndex + 1)}>Next <ArrowRight size={15}/></Button><span>{active ? `${active.sequence}/${trace.steps.length} · ${active.operation}` : `TRACE FINAL STATE · ${trace.steps.length} steps`}</span></div>
        {active && <div className="ptu-selected"><b>{active.operation} {active.currentPid == null ? '' : `· P${active.currentPid}`}</b><span>{active.description}</span><code>{active.pointerChange ? `${active.pointerChange}: ${active.pointerBeforePid ?? 'NULL'} → ${active.pointerAfterPid ?? 'NULL'}` : 'No pointer write in this step'} · firstChild {active.firstChildBefore ?? '—'} → {active.firstChildAfter ?? '—'} · nextSibling {active.nextSiblingBefore ?? '—'} → {active.nextSiblingAfter ?? '—'}</code></div>}
        <p className="alu-readonly">Replay is read only. The backend records the final tree and actual pointer writes per operation; intermediate full-tree snapshots are not recorded, so the tree view remains at the recorded final state while the selected operation and pointer change are highlighted.</p>
        <div className="alu-step-list" role="list" aria-label="Recorded process tree operations">{trace.steps.map((step, i) => <button role="listitem" key={step.sequence} className={i === stepIndex ? 'active' : ''} onClick={() => onStep(i)}><code>{String(step.sequence).padStart(3, '0')}</code><b>{step.operation}</b><span>{step.description}</span></button>)}</div>
      </> : traces.length ? <p className="alu-readonly">Select a recorded operation to replay.</p> : <p className="alu-readonly">Process creation, deletion, searches and explicit traversals populate bounded in-memory history. Diagnostic snapshots do not create traces.</p>}
    </> : null}
  </section>
}
