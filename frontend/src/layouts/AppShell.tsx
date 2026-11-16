import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Activity, Archive, ChevronLeft, ChevronRight, Cpu, Database, LayoutDashboard, Menu, Network, ScrollText, Settings2, Workflow, ListPlus, GitCompareArrows, ChartNoAxesCombined, FlaskConical } from 'lucide-react'
import { useSystemData } from '../hooks/useSystemData'
import '../internal-theme.css'

const primary = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/processes', label: 'Processes', icon: Workflow },
  { to: '/scheduler', label: 'CPU Scheduler', icon: Cpu },
  { to: '/memory', label: 'Memory Manager', icon: Database },
]
const later = [
  { to: '/tree', label: 'Process Tree', icon: Network },
  { to: '/workloads', label: 'Workload Studio', icon: ListPlus },
  { to: '/comparison', label: 'Algorithm Comparison', icon: GitCompareArrows },
  { to: '/experiments', label: 'Experimentation Lab', icon: FlaskConical },
  { to: '/analytics', label: 'System Analytics', icon: ChartNoAxesCombined },
  { to: '/events', label: 'Event Monitor', icon: ScrollText },
  { to: '/archive', label: 'Simulation Archive', icon: Archive },
  { to: '/internals', label: 'CPU Internals', icon: Cpu },
]
const titles: Record<string, string> = { '/overview': 'System overview', '/processes': 'Process manager', '/workloads': 'Workload studio', '/comparison': 'Algorithm comparison', '/experiments': 'Experimentation lab', '/analytics': 'System analytics', '/scheduler': 'CPU scheduler', '/memory': 'Memory manager', '/tree': 'Process tree', '/events': 'Event monitor', '/archive': 'Simulation archive', '/settings': 'Settings', '/internals': 'CPU internals' }

export function AppShell() {
  const data = useSystemData()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const title = titles[location.pathname] ?? 'KernelX'
  return <div className={`app-frame ${collapsed ? 'app-frame-collapsed' : ''}`}>
    <aside className={`sidebar ${open ? 'sidebar-open' : ''} ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="brand"><NavLink to="/" end className="brand-home" aria-label="KernelX home" title="KernelX home"><span className="brand-mark" aria-hidden="true"><span>K</span><i /></span><span className="brand-copy"><b>KERNEL<span>X</span></b><small>SIMULATION WORKSTATION</small></span></NavLink><button className="collapse-button" aria-label="Close navigation" title="Close navigation" onClick={() => setOpen(false)}><ChevronLeft size={18} /></button></div>
      <div className="sidebar-nav-scroll">
        <div className="nav-caption">CONTROL ROOM</div>
        <nav className="main-nav" aria-label="Main navigation">{primary.map(({ to, label, icon: Icon }, index) => <NavLink key={to} to={to} end={to === '/overview'} title={collapsed ? label : undefined} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><span className="nav-index">0{index + 1}</span><Icon size={19} strokeWidth={1.8} /><span className="nav-label">{label}</span><span className="nav-marker" /></NavLink>)}</nav>
        <div className="nav-caption nav-caption-lower">SYSTEM TOOLS</div>
        <nav className="main-nav" aria-label="Additional tools">{later.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} title={collapsed ? label : undefined} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link nav-secondary ${isActive ? 'active' : ''}`}><Icon size={19} strokeWidth={1.8} /><span className="nav-label">{label}</span><span className="nav-marker" /></NavLink>)}</nav>
      </div>
      <nav className="sidebar-settings" aria-label="Preferences"><NavLink to="/settings" title={collapsed ? 'Settings' : undefined} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link nav-secondary ${isActive ? 'active' : ''}`}><Settings2 size={19} strokeWidth={1.8} /><span className="nav-label">Settings</span><span className="nav-marker" /></NavLink></nav>
    </aside>
    {open && <button className="scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <div className="main-column">
      <header className="topbar"><button className="menu-button" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu size={20} /></button><button className="desktop-nav-toggle" aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} title={collapsed ? 'Expand navigation' : 'Collapse navigation'} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}</button><div className="breadcrumb"><span>WORKSPACE</span><b>/</b>{title}</div><div className="topbar-right"><span className={`connection ${data.connected ? 'is-connected' : 'is-disconnected'}`}><i />{data.connected ? 'API CONNECTED' : data.loading ? 'CONNECTING' : 'API OFFLINE'}</span><span className="topbar-divider" /><span className="topbar-sim"><span>SIMULATION</span><b>{data.simulation?.status ?? '—'}</b></span><span className="topbar-clock">T+{data.simulation?.currentTime ?? 0}</span><NavLink to="/scheduler" className="topbar-open" aria-label="Open scheduler"><Activity size={16} /></NavLink></div></header>
      <main className="page-content"><Outlet context={data} /></main>
      <footer className="app-footer"><span>KERNELX / OPERATING SYSTEM SIMULATOR</span><span>DATA REFRESH · 3.5 SEC</span></footer>
    </div>
  </div>
}
