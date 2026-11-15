import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PtuWorkbench } from './PtuWorkbench'
import type { PtuSnapshot, PtuTrace } from '../../types/api'

const snapshot: PtuSnapshot = { size: 3, rootCount: 1, rootPids: [1], truncated: false, nodes: [
  { nodeId:1, pid: 1, name: 'root', state: 'READY', parentPid: -1, firstChildPid: 2, nextSiblingPid: null },
  { nodeId:2, pid: 2, name: 'child-a', state: 'RUNNING', parentPid: 1, firstChildPid: null, nextSiblingPid: 3 },
  { nodeId:3, pid: 3, name: 'child-b', state: 'NEW', parentPid: 1, firstChildPid: null, nextSiblingPid: null },
] }
const trace: PtuTrace = { traceId:'t1', operation:'INSERT', targetPid:3, recordedAt:'2026-01-01T00:00:00Z', stepCount:2, truncated:false, finalTree:snapshot.nodes,
  steps:[{sequence:1,operation:'SIBLING_TRAVERSAL',currentPid:2,parentPid:1,firstChildBefore:null,firstChildAfter:null,nextSiblingBefore:null,nextSiblingAfter:null,visitedPid:2,pointerChange:null,pointerBeforePid:null,pointerAfterPid:null,description:'Visited sibling'},
    {sequence:2,operation:'NEXT_SIBLING_UPDATE',currentPid:2,parentPid:1,firstChildBefore:null,firstChildAfter:null,nextSiblingBefore:null,nextSiblingAfter:3,visitedPid:3,pointerChange:'P2.nextSibling',pointerBeforePid:null,pointerAfterPid:3,description:'Linked final child'}] }
const summary = { traceId:'t1', operation:'INSERT', targetPid:3, recordedAt:'2026-01-01T00:00:00Z', stepCount:2, truncated:false }

describe('PtuWorkbench', () => {
  it('renders actual roots, first-child and next-sibling links and selected process details', () => {
    render(<PtuWorkbench snapshot={snapshot} traces={[]} trace={null} selectedTraceId="" stepIndex={-1} loading={false} traceLoading={false} error="" onRefresh={vi.fn()} onSelectTrace={vi.fn()} onStep={vi.fn()} onFocus={vi.fn()}/>);
    expect(screen.getByText('3 NODES')).toBeTruthy(); expect(screen.getByText('P1 · root')).toBeTruthy();
    expect(screen.getByText('P2 · child-a')).toBeTruthy(); expect(screen.getByText('P3 · child-b')).toBeTruthy();
    fireEvent.click(screen.getByText('P2 · child-a')); expect(screen.getByText(/SELECTED · P2/)).toBeTruthy();
    expect(screen.getByText(/Next sibling: 3/)).toBeTruthy();
  });
  it('renders empty and error states', () => {
    const props={traces:[],trace:null,selectedTraceId:'',stepIndex:-1,loading:false,traceLoading:false,onRefresh:vi.fn(),onSelectTrace:vi.fn(),onStep:vi.fn(),onFocus:vi.fn()};
    const { rerender }=render(<PtuWorkbench {...props} snapshot={{size:0,rootCount:0,rootPids:[],nodes:[],truncated:false}} error=""/>);
    expect(screen.getByText('Empty process forest')).toBeTruthy();
    rerender(<PtuWorkbench {...props} snapshot={null} error="API unavailable"/>); expect(screen.getByText('API unavailable')).toBeTruthy();
  });
  it('selects recorded traces and steps without changing the supplied live tree', () => {
    const onStep=vi.fn(), onSelectTrace=vi.fn(); const { rerender }=render(<PtuWorkbench snapshot={snapshot} traces={[summary]} trace={null} selectedTraceId="" stepIndex={-1} loading={false} traceLoading={false} error="" onRefresh={vi.fn()} onSelectTrace={onSelectTrace} onStep={onStep} onFocus={vi.fn()}/>);
    fireEvent.change(screen.getByLabelText('PROCESS TREE OPERATION HISTORY'),{target:{value:'t1'}}); expect(onSelectTrace).toHaveBeenCalledWith('t1');
    rerender(<PtuWorkbench snapshot={snapshot} traces={[summary]} trace={trace} selectedTraceId="t1" stepIndex={0} loading={false} traceLoading={false} error="" onRefresh={vi.fn()} onSelectTrace={onSelectTrace} onStep={onStep} onFocus={vi.fn()}/>);
    expect(screen.getByText('SIBLING_TRAVERSAL')).toBeTruthy(); fireEvent.click(screen.getByLabelText('Next PTU operation')); expect(onStep).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByLabelText('Previous PTU operation')); expect(onStep).toHaveBeenCalledWith(-1);
    expect(snapshot.nodes[1].nextSiblingPid).toBe(3);
  });
});
