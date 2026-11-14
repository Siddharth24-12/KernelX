import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../api/client'
import { memoryApi } from '../api/memory'
import { processesApi } from '../api/processes'
import { simulationApi } from '../api/simulation'
import type { MemorySnapshot, ProcessRecord, SimulationSnapshot, SystemEvent } from '../types/api'

export function useSystemData(interval = 3500) {
  const [processes, setProcesses] = useState<ProcessRecord[]>([])
  const [memory, setMemory] = useState<MemorySnapshot | null>(null)
  const [simulation, setSimulation] = useState<SimulationSnapshot | null>(null)
  const [events, setEvents] = useState<SystemEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const busy = useRef(false)

  const refresh = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {
      const [nextProcesses, nextMemory, nextSimulation, nextEvents] = await Promise.all([
        processesApi.list(), memoryApi.get(), simulationApi.state(), simulationApi.events(),
      ])
      setProcesses(nextProcesses); setMemory(nextMemory); setSimulation(nextSimulation)
      setEvents([...nextEvents].sort((a, b) => b.eventId - a.eventId))
      setConnected(true); setError('')
    } catch (cause) { setConnected(false); setError(errorMessage(cause)) }
    finally { setLoading(false); busy.current = false }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, interval)
    return () => window.clearInterval(timer)
  }, [refresh, interval])

  return { processes, memory, simulation, events, connected, loading, error, refresh, setProcesses, setMemory, setSimulation }
}
