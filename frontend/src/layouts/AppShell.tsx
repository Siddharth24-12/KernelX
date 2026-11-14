import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Activity, Boxes, ChevronLeft, CircleHelp, Cpu, Database, LayoutDashboard, Menu, Network, ScrollText, Settings2, Workflow } from 'lucide-react'
import { useSystemData } from '../hooks/useSystemData'

const primary = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/processes', label: 'Processes', icon: Workflow },
  { to: '/scheduler', label: 'CPU Scheduler', icon: Cpu },
  { to: '/memory', label: 'Memory Manager', icon: Database },
]
const later = [
  { to: '/tree', label: 'Process Tree', icon: Network },
  { to: '/events', label: 'Event Monitor', icon: ScrollText },
  { to: '/archive', label: 'Simulation Archive', icon: Boxes },
  { to: '/settings', label: 'Settings', icon: Settings2 },
  { to: '/internals', label: 'CPU Internals', icon: Cpu },
]
const titles: Record<string, string> = { '/': 'System overview', '/processes': 'Process manager', '/scheduler': 'CPU scheduler', '/memory': 'Memory manager', '/tree': 'Process tree', '/events': 'Event monitor', '/archive': 'Simulation archive', '/settings': 'Settings', '/internals': 'CPU internals' }

export function AppShell() {
  const data = useSystemData()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const title = titles[location.pathname] ?? 'KernelX'
  return <div className="app-frame">
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><span>K</span><i /></div><div><b>KERNEL<span>X</span></b><small>SIMULATION WORKSTATION</small></div><button className="collapse-button" aria-label="Close navigation" onClick={() => setOpen(false)}><ChevronLeft size={17} /></button></div>
      <div className="nav-caption">CONTROL ROOM</div>
      <nav className="main-nav" aria-label="Main navigation">{primary.map(({ to, label, icon: Icon }, index) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><span className="nav-index">0{index + 1}</span><Icon size={17} strokeWidth={1.8} /><span>{label}</span><span className="nav-marker" /></NavLink>)}</nav>
      <div className="nav-caption nav-caption-lower">SYSTEM TOOLS</div>
      <nav className="main-nav" aria-label="Additional tools">{later.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link nav-secondary ${isActive ? 'active' : ''}`}><Icon size={17} strokeWidth={1.8} /><span>{label}</span><span className="nav-marker" /></NavLink>)}</nav>
      <div className="sidebar-foot"><div className="foot-rule" /><div className="foot-label"><CircleHelp size={14} /> PHASE 04 / WORKSPACE</div><p>Scheduling, memory, process control and simulation persistence.</p><div className="build-stamp">KERNELX · BUILD 0.4.0</div></div>
    </aside>
    {open && <button className="scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <div className="main-column">
      <header className="topbar"><button className="menu-button" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu size={20} /></button><div className="breadcrumb"><span>WORKSPACE</span><b>/</b>{title}</div><div className="topbar-right"><span className={`connection ${data.connected ? 'is-connected' : 'is-disconnected'}`}><i />{data.connected ? 'API CONNECTED' : data.loading ? 'CONNECTING' : 'API OFFLINE'}</span><span className="topbar-divider" /><span className="topbar-sim"><span>SIMULATION</span><b>{data.simulation?.status ?? '—'}</b></span><span className="topbar-clock">T+{data.simulation?.currentTime ?? 0}</span><NavLink to="/scheduler" className="topbar-open" aria-label="Open scheduler"><Activity size={16} /></NavLink></div></header>
      <main className="page-content"><Outlet context={data} /></main>
      <footer className="app-footer"><span>KERNELX / OPERATING SYSTEM SIMULATOR</span><span>DATA REFRESH · 3.5 SEC</span></footer>
    </div>
  </div>
}
