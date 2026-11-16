import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { Color, Vector3 } from 'three'
import { WebglFallback } from './WebglFallback'
import type { AluTableSnapshot, AluTraceStep, FpbQueueSnapshot, FpbTraceStep, HeapEntrySnapshot, HeapTraceStep, PmuListSnapshot, PmuTraceStep, PtuSnapshot, PtuTraceStep } from '../../types/api'

const graphite = '#0B0D0C'
const cloud = '#F1F0E8'
const yellow = '#C7F36B'
const muted = '#858B82'

export function layoutHeapSlots(count: number, spacing = 1.05): Array<{ index: number; x: number; z: number; level: number }> {
  return Array.from({ length: Math.max(0, count) }, (_, index) => {
    const level = Math.floor(Math.log2(index + 1))
    const first = 2 ** level - 1
    const width = 2 ** level
    const column = index - first
    return { index, x: (column - (width - 1) / 2) * spacing, z: -level * .62, level }
  })
}

function Plate({ position, size, color, metalness = .2, roughness = .78 }: { position: [number, number, number]; size: [number, number, number]; color: string; metalness?: number; roughness?: number }) {
  return <mesh position={position} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} metalness={metalness} roughness={roughness} /></mesh>
}
function Etch({ position, size, active = false }: { position: [number, number, number]; size: [number, number, number]; active?: boolean }) {
  return <mesh position={position}><boxGeometry args={size} /><meshBasicMaterial color={active ? yellow : muted} transparent opacity={active ? .9 : .42} /></mesh>
}
function Label({ position, children, accent = false, small = false }: { position: [number, number, number]; children: string; accent?: boolean; small?: boolean }) {
  return <Html position={position} center distanceFactor={11} style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}><span className={`die-label ${accent ? 'die-label-accent' : ''} ${small ? 'die-label-small' : ''}`}>{children}</span></Html>
}

function AnimatedDescriptor({ entry, from, to, sequence }: { entry: HeapEntrySnapshot; from: [number, number, number]; to: [number, number, number]; sequence: number }) {
  const ref = useRef<import('three').Group>(null)
  const elapsed = useRef(0)
  const start = useMemo(() => new Vector3(...from), [from[0], from[1], from[2]])
  const end = useMemo(() => new Vector3(...to), [to[0], to[1], to[2]])
  const { invalidate } = useThree()
  useEffect(() => { elapsed.current = 0; invalidate() }, [sequence, invalidate])
  useFrame((_, delta) => {
    if (!ref.current || elapsed.current >= 1) return
    elapsed.current = Math.min(1, elapsed.current + delta * 2.7)
    const progress = elapsed.current * elapsed.current * (3 - 2 * elapsed.current)
    ref.current.position.lerpVectors(start, end, progress)
    if (elapsed.current < 1) invalidate()
  })
  return <group ref={ref} position={from}>
    <Plate position={[0, .01, 0]} size={[.78, .13, .4]} color={cloud} metalness={.28} roughness={.58} />
    <Plate position={[0, .083, -.17]} size={[.62, .012, .025]} color={yellow} metalness={.1} roughness={.6} />
    <Plate position={[0, .09, 0]} size={[.68, .025, .31]} color="#F7EAAF" metalness={.15} />
    <Label position={[0, .2, 0]} small>{`P${entry.pid} · π${entry.priority}`}</Label>
  </group>
}

function AluUnit({ snapshot, focused, active, onFocus }: { snapshot: AluTableSnapshot | null; focused: boolean; active: AluTraceStep | null; onFocus: () => void }) {
  const visible = snapshot?.buckets.slice(0, focused ? 32 : 8) ?? []
  const columns = focused ? 4 : 2
  const rows = Math.max(1, Math.ceil(visible.length / columns))
  const width = focused ? 5.4 : 3.25
  const depth = focused ? Math.max(4.8, rows * .73 + .9) : 4.45
  return <group position={[4.25, .14, -.08]} onClick={(event) => { event.stopPropagation(); onFocus() }}>
    <Plate position={[0, .19, 0]} size={[width, .25, depth]} color="#171915" metalness={.58} />
    <Plate position={[0, .34, 0]} size={[width - .12, .07, depth - .12]} color="#292B26" metalness={.3} />
    <Label position={[0, .48, depth / 2 - .13]}>ASSOCIATIVE LOOKUP UNIT / SEPARATE CHAINING</Label>
    {snapshot ? visible.map((bucket, index) => {
      const col = index % columns; const row = Math.floor(index / columns)
      const x = (col - (columns - 1) / 2) * (focused ? 1.22 : 1.35)
      const z = (row - (rows - 1) / 2) * .72
      const populated = bucket.chainLength > 0
      return <group key={bucket.index} position={[x, .52, z]}>
        <Plate position={[0, 0, 0]} size={[focused ? 1.05 : 1.22, .07, .58]} color={populated ? '#454740' : '#20221F'} />
        {(populated || active?.bucketIndex === bucket.index) && <Plate position={[0, .05, -.25]} size={[.48, .018, .025]} color={active?.bucketIndex === bucket.index || bucket.chainLength > 1 ? yellow : cloud} />}
        <Label position={[0, .12, 0]} accent={bucket.chainLength > 1 || active?.bucketIndex === bucket.index} small>{`${String(bucket.index).padStart(2,'0')} · ${bucket.chainLength ? bucket.entries.map((entry) => `P${entry.pid}`).join('→') : 'EMPTY'}`}</Label>
      </group>
    }) : <Label position={[0, .62, 0]} small>PID TABLE SNAPSHOT UNAVAILABLE</Label>}
    {snapshot && snapshot.buckets.length > visible.length && <Label position={[0, .56, -depth / 2 + .12]} small>{`RENDER WINDOW ${visible.length} / ${snapshot.buckets.length} BUCKETS`}</Label>}
    {!snapshot?.size && <Label position={[0, .61, 0]} small>NO PROCESS ENTRIES</Label>}
  </group>
}

function FpbUnit({ queue, algorithm, focused, active, onFocus }: { queue: FpbQueueSnapshot | null; algorithm: string | null; focused: boolean; active: FpbTraceStep | null; onFocus: () => void }) {
  const nodes = queue?.nodes.slice(0, focused ? 8 : 3) ?? []
  const width = focused ? 9 : 4.4
  const spacing = focused ? 1.05 : 1.15
  return <group position={[0, .13, 2.55]} onClick={(event) => { event.stopPropagation(); onFocus() }}>
    <Plate position={[0, .19, 0]} size={[width, .25, 1.62]} color="#171915" metalness={.58} />
    <Plate position={[0, .34, 0]} size={[width - .12, .07, 1.5]} color="#292B26" metalness={.3} />
    <Label position={[0, .48, .63]}>{`FIFO PROCESS BUFFER${algorithm ? ` / ${algorithm} HISTORY` : ''}`}</Label>
    {nodes.length ? <>
      {nodes.map((node, index) => {
        const x = (index - (nodes.length - 1) / 2) * spacing
        const selected = active?.pid === node.process.pid
        return <group key={node.nodeId} position={[x, .53, 0]}>
          <Plate position={[0, 0, 0]} size={[.84, .08, .48]} color={selected ? '#66675F' : '#454740'} />
          <Plate position={[0, .055, -.2]} size={[.42, .018, .022]} color={selected || node.nodeId === queue?.frontNodeId ? yellow : cloud} />
          <Label position={[0, .13, 0]} accent={selected} small>{`P${node.process.pid} · ${node.process.name}`}</Label>
          {node.nodeId === queue?.frontNodeId && <Label position={[0, .11, .35]} accent small>FRONT</Label>}
          {node.nodeId === queue?.rearNodeId && <Label position={[0, .11, -.35]} accent small>REAR</Label>}
          {index < nodes.length - 1 && <PointerBeam from={[x + .42, .49, 0]} to={[x + spacing - .42, .49, 0]} active={selected || active?.operation === 'ENQUEUE'} />}
        </group>
      })}
      {queue && queue.size > nodes.length && <Label position={[0, .57, -.62]} small>{`RECORDED VIEW ${nodes.length} / ${queue.size} PROCESSES`}</Label>}
    </> : <Label position={[0, .62, 0]} small>{queue ? 'QUEUE EMPTY AT RECORDED STEP' : 'NO HISTORICAL FIFO RUN SELECTED'}</Label>}
  </group>
}

function PointerBeam({ from, to, active = false }: { from: [number, number, number]; to: [number, number, number]; active?: boolean }) {
  const dx = to[0] - from[0], dz = to[2] - from[2]
  const horizontal = Math.abs(dx) >= Math.abs(dz)
  return <Etch position={[(from[0] + to[0]) / 2, .49, (from[2] + to[2]) / 2]}
    size={horizontal ? [Math.max(.035, Math.abs(dx)), .025, .035] : [.035, .025, Math.max(.035, Math.abs(dz))]} active={active} />
}

function PmuUnit({ snapshot, beforeSnapshot, focused, historical, active, visitedNodeIds, incomingNodeId, onFocus }: {
  snapshot: PmuListSnapshot | null; beforeSnapshot: PmuListSnapshot | null; focused: boolean; historical: boolean; active: PmuTraceStep | null
  visitedNodeIds: number[]; incomingNodeId: number | null; onFocus: () => void
}) {
  const columns = 4
  const nodeLimit = focused ? 32 : 4
  const nodes = snapshot?.nodes.slice(0, nodeLimit) ?? []
  const rows = Math.max(1, Math.ceil(nodes.length / columns))
  const spacingX = .7
  const spacingZ = focused ? .86 : .88
  const width = 3.25
  const depth = focused ? Math.min(8.25, Math.max(4.8, rows * spacingZ + 1.2)) : 4.45
  const startZ = (rows - 1) * spacingZ / 2
  const positionFor = (index: number): [number, number, number] => {
    const row = Math.floor(index / columns)
    const slot = index % columns
    const column = row % 2 === 0 ? slot : columns - 1 - slot
    return [(column - (columns - 1) / 2) * spacingX, .54, startZ - row * spacingZ]
  }
  const positions = new Map(nodes.map((node, index) => [node.nodeId, positionFor(index)]))
  const activeOwner = active?.ownerNodeId ?? active?.nodeId ?? null
  const incomingNode = incomingNodeId === null ? null : active?.node ?? null

  return <group position={[-4.25, 0, -.08]} onClick={(event) => { event.stopPropagation(); onFocus() }}>
    <Plate position={[0, .19, 0]} size={[width + .3, .28, depth + .3]} color="#171915" metalness={.58} roughness={.54} />
    <Plate position={[0, .36, 0]} size={[width, .08, depth]} color={focused ? '#353730' : '#292B26'} metalness={.32} />
    <Label position={[0, .49, depth / 2 - .12]}>PCB MEMORY UNIT / CUSTOM SINGLY LINKED LIST</Label>
    {snapshot && <Label position={[0, .49, -depth / 2 + .12]} small>{`${historical ? 'HISTORICAL REPLAY · READ ONLY' : 'LIVE LIST'} · ${snapshot.size} PCBS · LOGICAL IDS`}</Label>}
    {!snapshot && <Label position={[0, .62, 0]} small>READING LIVE LIST SNAPSHOT</Label>}
    {snapshot?.size === 0 && <>
      <Label position={[0, .62, 0]}>HEAD → NULL</Label>
      <Label position={[0, .62, -.45]} small>EMPTY PROCESS REGISTRY</Label>
    </>}
    {snapshot && nodes.map((node, index) => {
      const position = positionFor(index)
      const selected = node.nodeId === activeOwner || visitedNodeIds.includes(node.nodeId)
      return <group key={node.nodeId} position={position}>
        <Plate position={[0, .01, 0]} size={[spacingX * .76, .12, .56]} color={selected ? '#D5D4CB' : '#454740'} metalness={.28} />
        {selected && <Plate position={[0, .085, -.265]} size={[spacingX * .56, .012, .025]} color={yellow} metalness={.1} roughness={.6} />}
        <Html position={[0, .19, 0]} center distanceFactor={focused ? 8 : 11} style={{ pointerEvents: 'none' }}>
          <div className={`pmu-node-label ${selected ? 'pmu-node-selected' : ''}`}>
            <b>N{node.nodeId} · P{node.pid}</b><span>{node.name}</span><small>{node.state} · π{node.priority} · NEXT {node.nextNodeId === null ? 'NULL' : `N${node.nextNodeId}`}</small>
          </div>
        </Html>
      </group>
    })}
    {snapshot && nodes.map((node) => {
      const from = positions.get(node.nodeId)
      const to = node.nextNodeId === null ? null : positions.get(node.nextNodeId)
      if (!from || !to) return null
      const selected = active?.kind === 'POINTER_UPDATE' && activeOwner === node.nodeId && active.newNextNodeId === node.nextNodeId
      return <PointerBeam key={`pmu-next-${node.nodeId}`} from={from} to={to} active={selected} />
    })}
    {historical && active?.kind === 'POINTER_UPDATE' && active.oldNextNodeId !== null && beforeSnapshot && (() => {
      const priorNodes = beforeSnapshot.nodes.slice(0, nodeLimit)
      const ownerIndex = priorNodes.findIndex((node) => node.nodeId === active.ownerNodeId)
      const targetIndex = priorNodes.findIndex((node) => node.nodeId === active.oldNextNodeId)
      if (ownerIndex < 0 || targetIndex < 0) return null
      return <PointerBeam key={`pmu-old-pointer-${active.sequence}`} from={positionFor(ownerIndex)} to={positionFor(targetIndex)} />
    })()}
    {snapshot?.headNodeId != null && positions.has(snapshot.headNodeId) && (() => {
      const head = positions.get(snapshot.headNodeId)!
      const headMark: [number, number, number] = [head[0], .6, head[2] + .5]
      return <group key="pmu-head"><PointerBeam from={headMark} to={head} active={active?.kind === 'HEAD_UPDATE'} /><Label position={headMark} accent={active?.kind === 'HEAD_UPDATE'} small>HEAD</Label></group>
    })()}
    {historical && active?.kind === 'HEAD_UPDATE' && active.oldHeadNodeId !== null && beforeSnapshot && (() => {
      const oldIndex = beforeSnapshot.nodes.slice(0, nodeLimit).findIndex((node) => node.nodeId === active.oldHeadNodeId)
      if (oldIndex < 0) return null
      const old = positionFor(oldIndex)
      return <Label position={[old[0], .6, old[2] + .5]} small>OLD HEAD</Label>
    })()}
    {snapshot && nodes.length > 0 && snapshot.size <= nodes.length && nodes[nodes.length - 1].nextNodeId === null && (() => {
      const last = positions.get(nodes[nodes.length - 1].nodeId)!
      return <Label position={[last[0], .61, last[2] - .47]} small>NULL</Label>
    })()}
    {snapshot && snapshot.size > nodes.length && <Label position={[0, .62, -depth / 2 + .43]} small>{`RENDER WINDOW ${nodes.length} / ${snapshot.size} · NEXT TARGET MAY BE OUTSIDE VIEW`}</Label>}
    {incomingNode && <group position={[width / 2 - .46, .62, depth / 2 - .63]}>
      <Plate position={[0, .01, 0]} size={[.8, .13, .52]} color={cloud} metalness={.25} />
      <Label position={[0, .18, 0]} accent small>{`NEW N${incomingNode.nodeId} · P${incomingNode.pid}`}</Label>
    </group>}
  </group>
}

function HeapSlots({ entries, active, animate }: { entries: HeapEntrySnapshot[]; active: HeapTraceStep | null; animate: boolean }) {
  const positions = layoutHeapSlots(Math.max(entries.length, active?.sizeBefore ?? 0), .82)
  const emphasis = new Set([active?.index, active?.otherIndex].filter((value): value is number => value !== null && value !== undefined))
  const movingSlots = new Set<number>()
  if (animate && active?.kind === 'SWAP') { if (active.index !== null) movingSlots.add(active.index); if (active.otherIndex !== null) movingSlots.add(active.otherIndex) }
  if (animate && active?.kind === 'INSERT' && active.index !== null) movingSlots.add(active.index)
  if (animate && active?.kind === 'EXTRACT_MAX') { movingSlots.add(0); if (active.otherIndex !== null && active.otherValue) movingSlots.add(active.otherIndex) }
  return <group>
    {positions.map(({ index, x, z }) => {
      const entry = entries[index]
      if (!entry) return null
      const selected = emphasis.has(index) || active?.kind === 'INSERT' && active.index === index
      return <group key={index} position={[x, .61, z]}>
        <Plate position={[0, .01, 0]} size={[.72, .12, .36]} color={selected ? '#D6D5CC' : '#454740'} metalness={.28} />
        <Plate position={[0, .085, 0]} size={[.64, .025, .28]} color={selected ? cloud : '#B9BAB2'} metalness={.12} />
        {selected && <Plate position={[0, .12, -.17]} size={[.54, .012, .025]} color={yellow} metalness={.1} roughness={.6} />}
        {!movingSlots.has(index) && <Label position={[0, .19, 0]} small>{`[${index}] P${entry.pid} · π${entry.priority}`}</Label>}
      </group>
    })}
    {positions.slice(1).map(({ index, x, z }) => {
      const parentIndex = Math.floor((index - 1) / 2)
      const parent = positions[parentIndex]
      if (!parent) return null
      const highlighted = active?.kind === 'COMPARE' || active?.kind === 'SWAP'
        ? emphasis.has(index) && emphasis.has(parentIndex)
        : false
      const midZ = (z + parent.z) / 2
      const midX = (x + parent.x) / 2
      return <group key={`link-${index}`}>
        <Etch position={[parent.x, .52, midZ]} size={[.022, .018, Math.max(.05, Math.abs(parent.z - z) / 2)]} active={highlighted} />
        <Etch position={[midX, .52, z]} size={[Math.max(.04, Math.abs(x - parent.x)), .018, .022]} active={highlighted} />
      </group>
    })}
    {animate && active?.kind === 'SWAP' && active.value && active.otherValue && active.index !== null && active.otherIndex !== null && positions[active.index] && positions[active.otherIndex] && <>
      <AnimatedDescriptor key={`swap-a-${active.sequence}`} entry={active.value} from={[positions[active.index].x, .62, positions[active.index].z]} to={[positions[active.otherIndex].x, .62, positions[active.otherIndex].z]} sequence={active.sequence} />
      <AnimatedDescriptor key={`swap-b-${active.sequence}`} entry={active.otherValue} from={[positions[active.otherIndex].x, .62, positions[active.otherIndex].z]} to={[positions[active.index].x, .62, positions[active.index].z]} sequence={active.sequence} />
    </>}
    {animate && active?.kind === 'INSERT' && active.value && active.index !== null && positions[active.index] && <AnimatedDescriptor key={`insert-${active.sequence}`} entry={active.value} from={[positions[active.index].x, .62, positions[active.index].z + 1]} to={[positions[active.index].x, .62, positions[active.index].z]} sequence={active.sequence} />}
    {animate && active?.kind === 'EXTRACT_MAX' && active.value && <>
      <AnimatedDescriptor key={`extract-${active.sequence}`} entry={active.value} from={[0, .62, 0]} to={[-2.4, .62, .7]} sequence={active.sequence} />
      {active.otherValue && active.otherIndex !== null && positions[active.otherIndex] && positions[0] && <AnimatedDescriptor key={`replace-${active.sequence}`} entry={active.otherValue} from={[positions[active.otherIndex].x, .62, positions[active.otherIndex].z]} to={[positions[0].x, .62, positions[0].z]} sequence={active.sequence} />}
    </>}
  </group>
}

function PriorityUnit({ entries, active, focused, animate, onFocus }: { entries: HeapEntrySnapshot[]; active: HeapTraceStep | null; focused: boolean; animate: boolean; onFocus: () => void }) {
  const visibleEntries = focused ? entries.slice(0, 127) : entries.slice(0, 7)
  const slots = visibleEntries.length
  const width = Math.max(4.65, Math.min(14, 2 ** Math.ceil(Math.log2(Math.max(1, slots))) * .8 + .6))
  const depth = focused ? Math.max(2.3, Math.ceil(Math.log2(Math.max(1, slots))) * .62 + 1.2) : 2.25
  return <group position={[0, 0, -2.55]} onClick={(event) => { event.stopPropagation(); onFocus() }}>
    <Plate position={[0, .19, 0]} size={[width + .34, .28, depth + .32]} color="#171915" metalness={.58} roughness={.52} />
    <Plate position={[0, .36, 0]} size={[width, .08, depth]} color={focused ? '#393B35' : '#292B26'} metalness={.4} />
    <Plate position={[-width / 2 + .15, .44, 0]} size={[.08, .08, depth - .18]} color={active ? yellow : '#74766E'} />
    <Label position={[0, .51, depth / 2 - .13]}>{focused ? 'PRIORITY DISPATCH UNIT / MAX HEAP' : 'PRIORITY DISPATCH UNIT'}</Label>
    {!entries.length && <Label position={[0, .62, 0]} small>NO RECORDED HEAP ENTRIES</Label>}
    <HeapSlots entries={visibleEntries} active={active} animate={animate} />
    {entries.length > visibleEntries.length && <Label position={[0, .59, -depth / 2 + .1]} small>{`RENDER WINDOW ${visibleEntries.length} / ${entries.length} SLOTS`}</Label>}
  </group>
}

function CameraRig({ focused, focusTarget, resetKey }: { focused: boolean; focusTarget: 'PDU' | 'PMU' | 'ALU' | 'FPB' | 'PTU'; resetKey: number }) {
  const { camera, controls, invalidate } = useThree()
  const running = useRef(false)
  const desiredPosition = useRef(new Vector3())
  const desiredTarget = useRef(new Vector3())
  useEffect(() => {
    desiredPosition.current.set(...(focused ? (focusTarget === 'PMU' ? [-4.25, 8.5, 7.3] as [number, number, number] : focusTarget === 'ALU' ? [4.25, 8.5, 7.3] as [number, number, number] : focusTarget === 'FPB' ? [0, 7.8, 8.8] as [number, number, number] : focusTarget === 'PTU' ? [0, 8.3, 6.9] as [number, number, number] : [0, 7.6, 6.9] as [number, number, number]) : [0, 11.2, 13.8] as [number, number, number]))
    desiredTarget.current.set(...(focused ? (focusTarget === 'PMU' ? [-4.25, .15, -.08] as [number, number, number] : focusTarget === 'ALU' ? [4.25, .15, -.08] as [number, number, number] : focusTarget === 'FPB' ? [0, .15, 2.55] as [number, number, number] : focusTarget === 'PTU' ? [0, .15, -.04] as [number, number, number] : [0, .15, -2.5] as [number, number, number]) : [0, 0, 0] as [number, number, number]))
    running.current = true
    invalidate()
  }, [focused, focusTarget, resetKey, invalidate])
  useFrame((_, delta) => {
    if (!running.current) return
    camera.position.lerp(desiredPosition.current, Math.min(1, delta * 3.2))
    const orbit = controls as unknown as { target: Vector3; update: () => void } | null
    if (orbit?.target) orbit.target.lerp(desiredTarget.current, Math.min(1, delta * 3.2))
    orbit?.update()
    if (camera.position.distanceTo(desiredPosition.current) < .035 && (!orbit || orbit.target.distanceTo(desiredTarget.current) < .035)) running.current = false
    else invalidate()
  })
  return null
}

function PtuUnit({ snapshot, focused, active, onFocus }: { snapshot: PtuSnapshot | null; focused: boolean; active: PtuTraceStep | null; onFocus: () => void }) {
  const visible = snapshot?.nodes.slice(0, focused ? 18 : 5) ?? []
  const positions = new Map(visible.map((node, i) => [node.pid, [((i % 6) - 2.5) * (focused ? .82 : .65), .56, .28 - Math.floor(i / 6) * .48] as [number, number, number]]))
  const width = focused ? 7.8 : 3.9
  return <group position={[0,.14,-.04]} onClick={(e)=>{e.stopPropagation();onFocus()}}><Plate position={[0,.19,0]} size={[width,.25,focused?2.4:1.58]} color="#171915" metalness={.58}/><Plate position={[0,.34,0]} size={[width-.12,.07,focused?2.28:1.46]} color="#292B26" metalness={.3}/><Label position={[0,.49,focused?.98:.62]}>PROCESS TREE UNIT / FIRST CHILD · NEXT SIBLING</Label>
    {visible.map((node)=>{const p=positions.get(node.pid)!;const selected=active?.currentPid===node.pid||active?.visitedPid===node.pid;return <group key={node.pid} position={p}><Plate position={[0,0,0]} size={[.67,.08,.32]} color={selected?'#77786F':'#454740'}/><Label position={[0,.14,0]} accent={selected} small>{`P${node.pid} · ${node.state}`}</Label></group>})}
    {visible.flatMap(node=>{const from=positions.get(node.pid);if(!from)return[];return (['firstChildPid','nextSiblingPid'] as const).map(kind=>{const target=node[kind],to=target==null?null:positions.get(target);if(!to)return null;const activeLink=active?.currentPid===node.pid&&((kind==='firstChildPid'&&active.firstChildAfter===target)||(kind==='nextSiblingPid'&&active.nextSiblingAfter===target));return <PointerBeam key={`${node.pid}-${kind}`} from={from} to={to} active={activeLink}/>})})}
    {!visible.length&&<Label position={[0,.62,0]} small>NO PROCESSES IN TREE</Label>}{snapshot&&snapshot.nodes.length>visible.length&&<Label position={[0,.55,-.96]} small>{`VISIBLE ${visible.length} / ${snapshot.size} · ${snapshot.rootCount} ROOTS`}</Label>}</group>
}

function DieAssembly({ focused, focusTarget, resetKey, entries, active, animate, onFocus, onPmuFocus, onAluFocus, onFpbFocus, onPtuFocus,
  pmuSnapshot, pmuBeforeSnapshot, pmuActive, pmuVisitedNodeIds, pmuIncomingNodeId, pmuHistorical, aluSnapshot, aluActive, fpbQueue, fpbAlgorithm, fpbActive,
  ptuSnapshot, ptuActive,
}: {
  focused: boolean; focusTarget: 'PDU' | 'PMU' | 'ALU' | 'FPB' | 'PTU'; resetKey: number; entries: HeapEntrySnapshot[]; active: HeapTraceStep | null
  animate: boolean; onFocus: () => void; onPmuFocus: () => void; onAluFocus: () => void; aluSnapshot: AluTableSnapshot | null; aluActive: AluTraceStep | null; pmuSnapshot: PmuListSnapshot | null
  onFpbFocus: () => void; fpbQueue: FpbQueueSnapshot | null; fpbAlgorithm: string | null; fpbActive: FpbTraceStep | null
  pmuBeforeSnapshot: PmuListSnapshot | null; pmuActive: PmuTraceStep | null; pmuVisitedNodeIds: number[]
  pmuIncomingNodeId: number | null; pmuHistorical: boolean; onPtuFocus: () => void; ptuSnapshot: PtuSnapshot | null; ptuActive: PtuTraceStep | null
}) {
  const controls = useRef(null)
  const pduFocused = focused && focusTarget === 'PDU'
  const pmuFocused = focused && focusTarget === 'PMU'
  const aluFocused = focused && focusTarget === 'ALU'
  const fpbFocused = focused && focusTarget === 'FPB'
  const ptuFocused = focused && focusTarget === 'PTU'
  return <>
    <ambientLight intensity={1.1} color={cloud} />
    <directionalLight position={[-7, 12, 8]} intensity={2.4} color="#F3F2EC" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
    <directionalLight position={[8, 6, -8]} intensity={.55} color="#AAA99F" />
    <Plate position={[0, -.63, 0]} size={[13.25, .7, 9.15]} color="#171915" metalness={.72} roughness={.45} />
    <Plate position={[0, -.19, 0]} size={[12.75, .24, 8.65]} color="#282A25" metalness={.3} roughness={.8} />
    <Plate position={[0, -.04, 0]} size={[12.25, .1, 8.15]} color="#20221F" metalness={.15} roughness={.86} />
    <Etch position={[0, .018, 0]} size={[11.6, .012, .018]} />
    <Etch position={[0, .018, 0]} size={[.018, .012, 7.6]} />
    <Etch position={[-5.35, .02, -2.55]} size={[1.3, .014, .02]} active={pmuFocused} />
    <Etch position={[5.3, .02, -1.35]} size={[.02, .014, 2.3]} />
    <Etch position={[0, .02, 3.15]} size={[4.2, .014, .02]} />
    <PmuUnit snapshot={pmuSnapshot} beforeSnapshot={pmuBeforeSnapshot} focused={pmuFocused} historical={pmuHistorical}
      active={pmuActive} visitedNodeIds={pmuVisitedNodeIds} incomingNodeId={pmuIncomingNodeId} onFocus={onPmuFocus} />
    <AluUnit snapshot={aluSnapshot} focused={aluFocused} active={aluActive} onFocus={onAluFocus} />
    <PtuUnit snapshot={ptuSnapshot} focused={ptuFocused} active={ptuActive} onFocus={onPtuFocus} />
    <FpbUnit queue={fpbQueue} algorithm={fpbAlgorithm} focused={fpbFocused} active={fpbActive} onFocus={onFpbFocus} />
    <PriorityUnit entries={entries} active={active} focused={pduFocused} animate={animate} onFocus={onFocus} />
    <Label position={[-5.82, .1, -3.65]} small>ADDRESS BUS</Label>
    <Label position={[5.6, .1, 3.4]} small>CONTROL / DATA ROUTES</Label>
    <OrbitControls ref={controls} makeDefault enablePan enableZoom enableRotate minDistance={6} maxDistance={25} enableDamping dampingFactor={.12} />
    <CameraRig focused={focused} focusTarget={focusTarget} resetKey={resetKey} />
  </>
}

export function ProcessorDieScene({ focused, focusTarget = 'PDU', resetKey, entries, active, onFocus, onPmuFocus, onAluFocus, onFpbFocus, onPtuFocus = () => {}, ptuSnapshot = null, ptuActive = null, aluActive = null, fpbQueue = null, fpbAlgorithm = null, fpbActive = null,
  pmuSnapshot = null, pmuBeforeSnapshot = null, pmuActive = null, pmuVisitedNodeIds = [], pmuIncomingNodeId = null,
  pmuHistorical = false, aluSnapshot = null, animate = true,
}: {
  focused: boolean; focusTarget?: 'PDU' | 'PMU' | 'ALU' | 'FPB' | 'PTU'; resetKey: number; entries: HeapEntrySnapshot[]; active: HeapTraceStep | null
  onFocus: () => void; onPmuFocus: () => void; onAluFocus: () => void; onPtuFocus?: () => void; ptuSnapshot?: PtuSnapshot | null; ptuActive?: PtuTraceStep | null; aluSnapshot?: AluTableSnapshot | null; aluActive?: AluTraceStep | null; pmuSnapshot?: PmuListSnapshot | null; pmuBeforeSnapshot?: PmuListSnapshot | null
  onFpbFocus: () => void; fpbQueue?: FpbQueueSnapshot | null; fpbAlgorithm?: string | null; fpbActive?: FpbTraceStep | null
  pmuActive?: PmuTraceStep | null; pmuVisitedNodeIds?: number[]; pmuIncomingNodeId?: number | null
  pmuHistorical?: boolean; animate?: boolean
}) {
  return <Canvas shadows dpr={[1, 1.5]} frameloop="demand" camera={{ position: [0, 11.2, 13.8], fov: 43 }} fallback={<WebglFallback />} gl={{ antialias: true, powerPreference: 'low-power', alpha: false }}>
    <color attach="background" args={[new Color(graphite)]} />
    <fog attach="fog" args={[graphite, 18, 34]} />
    <Suspense fallback={null}><DieAssembly focused={focused} focusTarget={focusTarget} resetKey={resetKey} entries={entries} active={active}
      onFocus={onFocus} onPmuFocus={onPmuFocus} onAluFocus={onAluFocus} onFpbFocus={onFpbFocus} onPtuFocus={onPtuFocus} ptuSnapshot={ptuSnapshot} ptuActive={ptuActive} aluSnapshot={aluSnapshot} aluActive={aluActive} fpbQueue={fpbQueue} fpbAlgorithm={fpbAlgorithm} fpbActive={fpbActive} pmuSnapshot={pmuSnapshot} pmuBeforeSnapshot={pmuBeforeSnapshot}
      pmuActive={pmuActive} pmuVisitedNodeIds={pmuVisitedNodeIds} pmuIncomingNodeId={pmuIncomingNodeId}
      pmuHistorical={pmuHistorical} animate={animate} /></Suspense>
  </Canvas>
}


