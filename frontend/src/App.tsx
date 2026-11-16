import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './layouts/AppShell'
import { Loading } from './components/common'

const OverviewPage = lazy(() => import('./pages/OverviewPage').then((module) => ({ default: module.OverviewPage })))
const LandingPage = lazy(() => import('./pages/LandingPage').then((module) => ({ default: module.LandingPage })))
const ProcessesPage = lazy(() => import('./pages/ProcessesPage').then((module) => ({ default: module.ProcessesPage })))
const SchedulerPage = lazy(() => import('./pages/SchedulerPage').then((module) => ({ default: module.SchedulerPage })))
const MemoryPage = lazy(() => import('./pages/MemoryPage').then((module) => ({ default: module.MemoryPage })))
const ProcessTreePage = lazy(() => import('./pages/ProcessTreePage').then((module) => ({ default: module.ProcessTreePage })))
const EventMonitorPage = lazy(() => import('./pages/EventMonitorPage').then((module) => ({ default: module.EventMonitorPage })))
const ArchivePage = lazy(() => import('./pages/ArchivePage').then((module) => ({ default: module.ArchivePage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const CpuInternalsPage = lazy(() => import('./pages/CpuInternalsPage').then((module) => ({ default: module.CpuInternalsPage })))
const WorkloadStudioPage = lazy(() => import('./pages/WorkloadStudioPage').then((module) => ({ default: module.WorkloadStudioPage })))
const AlgorithmComparisonPage = lazy(() => import('./pages/AlgorithmComparisonPage').then((module) => ({ default: module.AlgorithmComparisonPage })))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage })))
const ExperimentationLabPage = lazy(() => import('./pages/ExperimentationLabPage').then((module) => ({ default: module.ExperimentationLabPage })))

export function App() {
  return <Routes>
    <Route path="/" element={<Suspense fallback={<Loading />}><LandingPage /></Suspense>} />
    <Route element={<AppShell />}>
      <Route path="overview" element={<Suspense fallback={<Loading />}><OverviewPage /></Suspense>} />
      <Route path="processes" element={<Suspense fallback={<Loading />}><ProcessesPage /></Suspense>} />
      <Route path="workloads" element={<Suspense fallback={<Loading />}><WorkloadStudioPage /></Suspense>} />
      <Route path="comparison" element={<Suspense fallback={<Loading />}><AlgorithmComparisonPage /></Suspense>} />
      <Route path="experiments" element={<Suspense fallback={<Loading />}><ExperimentationLabPage /></Suspense>} />
      <Route path="analytics" element={<Suspense fallback={<Loading />}><AnalyticsPage /></Suspense>} />
      <Route path="scheduler" element={<Suspense fallback={<Loading />}><SchedulerPage /></Suspense>} />
      <Route path="memory" element={<Suspense fallback={<Loading />}><MemoryPage /></Suspense>} />
      <Route path="tree" element={<Suspense fallback={<Loading />}><ProcessTreePage /></Suspense>} />
      <Route path="events" element={<Suspense fallback={<Loading />}><EventMonitorPage /></Suspense>} />
      <Route path="archive" element={<Suspense fallback={<Loading />}><ArchivePage /></Suspense>} />
      <Route path="settings" element={<Suspense fallback={<Loading />}><SettingsPage /></Suspense>} />
      <Route path="internals" element={<Suspense fallback={<Loading />}><CpuInternalsPage /></Suspense>} />
      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Route>
  </Routes>
}
