import { classify, classifyPct } from './fefo.js'

export function RiskBadge({ dias }) {
  const c = classify(dias)
  return (
    <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {c.label}
    </span>
  )
}

export function VidaBadge({ pct, vidaUtil }) {
  const c = classifyPct(pct, vidaUtil)
  const mostrarPct = pct != null && !c.label.includes('control')
  return (
    <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {c.label}{mostrarPct ? ` · ${Math.round(pct)}%` : ''}
    </span>
  )
}

export function AreaPill({ area }) {
  const label = area.replace('AREA ', '').replace('ALMACENAMIENTO', 'ALMAC.')
  return (
    <span style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 500, display: 'inline-block', marginRight: 3, marginBottom: 3, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

export function StatCard({ label, value, color, sub }) {
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'DM Mono', monospace" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, color: color || '#0f172a', fontFamily: "'DM Mono', monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

export function AlertBar({ bgColor, borderColor, title, body }) {
  return (
    <div style={{ background: bgColor, borderLeft: `3px solid ${borderColor}`, borderRadius: '0 8px 8px 0', padding: '10px 14px', marginBottom: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: borderColor }}>{title}</div>
      {body && <div style={{ fontSize: 12, color: borderColor, opacity: 0.85, marginTop: 3 }}>{body}</div>}
    </div>
  )
}

export function TH({ children, width }) {
  return (
    <th style={{ fontSize: 11, fontWeight: 600, color: '#64748b', padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', width, background: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
      {children}
    </th>
  )
}

export function TD({ children, style }) {
  return (
    <td style={{ fontSize: 12, padding: '6px 10px', borderBottom: '1px solid #f1f5f9', color: '#1e293b', verticalAlign: 'top', ...style }}>
      {children}
    </td>
  )
}

export function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 14 }}>{text}</div>
    </div>
  )
}
