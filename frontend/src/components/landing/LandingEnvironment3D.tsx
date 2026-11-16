import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  CapsuleGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshPhysicalMaterial,
  Object3D,
  PMREMGenerator,
  PointLight,
  Shape,
  TubeGeometry,
  Vector3,
} from 'three'
import type { MutableRefObject } from 'react'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

type HardwareMaterials = {
  board: MeshPhysicalMaterial
  boardEdge: MeshPhysicalMaterial
  titanium: MeshPhysicalMaterial
  darkMetal: MeshPhysicalMaterial
  gold: MeshPhysicalMaterial
  ceramic: MeshPhysicalMaterial
  die: MeshPhysicalMaterial
  glass: MeshPhysicalMaterial
  lime: MeshPhysicalMaterial
  ivory: MeshPhysicalMaterial
}

function createMaterials(): HardwareMaterials {
  return {
    board: new MeshPhysicalMaterial({ color: '#171D19', metalness: .34, roughness: .43, clearcoat: .24 }),
    boardEdge: new MeshPhysicalMaterial({ color: '#343A35', metalness: .78, roughness: .28, clearcoat: .5 }),
    titanium: new MeshPhysicalMaterial({ color: '#858E88', metalness: .86, roughness: .24, clearcoat: .65 }),
    darkMetal: new MeshPhysicalMaterial({ color: '#202522', metalness: .74, roughness: .3, clearcoat: .35 }),
    gold: new MeshPhysicalMaterial({ color: '#D6A66A', metalness: .88, roughness: .22, clearcoat: .4 }),
    ceramic: new MeshPhysicalMaterial({ color: '#C5C0AE', metalness: .26, roughness: .28, clearcoat: .5 }),
    die: new MeshPhysicalMaterial({ color: '#252B27', metalness: .34, roughness: .32, clearcoat: .55 }),
    glass: new MeshPhysicalMaterial({ color: '#A6B3A3', metalness: .18, roughness: .12, transparent: true, opacity: .2, side: DoubleSide, depthWrite: false, clearcoat: 1, clearcoatRoughness: .08 }),
    lime: new MeshPhysicalMaterial({ color: '#C7F36B', emissive: '#9ACB41', emissiveIntensity: .42, metalness: .18, roughness: .24, clearcoat: .65 }),
    ivory: new MeshPhysicalMaterial({ color: '#F1F0E8', metalness: .42, roughness: .22, clearcoat: .5 }),
  }
}

function roundedPlateGeometry(width: number, depth: number, thickness: number, radius: number) {
  const w = width / 2
  const d = depth / 2
  const r = Math.min(radius, w * .45, d * .45)
  const shape = new Shape()
  shape.moveTo(-w + r, -d)
  shape.lineTo(w - r, -d)
  shape.absarc(w - r, -d + r, r, -Math.PI / 2, 0)
  shape.lineTo(w, d - r)
  shape.absarc(w - r, d - r, r, 0, Math.PI / 2)
  shape.lineTo(-w + r, d)
  shape.absarc(-w + r, d - r, r, Math.PI / 2, Math.PI)
  shape.lineTo(-w, -d + r)
  shape.absarc(-w + r, -d + r, r, Math.PI, Math.PI * 1.5)
  const geometry = new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelSegments: 2, bevelSize: Math.min(.055, thickness * .18), bevelThickness: Math.min(.055, thickness * .18), curveSegments: 4 })
  geometry.rotateX(-Math.PI / 2)
  geometry.computeVertexNormals()
  return geometry
}

function Plate({ width, depth, thickness, radius = .24, material, position, castShadow = true }: {
  width: number; depth: number; thickness: number; radius?: number; material: MeshPhysicalMaterial; position: [number, number, number]; castShadow?: boolean
}) {
  const geometry = useMemo(() => roundedPlateGeometry(width, depth, thickness, radius), [width, depth, thickness, radius])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} material={material} position={position} castShadow={castShadow} receiveShadow />
}

function makeCurve(points: [number, number, number][]) {
  return new CatmullRomCurve3(points.map((point) => new Vector3(...point)), false, 'centripetal')
}

function curveGeometry(curve: CatmullRomCurve3, radius: number, tubularSegments: number, radialSegments: number) {
  return new TubeGeometry(curve, tubularSegments, radius, radialSegments, false)
}

function CircuitTrace({ points, materials, radius = .028 }: { points: [number, number, number][]; materials: HardwareMaterials; radius?: number }) {
  const curve = useMemo(() => makeCurve(points), [points])
  const geometry = useMemo(() => curveGeometry(curve, radius, 42, 5), [curve, radius])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} material={materials.gold} castShadow />
}

function TubeMesh({ curve, materials, radius = .048 }: { curve: CatmullRomCurve3; materials: HardwareMaterials; radius?: number }) {
  const geometry = useMemo(() => curveGeometry(curve, radius, 32, 7), [curve, radius])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} material={materials.gold} castShadow />
}

function BoardContactField({ materials, compact }: { materials: HardwareMaterials; compact: boolean }) {
  const mesh = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const contactGeometry = useMemo(() => new CylinderGeometry(.052, .052, .075, compact ? 7 : 10), [compact])
  const locations = useMemo(() => {
    const result: [number, number, number][] = []
    const count = compact ? 48 : 112
    for (let index = 0; index < count; index += 1) {
      const side = index % 4
      const lane = Math.floor(index / 4)
      const offset = -10.6 + (lane / Math.max(1, Math.ceil(count / 4) - 1)) * 21.2
      if (side === 0) result.push([offset, .06, -8.65])
      else if (side === 1) result.push([offset, .06, 8.65])
      else if (side === 2) result.push([-12.65, .06, offset * .78])
      else result.push([12.65, .06, offset * .78])
    }
    return result
  }, [compact])

  useEffect(() => {
    if (!mesh.current) return
    locations.forEach(([x, y, z], index) => {
      dummy.position.set(x, y, z)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      mesh.current?.setMatrixAt(index, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  }, [dummy, locations])
  useEffect(() => () => contactGeometry.dispose(), [contactGeometry])
  return <instancedMesh ref={mesh} args={[contactGeometry, materials.gold, locations.length]} castShadow receiveShadow />
}

function ProcessorPackage({ materials, compact }: { materials: HardwareMaterials; compact: boolean }) {
  const corePositions: [number, number, number][] = [[-1.8, 1.08, -1.05], [1.8, 1.08, -1.05], [-1.8, 1.08, 1.05], [1.8, 1.08, 1.05]]
  return <group>
    <Plate width={10.9} depth={7.7} thickness={.42} radius={.46} material={materials.darkMetal} position={[0, .13, 0]} />
    <Plate width={10.36} depth={7.16} thickness={.25} radius={.38} material={materials.titanium} position={[0, .53, 0]} />
    <Plate width={8.82} depth={5.62} thickness={.18} radius={.28} material={materials.gold} position={[0, .77, 0]} />
    <Plate width={8.46} depth={5.28} thickness={.3} radius={.25} material={materials.die} position={[0, .93, 0]} />
    <Plate width={7.92} depth={4.75} thickness={.08} radius={.2} material={materials.board} position={[0, 1.22, 0]} castShadow={false} />
    {corePositions.map((position, index) => <group key={index} position={position}>
      <Plate width={1.48} depth={.96} thickness={.12} radius={.14} material={materials.darkMetal} position={[0, 0, 0]} />
      <Plate width={1.24} depth={.7} thickness={.055} radius={.1} material={materials.ceramic} position={[0, .12, 0]} castShadow={false} />
      <mesh position={[0, .19, 0]} material={index === 0 ? materials.lime : materials.ivory} castShadow>
        <boxGeometry args={[.7, .08, .34]} />
      </mesh>
      <mesh position={[0, .24, 0]} material={materials.gold}>
        <boxGeometry args={[.45, .018, .045]} />
      </mesh>
    </group>)}
    {!compact && <group>
      {Array.from({ length: 12 }, (_, index) => <mesh key={index} position={[-3.55 + index * .645, 1.3, -2.27]} material={materials.gold}>
        <boxGeometry args={[.35, .035, .055]} />
      </mesh>)}
      {Array.from({ length: 12 }, (_, index) => <mesh key={index} position={[-3.55 + index * .645, 1.3, 2.27]} material={materials.gold}>
        <boxGeometry args={[.35, .035, .055]} />
      </mesh>)}
      {Array.from({ length: 8 }, (_, index) => <mesh key={index} position={[-4.05, 1.3, -1.7 + index * .49]} material={materials.gold}>
        <boxGeometry args={[.055, .035, .28]} />
      </mesh>)}
      {Array.from({ length: 8 }, (_, index) => <mesh key={index} position={[4.05, 1.3, -1.7 + index * .49]} material={materials.gold}>
        <boxGeometry args={[.055, .035, .28]} />
      </mesh>)}
    </group>}
  </group>
}

function CircuitBoard({ materials, compact }: { materials: HardwareMaterials; compact: boolean }) {
  const traces = useMemo(() => {
    const paths: [number, number, number][][] = [
      [[-12, .09, -7.5], [-10, .1, -7.5], [-8.5, .1, -5.8], [-5.1, .12, -3.4]],
      [[-12, .09, -6.9], [-9.4, .1, -6.9], [-7.8, .1, -4.3], [-4.7, .12, -2.8]],
      [[-12, .09, 7.5], [-9.6, .1, 7.5], [-7.5, .1, 5.2], [-4.9, .12, 3.2]],
      [[-11.5, .09, 8.1], [-8.9, .1, 8.1], [-6.7, .1, 5.7], [-4.4, .12, 3.6]],
      [[12, .09, -7.6], [9.7, .1, -7.6], [7.7, .1, -5.3], [4.7, .12, -3.1]],
      [[12.3, .09, -6.8], [10.1, .1, -6.8], [8, .1, -4.7], [4.9, .12, -2.8]],
      [[12, .09, 7.6], [9.4, .1, 7.6], [7.4, .1, 5.2], [4.9, .12, 3.3]],
      [[11.6, .09, 8.2], [8.9, .1, 8.2], [6.8, .1, 5.4], [4.5, .12, 3.6]],
      [[-11.8, .09, -1.9], [-8.5, .1, -1.9], [-7.1, .1, -.7], [-5.2, .12, -.7]],
      [[11.7, .09, -.3], [8.4, .1, -.3], [7.2, .1, 1], [5.15, .12, 1]],
      [[-.9, .09, -8.3], [-.9, .1, -6.2], [-2.4, .1, -4.8], [-2.4, .12, -3.1]],
      [[.9, .09, -8.2], [.9, .1, -6], [2.5, .1, -4.7], [2.5, .12, -3.1]],
    ]
    return compact ? paths.filter((_, index) => index % 2 === 0) : paths
  }, [compact])
  return <group>
    <mesh position={[0, -.54, 0]} castShadow receiveShadow material={materials.board}>
      <boxGeometry args={[26, .9, 18]} />
    </mesh>
    <mesh position={[0, -.98, 0]} material={materials.boardEdge} castShadow>
      <boxGeometry args={[25.65, .18, 17.65]} />
    </mesh>
    {!compact && <BoardContactField materials={materials} compact={compact} />}
    {traces.map((points, index) => <CircuitTrace key={index} points={points} materials={materials} radius={compact ? .034 : .025} />)}
    <ProcessorPackage materials={materials} compact={compact} />
  </group>
}

function Housing({ materials, width = .78, depth = .76, height = .3, selected = false }: {
  materials: HardwareMaterials; width?: number; depth?: number; height?: number; selected?: boolean
}) {
  return <group>
    <Plate width={width} depth={depth} thickness={height} radius={Math.min(width, depth) * .13} material={materials.darkMetal} position={[0, 0, 0]} />
    <Plate width={width * .89} depth={depth * .84} thickness={height * .16} radius={Math.min(width, depth) * .11} material={materials.titanium} position={[0, height * .82, 0]} />
    <mesh position={[0, height * .986, 0]} material={selected ? materials.lime : materials.gold}>
      <boxGeometry args={[width * .58, .025, depth * .12]} />
    </mesh>
    <mesh position={[0, height * .7, depth * .52]} material={materials.glass}>
      <boxGeometry args={[width * .55, height * .24, .025]} />
    </mesh>
  </group>
}

function LinkedListHardware({ materials, compact }: { materials: HardwareMaterials; compact: boolean }) {
  const nodes = compact ? 5 : 7
  const offset = (nodes - 1) / 2
  return <group position={[-9.2, 0, -1.4]}>
    <Plate width={nodes * 1.02 + .5} depth={1.65} thickness={.2} material={materials.boardEdge} position={[0, .02, 0]} />
    {Array.from({ length: nodes }, (_, index) => <group key={index} position={[(index - offset) * 1.02, .23, 0]}>
      <Housing materials={materials} width={.77} depth={1.03} height={.37} selected={index === 2} />
      <mesh position={[0, .52, 0]} material={materials.glass}>
        <boxGeometry args={[.58, .1, .68]} />
      </mesh>
    </group>)}
    {Array.from({ length: nodes - 1 }, (_, index) => <CircuitTrace key={index} materials={materials} radius={.043} points={[
      [(index - offset) * 1.02 + .38, .29, 0], [(index - offset) * 1.02 + .56, .48, 0], [(index - offset + 1) * 1.02 - .56, .48, 0], [(index - offset + 1) * 1.02 - .38, .29, 0],
    ]} />)}
  </group>
}

function HeapHardware({ materials, compact }: { materials: HardwareMaterials; compact: boolean }) {
  const nodes = useMemo<[number, number, number][]>(() => compact
    ? [[0, 1.5, -.7], [-1.35, 1, .25], [1.35, 1, .25], [-2, .48, 1.25], [0, .48, 1.25], [2, .48, 1.25]]
    : [[0, 1.68, -1], [-1.65, 1.08, -.1], [1.65, 1.08, -.1], [-2.45, .53, 1], [-.82, .53, 1], [.82, .53, 1], [2.45, .53, 1]], [compact])
  const links = useMemo(() => nodes.slice(1).map((node, index) => {
    const parent = nodes[Math.floor((index + 1 - 1) / 2)]
    return makeCurve([[8.2 + parent[0], parent[1], -5.3 + parent[2]], [8.2 + parent[0] * .7 + node[0] * .3, (parent[1] + node[1]) / 2, -5.3 + (parent[2] + node[2]) / 2], [8.2 + node[0], node[1], -5.3 + node[2]]])
  }), [nodes])
  return <group>
    <Plate width={6.7} depth={4.5} thickness={.2} material={materials.boardEdge} position={[8.2, .03, -5.3]} />
    {links.map((curve, index) => <TubeMesh key={index} curve={curve} materials={materials} />)}
    {nodes.map(([x, y, z], index) => <group key={index} position={[8.2 + x, y, -5.3 + z]}>
      <Housing materials={materials} width={index === 0 ? 1.42 : 1.15} depth={.82} height={.32} selected={index === 0} />
      <mesh position={[0, .32, .34]} material={index === 0 ? materials.lime : materials.ivory}>
        <boxGeometry args={[.54, .04, .045]} />
      </mesh>
    </group>)}
  </group>
}

function FifoHardware({ materials, compact }: { materials: HardwareMaterials; compact: boolean }) {
  const count = compact ? 5 : 7
  const start = -(count - 1) / 2
  return <group position={[8.5, 0, 5.5]}>
    <Plate width={count * .92 + .7} depth={2.05} thickness={.28} material={materials.boardEdge} position={[0, .02, 0]} />
    <mesh position={[0, .42, -.78]} material={materials.gold} castShadow><boxGeometry args={[count * .87, .12, .1]} /></mesh>
    <mesh position={[0, .42, .78]} material={materials.gold} castShadow><boxGeometry args={[count * .87, .12, .1]} /></mesh>
    {Array.from({ length: count }, (_, index) => <group key={index} position={[(index + start) * .92, .26, 0]}>
      <Housing materials={materials} width={.7} depth={1.15} height={.34} selected={index === 0} />
      <mesh position={[0, .52, .62]} material={index === 0 ? materials.lime : materials.ivory}>
        <boxGeometry args={[.08, .08, .08]} />
      </mesh>
    </group>)}
    <mesh position={[(start - .48) * .92, .69, 0]} material={materials.lime} castShadow><boxGeometry args={[.12, .42, .16]} /></mesh>
    <mesh position={[(count + start - .52) * .92, .69, 0]} material={materials.gold} castShadow><boxGeometry args={[.12, .42, .16]} /></mesh>
  </group>
}

function HashHardware({ materials, compact }: { materials: HardwareMaterials; compact: boolean }) {
  const buckets = compact ? 3 : 4
  const entries = compact ? 2 : 3
  return <group position={[10, 0, -.7]}>
    <Plate width={4.65} depth={5.7} thickness={.22} material={materials.boardEdge} position={[0, .02, 0]} />
    {Array.from({ length: buckets }, (_, bucket) => <group key={bucket} position={[0, .2, (bucket - (buckets - 1) / 2) * 1.3]}>
      <mesh position={[-1.72, .25, 0]} material={materials.gold} castShadow><boxGeometry args={[.45, .52, .82]} /></mesh>
      <mesh position={[-1.72, .54, 0]} material={materials.lime}><boxGeometry args={[.18, .035, .12]} /></mesh>
      {Array.from({ length: entries }, (_, entry) => <group key={entry} position={[-.9 + entry * 1.04, 0, 0]}>
        <Housing materials={materials} width={.74} depth={.72} height={.3} selected={bucket === 1 && entry === 0} />
      </group>)}
      {Array.from({ length: entries }, (_, entry) => <CircuitTrace key={entry} materials={materials} radius={.035} points={[
        [-1.48 + entry * 1.04, .3, 0], [-1.12 + entry * 1.04, .46, 0], [-.72 + entry * 1.04, .3, 0],
      ]} />)}
    </group>)}
  </group>
}

function ProcessTreeHardware({ materials, compact }: { materials: HardwareMaterials; compact: boolean }) {
  const nodes = useMemo<[number, number, number][]>(() => compact
    ? [[-8.8, .78, 4.2], [-10.2, .45, 5.5], [-7.4, .45, 5.5], [-10.9, .22, 6.7], [-9.5, .22, 6.7], [-8.1, .22, 6.7]]
    : [[-8.8, .85, 4.2], [-10.15, .5, 5.45], [-7.45, .5, 5.45], [-10.85, .25, 6.7], [-9.45, .25, 6.7], [-8.15, .25, 6.7], [-6.75, .25, 6.7]], [compact])
  return <group>
    <Plate width={5.6} depth={4} thickness={.18} material={materials.boardEdge} position={[-8.8, .02, 5.5]} />
    {nodes.slice(1).map(([x, y, z], index) => {
      const parent = nodes[Math.floor(index / 2)]
      const curve = makeCurve([[parent[0], parent[1] + .1, parent[2]], [(parent[0] + x) / 2, .62, (parent[2] + z) / 2], [x, y + .1, z]])
      return <TubeMesh key={`tree-branch-${index}`} curve={curve} materials={materials} radius={.052} />
    })}
    {nodes.map(([x, y, z], index) => <group key={index} position={[x, y, z]}>
      <Housing materials={materials} width={index === 0 ? 1.06 : .74} depth={.62} height={.27} selected={index === 0} />
      <mesh position={[0, .29, .32]} material={materials.lime}><boxGeometry args={[.18, .045, .045]} /></mesh>
    </group>)}
  </group>
}

function MemoryHardware({ materials, compact }: { materials: HardwareMaterials; compact: boolean }) {
  const count = compact ? 3 : 5
  return <group position={[0, 0, -8]}>
    <Plate width={count * 1.25 + .7} depth={2.2} thickness={.22} material={materials.boardEdge} position={[0, .02, 0]} />
    {Array.from({ length: count }, (_, index) => <group key={index} position={[(index - (count - 1) / 2) * 1.25, .2, 0]}>
      <Housing materials={materials} width={.96} depth={1.62} height={.55} selected={index === Math.floor(count / 2)} />
      <mesh position={[0, .51, .84]} material={materials.gold}><boxGeometry args={[.48, .06, .06]} /></mesh>
    </group>)}
  </group>
}

function makeRoutes(compact: boolean) {
  const definitions: { id: number; points: [number, number, number][]; stage: number }[] = [
    { id: 0, stage: 1, points: [[-9.2, .72, -1.4], [-7.5, .82, -1.3], [-6.4, .9, -.6], [-5, 1.15, -.3], [-4.1, 1.26, 0]] },
    { id: 1, stage: 2, points: [[8.2, .72, -5.3], [6.4, .92, -4], [5.6, 1.05, -2.8], [4.8, 1.2, -1.8], [4.2, 1.29, -.8]] },
    { id: 2, stage: 2, points: [[8.5, .7, 5.5], [6.6, .86, 4.4], [5.4, 1, 3.1], [4.3, 1.18, 2], [3.7, 1.3, 1.5]] },
    { id: 3, stage: 4, points: [[10, .72, -.7], [7.9, .9, -.5], [6.2, 1.05, -.2], [4.8, 1.18, .2], [4.15, 1.3, .4]] },
    { id: 4, stage: 1, points: [[-8.8, .76, 5.5], [-7.1, .86, 4.6], [-6.1, .97, 3.4], [-4.7, 1.2, 2.2], [-3.9, 1.28, 1.7]] },
    { id: 5, stage: 4, points: [[0, .72, -8], [.1, .85, -6.1], [.5, 1, -4.5], [.6, 1.17, -3], [.4, 1.27, -2.4]] },
  ]
  return compact ? definitions.filter((route) => route.id % 2 === 0 || route.id === 5) : definitions
}

function DataConduit({ points, materials, active, progress, reduced, speed, offset }: {
  points: [number, number, number][]; materials: HardwareMaterials; active: boolean; progress: MutableRefObject<number>; reduced: boolean; speed: number; offset: number
}) {
  const packets = useRef<(Group | null)[]>([])
  const curve = useMemo(() => makeCurve(points), [points])
  const shell = useMemo(() => curveGeometry(curve, .135, 72, 10), [curve])
  const filament = useMemo(() => curveGeometry(curve, .018, 72, 6), [curve])
  const packetGeometry = useMemo(() => new CapsuleGeometry(.075, .17, 4, 8), [])
  const samples = useMemo(() => {
    const positions: Vector3[] = []
    for (let index = 0; index < 161; index += 1) positions.push(curve.getPointAt(index / 160))
    return positions
  }, [curve])
  const tangent = useMemo(() => new Vector3(), [])
  const up = useMemo(() => new Vector3(0, 1, 0), [])

  useEffect(() => () => { shell.dispose(); filament.dispose(); packetGeometry.dispose() }, [shell, filament, packetGeometry])
  useFrame((state) => {
    const elapsed = state.clock.elapsedTime
    packets.current.forEach((packet, index) => {
      if (!packet) return
      const phase = reduced ? (progress.current * .82 + index / 3 + offset) % 1 : (elapsed * speed + index / 3 + offset) % 1
      const sample = phase * (samples.length - 1)
      const base = Math.floor(sample)
      const alpha = sample - base
      const a = samples[base]
      const b = samples[Math.min(base + 1, samples.length - 1)]
      packet.position.set(a.x + (b.x - a.x) * alpha, a.y + (b.y - a.y) * alpha, a.z + (b.z - a.z) * alpha)
      curve.getTangentAt(phase, tangent)
      packet.quaternion.setFromUnitVectors(up, tangent)
      const pulse = active ? 1 : .55
      packet.scale.setScalar(pulse * (index === 0 ? 1 : .76))
    })
  })

  const collarA = useMemo(() => curve.getPointAt(0), [curve])
  const collarB = useMemo(() => curve.getPointAt(1), [curve])
  return <group>
    <mesh geometry={shell} material={materials.glass} />
    <mesh geometry={filament} material={materials.gold} />
    {[collarA, collarB].map((point, index) => <mesh key={index} position={point} rotation={[Math.PI / 2, 0, 0]} material={materials.titanium} castShadow>
      <torusGeometry args={[.17, .036, 7, 18]} />
    </mesh>)}
    {[0, 1, 2].map((index) => <group key={index} ref={(element) => { packets.current[index] = element }}>
      <mesh geometry={packetGeometry} material={index === 0 ? materials.lime : index === 1 ? materials.ivory : materials.gold} castShadow />
    </group>)}
  </group>
}

function MachineCamera({ progress, pointer, reduced }: { progress: MutableRefObject<number>; pointer: MutableRefObject<[number, number]>; reduced: boolean }) {
  const { camera } = useThree()
  const positions = useMemo(() => [new Vector3(0, 17.8, 27), new Vector3(-13.5, 9.4, 14), new Vector3(13.2, 10.4, 13.5), new Vector3(.5, 7.1, 10.8), new Vector3(12.5, 8.4, -12.5), new Vector3(-.5, 16.8, 25)], [])
  const targets = useMemo(() => [new Vector3(0, .55, 0), new Vector3(-8.8, .55, -.5), new Vector3(8.4, .8, .1), new Vector3(0, .9, 0), new Vector3(4.2, .6, -5), new Vector3(0, .45, 0)], [])
  const desiredPosition = useMemo(() => new Vector3(), [])
  const desiredTarget = useMemo(() => new Vector3(), [])
  const currentTarget = useMemo(() => new Vector3(), [])

  useFrame((_, delta) => {
    const p = Math.min(.9999, Math.max(0, progress.current))
    const route = p * (positions.length - 1)
    const segment = Math.min(positions.length - 2, Math.floor(route))
    const t = route - segment
    const eased = t * t * (3 - 2 * t)
    desiredPosition.lerpVectors(positions[segment], positions[segment + 1], eased)
    desiredTarget.lerpVectors(targets[segment], targets[segment + 1], eased)
    desiredTarget.x += pointer.current[0] * .7
    desiredTarget.y -= pointer.current[1] * .38
    if (reduced) {
      camera.position.copy(desiredPosition)
      currentTarget.copy(desiredTarget)
    } else {
      const blend = 1 - Math.exp(-Math.min(delta, .05) * 3.8)
      camera.position.lerp(desiredPosition, blend)
      currentTarget.lerp(desiredTarget, blend)
    }
    camera.lookAt(currentTarget)
  })
  return null
}

export function LandingEnvironment3D({ progress, stage, compact, reduced, pointer }: {
  progress: MutableRefObject<number>; stage: number; compact: boolean; reduced: boolean; pointer: MutableRefObject<[number, number]>
}) {
  const materials = useMemo(createMaterials, [])
  const { gl, scene } = useThree()
  const environmentMap = useMemo(() => {
    const generator = new PMREMGenerator(gl)
    const room = new RoomEnvironment()
    const target = generator.fromScene(room, .04)
    room.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      mesh.geometry.dispose()
      const material = mesh.material
      if (Array.isArray(material)) material.forEach((item) => item.dispose())
      else material.dispose()
    })
    return { generator, target }
  }, [gl])
  const routes = useMemo(() => makeRoutes(compact), [compact])
  const keyLight = useRef<PointLight>(null)
  const lightPositions = useMemo(() => [new Vector3(-9, 4.2, -.8), new Vector3(8.2, 4.4, -5.1), new Vector3(0, 4.5, 0), new Vector3(9.6, 4.2, -.5)], [])
  const currentLightPosition = useMemo(() => new Vector3(), [])
  const screws = useRef<InstancedMesh>(null)
  const screwDummy = useMemo(() => new Object3D(), [])
  const screwGeometry = useMemo(() => new CylinderGeometry(.17, .17, .1, 12), [])

  useEffect(() => {
    if (!screws.current) return
    const bolts = [[-12.2, -.02, -8.2], [12.2, -.02, -8.2], [-12.2, -.02, 8.2], [12.2, -.02, 8.2]]
    bolts.forEach(([x, y, z], index) => {
      screwDummy.position.set(x, y, z)
      screwDummy.rotation.set(0, index * .23, 0)
      screwDummy.updateMatrix()
      screws.current?.setMatrixAt(index, screwDummy.matrix)
    })
    screws.current.instanceMatrix.needsUpdate = true
  }, [screwDummy])

  useEffect(() => () => {
    screwGeometry.dispose()
    Object.values(materials).forEach((material) => material.dispose())
  }, [materials, screwGeometry])
  useEffect(() => {
    scene.environment = environmentMap.target.texture
    scene.environmentIntensity = .24
    return () => {
      scene.environment = null
      scene.environmentIntensity = 1
      environmentMap.target.dispose()
      environmentMap.generator.dispose()
    }
  }, [environmentMap, scene])
  useFrame((_, delta) => {
    const locationIndex = stage === 1 ? 0 : stage === 2 ? 1 : stage === 3 ? 2 : stage === 4 ? 3 : -1
    if (!keyLight.current || locationIndex < 0) return
    currentLightPosition.lerpVectors(keyLight.current.position, lightPositions[locationIndex], 1 - Math.exp(-Math.min(delta, .05) * 4))
    keyLight.current.position.copy(currentLightPosition)
  })

  return <>
    <color attach="background" args={['#0B0D0C']} />
    <fog attach="fog" args={['#0B0D0C', 30, 58]} />
    <MachineCamera progress={progress} pointer={pointer} reduced={reduced} />
    <ambientLight intensity={.22} color="#C8CEC5" />
    <hemisphereLight args={['#C6CBC4', '#101410', .42]} />
    <directionalLight position={[-10, 19, 11]} intensity={2.2} color="#E1E2D8" castShadow={!compact} shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-near={.5} shadow-camera-far={62} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={18} shadow-camera-bottom={-18} shadow-bias={-.00025} />
    <directionalLight position={[12, 7, -12]} intensity={.52} color="#B88A56" />
    <pointLight ref={keyLight} position={[0, 4, 0]} intensity={stage > 0 && stage < 5 ? 10 : 2.4} distance={13} decay={2} color="#A8D94F" />

    <mesh position={[0, -1.45, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={materials.board}>
      <planeGeometry args={[120, 120]} />
    </mesh>
    <CircuitBoard materials={materials} compact={compact} />
    <LinkedListHardware materials={materials} compact={compact} />
    <HeapHardware materials={materials} compact={compact} />
    <FifoHardware materials={materials} compact={compact} />
    <HashHardware materials={materials} compact={compact} />
    <ProcessTreeHardware materials={materials} compact={compact} />
    <MemoryHardware materials={materials} compact={compact} />
    {routes.map((route) => <DataConduit key={route.id} points={route.points} materials={materials} active={route.stage === stage} progress={progress} reduced={reduced} speed={.083 + route.id * .004} offset={(route.id % 3) * .13} />)}
    <instancedMesh ref={screws} args={[screwGeometry, materials.titanium, 4]} castShadow receiveShadow />
  </>
}
