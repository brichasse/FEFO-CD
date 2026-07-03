import { useState } from 'react'
import { pctVida, classifyPct } from '../fefo.js'
import { VidaBadge, AreaPill, TH, TD, EmptyState } from '../components.jsx'

export default function Criticos({ latest }) {
  const [busqueda, setBusqueda] = useState('')

  if (!latest) return <EmptyState icon="📦" text="Sube el primer CSV para ver el inventario." />

  const agg = latest.rows

  const ordenado = [...agg].sort((a, b) => {
    const pa = pctVida(a), pb = pctVida(b)
    if (pa == null) return 1
    if (pb == null) return -1
    return pa - pb
  })

  const filtrados = busqueda.trim()
    ? ordenado.filter(r =>
        r.sku.toLowerCase().includes(busqueda.toLowerCase()) ||
        r.desc.toLowerCase().includes(busqueda.toLowerCase())
      )
    : ordenado

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
          Inventario completo ordenado por vida útil · snapshot {latest.date} · {filtrados.length}
          {busqueda.trim() ? ` de ${ordenado.length}` : ''} registros
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
                <TH width="190px">Descripción</TH>
                <TH width="60px">Días</TH>
                <TH width="70px">Vida útil</TH>
                <TH width="60px">% Vida</TH>
                <TH width="70px">Cajas</TH>
                <TH width="90px">Vence</TH>
                <TH width="180px">Área</TH>
                <TH width="110px">Estado</TH>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r, i) => {
                const pct = pctVida(r)
                const c = classifyPct(pct, r.vidaUtil)
                const bg = c.nivel >= 4 ? '#fef2f2'
                  : c.nivel === 3 ? '#fff5f5'
                  : c.nivel === 2 ? '#fffbeb'
                  : 'white'
                return (
                  <tr key={i} style={{ background: bg }}>
                    <TD style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{r.sku}</TD>
                    <TD>{r.desc}</TD>
                    <TD style={{ fontFamily: "'DM Mono', monospace", color: '#64748b' }}>{r.dias}</TD>
                    <TD style={{ fontFamily: "'DM Mono', monospace", color: '#94a3b8' }}>{r.vidaUtil ?? '—'}</TD>
                    <TD style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: '#0f172a' }}>{pct != null ? `${Math.round(pct)}%` : '—'}</TD>
                    <TD style={{ fontFamily: "'DM Mono', monospace" }}>{r.cajas.toLocaleString()}</TD>
                    <TD style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{r.fv}</TD>
                    <TD><AreaPill area={r.area} /></TD>
                    <TD><VidaBadge pct={pct} vidaUtil={r.vidaUtil} /></TD>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
