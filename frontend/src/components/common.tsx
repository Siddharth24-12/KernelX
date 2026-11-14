import type { ReactNode } from 'react'
import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-react'

export function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <header className="page-intro"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="page-action">{action}</div>}</header>
}
export function Panel({ children, className = '', title, meta }: { children: ReactNode; className?: string; title?: string; meta?: ReactNode }) {
  return <section className={`panel ${className}`}>{(title || meta) && <div className="panel-head">{title && <h2>{title}</h2>}{meta && <div>{meta}</div>}</div>}{children}</section>
}
export function Empty({ title, message }: { title: string; message: string }) { return <div className="empty-state"><span className="empty-mark">∅</span><strong>{title}</strong><p>{message}</p></div> }
export function Loading({ label = 'Synchronizing with KernelX…' }: { label?: string }) { return <div className="loading-state"><LoaderCircle className="spin" size={18} />{label}</div> }
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) { return <div className="error-banner"><AlertTriangle size={17} /><span>{message}</span>{onRetry && <button className="inline-action" onClick={onRetry}><RefreshCw size={14} /> Retry</button>}</div> }
export function StatusPill({ state }: { state: string }) { return <span className={`status-pill status-${state.toLowerCase()}`}><i />{state.replaceAll('_', ' ')}</span> }
export function Button({ children, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' | 'danger' }) { return <button className={`button button-${variant} ${props.className ?? ''}`} {...props}>{children}</button> }
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label> }
export function formatTime(value: number) { return `${value.toString().padStart(2, '0')}<span class="unit"> t</span>` }
