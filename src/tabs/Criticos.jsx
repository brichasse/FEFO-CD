import { useState } from 'react'
import { RiskBadge, AreaPill, TH, TD, EmptyState } from '../components.jsx'

export default function Criticos({ latest }) {
  const [busqueda, setBusqueda] = useState('')

  const agg = latest ? latest.rows : []
  const crit = [...agg].filter(r => r.dias < 60).sort((a, b) => a.dias - b.dias || b.cajas - a.cajas)

  if (!latest) return <EmptyState icon="📦" text="Sube el primer CSV para ver lotes críticos." />
  if (crit.length === 0) return <EmptyState icon="✅" text="Sin lotes críticos en este snapshot." />

  const filtrados = busqueda.trim()
    ? crit.filter(r =>
        r.sku.toLowerCase().includes(busqueda.toLowerCase()) ||
        r.desc.toLowerCase().includes(busqueda.toLowerCase())
      )
    : crit

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
          Lotes con menos de 60 días de vida útil · snapshot {latest.date} · {filtrados.length}
          {busqueda.trim() ? ` de ${crit.length}` : ''} registros
        </p>
        <div style={{ position: 'relative' }}>
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar SKU o descripción…"
            style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 32px 6px 12px', fontSize: 12, width: 270, outline: 'none', fontFamily: 'inherit', color: '#0f172a' }}
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14, lineHeight: 1, padding: 0 }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          Sin resultados para "{busqueda}"
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <TH width="105px">SKU</TH>
                <TH width="200px">Descripción</TH>
                <TH width="60px">Días</TH>
                <TH width="75px">Cajas</TH>
                <TH width="95px">Vence</TH>
                <TH width="200px">Área</TH>
                <TH width="95px">Riesgo</TH>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r, i) => (
                <tr key={i} style={{ background: r.dias < 15 ? '#fef2f2' : r.dias < 30 ? '#fffbeb' : 'white' }}>
                  <TD style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{r.sku}</TD>
                  <TD>{r.desc}</TD>
                  <TD style={{ fontWeight: 700, fontFamily: "'DM Mono', monospace", color: r.dias < 15 ? '#dc2626' : '#d97706' }}>{r.dias}</TD>
                  <TD style={{ fontFamily: "'DM Mono', monospace" }}>{r.cajas.toLocaleString()}</TD>
                  <TD style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{r.fv}</TD>
                  <TD><AreaPill area={r.area} /></TD>
                  <TD><RiskBadge dias={r.dias} /></TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
