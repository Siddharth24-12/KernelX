import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { errorMessage } from '../api/client'
import { processTreeApi } from '../api/tree'
import { Button, Empty, ErrorBanner, PageIntro, Panel, StatusPill } from '../components/common'
import type { ProcessTreeNode } from '../types/api'

function flatten(nodes: ProcessTreeNode[]): ProcessTreeNode[] { return nodes.flatMap((node) => [node, ...flatten(node.children)]) }
function TreeBranch({ nodes, depth, expanded, toggle, select, selected }: { nodes: ProcessTreeNode[]; depth: number; expanded: Set<number>; toggle: (pid: number) => void; select: (node: ProcessTreeNode) => void; selected: number | null }) {
  return <>{nodes.map((node) => <div key={node.pid}><div className={`tree-row ${selected === node.pid ? 'tree-selected' : ''}`} style={{ paddingLeft: `${depth * 20 + 8}px` }}>
    <button className="tree-toggle" aria-label={`${expanded.has(node.pid) ? 'Collapse' : 'Expand'} PID ${node.pid}`} onClick={() => toggle(node.pid)} disabled={!node.children.length}>{node.children.length ? expanded.has(node.pid) ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : <span className="tree-leaf">·</span>}</button>
    <button className="tree-process" onClick={() => select(node)}><span className="mono">P{node.pid}</span><b>{node.name}</b><StatusPill state={node.state} /></button>
  </div>{node.children.length > 0 && expanded.has(node.pid) && <TreeBranch nodes={node.children} depth={depth + 1} expanded={expanded} toggle={toggle} select={select} selected={selected} />}</div>)}</>
}
export function ProcessTreePage() {
  const [tree, setTree] = useState<ProcessTreeNode[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [expanded, setExpanded] = useState(new Set<number>()); const [selectedPid, setSelectedPid] = useState<number | null>(null)
  async function load() { setLoading(true); setError(''); try { const nodes = await processTreeApi.get(); setTree(nodes); setExpanded(new Set(flatten(nodes).map((node) => node.pid))); if (!nodes.length) setSelectedPid(null) } catch (cause) { setError(errorMessage(cause)) } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])
  const selected = useMemo(() => flatten(tree).find((node) => node.pid === selectedPid), [tree, selectedPid])
  const toggle = (pid: number) => setExpanded((value) => { const next = new Set(value); next.has(pid) ? next.delete(pid) : next.add(pid); return next })
  return <><PageIntro eyebrow="PROCESS SUBSYSTEM / 05" title="Process tree" description="Inspect the live parent-child hierarchy maintained by the kernel process tree." action={<Button variant="quiet" onClick={() => void load()} disabled={loading}><RefreshCw size={15} /> Refresh</Button>} />
    {error && <ErrorBanner message={error} onRetry={() => void load()} />}
    <div className="tool-grid tree-grid"><Panel title="Process hierarchy" meta={<span className="section-meta">FIRST CHILD / NEXT SIBLING · {flatten(tree).length} NODES</span>}><div className="tool-actions"><Button variant="quiet" onClick={() => setExpanded(new Set(flatten(tree).map((node) => node.pid)))}>Expand all</Button><Button variant="quiet" onClick={() => setExpanded(new Set())}>Collapse all</Button></div>{loading ? <div className="tool-loading">Loading process hierarchy…</div> : tree.length ? <div className="tree-list" role="tree" aria-label="Process hierarchy"><TreeBranch nodes={tree} depth={0} expanded={expanded} toggle={toggle} select={(node) => setSelectedPid(node.pid)} selected={selectedPid} /></div> : !error && <Empty title="No processes in the tree" message="Create a process in Process Manager to see its hierarchy here." />}</Panel>
      <Panel title="Selected process" meta={<span className="section-meta">NODE INSPECTOR</span>}>{selected ? <><div className="tree-detail-head"><span className="mono">PID {selected.pid}</span><StatusPill state={selected.state} /></div><h3 className="tree-detail-name">{selected.name}</h3><dl className="detail-grid">{[['Parent PID', selected.parentPid === -1 ? 'ROOT' : selected.parentPid], ['Priority', selected.priority], ['Arrival time', selected.arrivalTime], ['Burst time', selected.burstTime], ['Remaining time', selected.remainingTime], ['Memory', `${selected.memoryRequirement} units`], ['Children', selected.children.length]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></> : <Empty title="Select a process" message="Choose any node to inspect its process state and execution details." />}</Panel></div>
  </>
}
