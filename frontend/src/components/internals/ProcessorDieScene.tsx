import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { Color, Vector3 } from 'three'
import { WebglFallback } from './WebglFallback'
import type { HeapEntrySnapshot, HeapTraceStep } from '../../types/api'

const graphite = '#20221F'
const cloud = '#F3F2EC'
const yellow = '#F5D547'
const muted = '#74766E'

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
    <Plate position={[0, .01, 0]} size={[.78, .13, .4]} color={cloud} metalness={.28} roughness={.58} />`n    <Plate position={[0, .083, -.17]} size={[.62, .012, .025]} color={yellow} metalness={.1} roughness={.6} />
    <Plate position={[0, .09, 0]} size={[.68, .025, .31]} color="#F7EAAF" metalness={.15} />
    <Label position={[0, .2, 0]} small>{`P${entry.pid} · π${entry.priority}`}</Label>
  </group>
}

function PlaceholderModule({ title, subtitle, position, size }: { title: string; subtitle: string; position: [number, number, number]; size: [number, number, number] }) {
  return <group position={position}><Plate position={[0, 0, 0]} size={size} color="#30322D" /><Plate position={[0, size[1] / 2 + .035, 0]} size={[size[0] - .18, .06, size[2] - .18]} color="#242621" metalness={.32} /><Label position={[0, .17, 0]}>{title}</Label><Label position={[0, .17, .42]} small>{subtitle}</Label></group>
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

function CameraRig({ focused, resetKey }: { focused: boolean; resetKey: number }) {
  const { camera, controls, invalidate } = useThree()
  const running = useRef(false)
  const desiredPosition = useRef(new Vector3())
  const desiredTarget = useRef(new Vector3())
  useEffect(() => {
    desiredPosition.current.set(...(focused ? [0, 7.6, 6.9] as [number, number, number] : [0, 11.2, 13.8] as [number, number, number]))
    desiredTarget.current.set(...(focused ? [0, .15, -2.5] as [number, number, number] : [0, 0, 0] as [number, number, number]))
    running.current = true
    invalidate()
  }, [focused, resetKey, invalidate])
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

function DieAssembly({ focused, resetKey, entries, active, animate, onFocus }: { focused: boolean; resetKey: number; entries: HeapEntrySnapshot[]; active: HeapTraceStep | null; animate: boolean; onFocus: () => void }) {
  const controls = useRef(null)
  return <>
    <ambientLight intensity={1.1} color={cloud} />
    <directionalLight position={[-7, 12, 8]} intensity={2.4} color="#F3F2EC" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
    <directionalLight position={[8, 6, -8]} intensity={.55} color="#AAA99F" />
    <Plate position={[0, -.63, 0]} size={[13.25, .7, 9.15]} color="#171915" metalness={.72} roughness={.45} />
    <Plate position={[0, -.19, 0]} size={[12.75, .24, 8.65]} color="#282A25" metalness={.3} roughness={.8} />
    <Plate position={[0, -.04, 0]} size={[12.25, .1, 8.15]} color="#20221F" metalness={.15} roughness={.86} />
    <Etch position={[0, .018, 0]} size={[11.6, .012, .018]} />
    <Etch position={[0, .018, 0]} size={[.018, .012, 7.6]} />
    <Etch position={[-5.35, .02, -2.55]} size={[1.3, .014, .02]} active={focused} />
    <Etch position={[5.3, .02, -1.35]} size={[.02, .014, 2.3]} />
    <Etch position={[0, .02, 3.15]} size={[4.2, .014, .02]} />
    <PlaceholderModule title="PROCESS DESCRIPTOR MEMORY" subtitle="CUSTOM LINKED LIST · STAGE 5D" position={[-4.25, .16, -.08]} size={[3.25, .18, 4.45]} />
    <PlaceholderModule title="ASSOCIATIVE LOOKUP UNIT" subtitle="CUSTOM HASH TABLE · STAGE 5C" position={[4.25, .16, -.08]} size={[3.25, .18, 4.45]} />
    <PlaceholderModule title="PROCESS CONTROL HIERARCHY" subtitle="FIRST CHILD / NEXT SIBLING · STAGE 5E" position={[0, .16, -.04]} size={[3.9, .18, 1.58]} />
    <PlaceholderModule title="FIFO PROCESS BUFFER" subtitle="CUSTOM QUEUE · STAGE 5D" position={[0, .16, 2.55]} size={[4.65, .18, 1.48]} />
    <PriorityUnit entries={entries} active={active} focused={focused} animate={animate} onFocus={onFocus} />
    <Label position={[-5.82, .1, -3.65]} small>ADDRESS BUS</Label>
    <Label position={[5.6, .1, 3.4]} small>CONTROL / DATA ROUTES</Label>
    <OrbitControls ref={controls} makeDefault enablePan enableZoom enableRotate minDistance={6} maxDistance={25} enableDamping dampingFactor={.12} />
    <CameraRig focused={focused} resetKey={resetKey} />
  </>
}

export function ProcessorDieScene({ focused, resetKey, entries, active, onFocus, animate = true }: { focused: boolean; resetKey: number; entries: HeapEntrySnapshot[]; active: HeapTraceStep | null; onFocus: () => void; animate?: boolean }) {
  return <Canvas shadows dpr={[1, 1.5]} frameloop="demand" camera={{ position: [0, 11.2, 13.8], fov: 43 }} fallback={<WebglFallback />} gl={{ antialias: true, powerPreference: 'low-power', alpha: false }}>
    <color attach="background" args={[new Color(graphite)]} />
    <fog attach="fog" args={[graphite, 18, 34]} />
    <Suspense fallback={null}><DieAssembly focused={focused} resetKey={resetKey} entries={entries} active={active} onFocus={onFocus} animate={animate} /></Suspense>
  </Canvas>
}


