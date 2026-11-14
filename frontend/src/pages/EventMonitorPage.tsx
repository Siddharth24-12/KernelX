import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useSystemData } from '../hooks/useSystemData'
import { PageIntro, Panel, Empty, Field } from '../components/common'
import type { SystemEvent } from '../types/api'
type Context = ReturnType<typeof useSystemData>
export function EventMonitorPage() {
  const { events } = useOutletContext<Context>(); const [query, setQuery] = useState(''); const [type, setType] = useState(''); const [pid, setPid] = useState('')
  const types = [...new Set(events.map((event) => event.type))].sort()
  const filtered = useMemo(() => [...events].filter((event) => (!type || event.type === type) && (!pid || event.pid === Number(pid)) && (!query || `${event.eventId} ${event.simulationTime} ${event.pid ?? ''} ${event.type} ${event.description}`.toLowerCase().includes(query.toLowerCase()))).sort((a, b) => a.simulationTime - b.simulationTime || a.eventId - b.eventId), [events, type, pid, query])
  return <><PageIntro eyebrow="KERNEL TELEMETRY / 06" title="Event monitor" description="Chronological system events emitted by the simulation backend." action={<span className="event-count mono">{filtered.length} / {events.length} EVENTS</span>} />
    <Panel className="event-panel" title="System event stream" meta={<span className="section-meta">SIMULATION CLOCK · ASCENDING</span>}><div className="event-filters"><Field label="Search events"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ID, PID, type or description" /></Field><Field label="Event type"><select value={type} onChange={(event) => setType(event.target.value)}><option value="">All types</option>{types.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="PID"><input type="number" min="1" value={pid} onChange={(event) => setPid(event.target.value)} placeholder="All processes" /></Field><button className="inline-action event-clear" onClick={() => { setQuery(''); setType(''); setPid('') }}>Clear filters</button></div>
      {filtered.length ? <div className="event-table-scroll"><table className="event-table"><thead><tr><th>EVENT ID</th><th>SIM TIME</th><th>PID</th><th>TYPE</th><th>DESCRIPTION</th></tr></thead><tbody>{filtered.map((event: SystemEvent) => <tr key={event.eventId}><td>#{String(event.eventId).padStart(5, '0')}</td><td>T+{String(event.simulationTime).padStart(4, '0')}</td><td>{event.pid === null ? '—' : `P${event.pid}`}</td><td><span className="event-type">{event.type}</span></td><td>{event.description}</td></tr>)}</tbody></table></div> : <Empty title={events.length ? 'No matching events' : 'Event stream is empty'} message={events.length ? 'Change or clear a filter to see matching backend events.' : 'Events appear here when the backend records simulation activity.'} />}</Panel>
  </>
}
