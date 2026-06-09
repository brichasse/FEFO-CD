import { classify } from '../fefo.js'
import { StatCard, AlertBar } from '../components.jsx'

export default function Dashboard({ snapshots, latest, prev, diff, incumples, cdName }) {
  const agg = latest ? latest.rows : []
  const tot = agg.reduce((s, r) => s + r.cajas, 0)

  const rg = { Crítico: 0, 'Alto Riesgo': 0, Medio: 0, Bajo: 0 }
  const rc = { Crítico: 0, 'Alto Riesgo': 0, Medio: 0, Bajo: 0 }
  for (const r of agg) { const c = classify(r.dias); rg[c.label]++; rc[c.label] += r.cajas }

  const crit = [...agg].filter(r => r.dias < 60).sort((a, b) => a.dias - b.dias)
  const netaDelta = diff
    ? latest.rows.reduce((s, r) => s + r.cajas, 0) - prev.rows.reduce((s, r) => s + r.cajas, 0)
    : null

  if (snapshots.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94a3b8' }}>
        <div style={{ fontSize: 52 }}>📦</div>
        <div style={{ fontSize: 16, marginTop: 16, fontWeight: 500, color: '#64748b' }}>Sin datos aún</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>Usa el botón "Subir CSV" para cargar tu primer snapshot</div>
      </div>
    )
  }

  const riskRows = [
    ['Crítico',    '#dc2626', '#fef2f2'],
    ['Alto Riesgo','#d97706', '#fffbeb'],
    ['Medio',      '#ca8a04', '#fefce8'],
    ['Bajo',       '#16a34a', '#f0fdf4'],
  ]

  return (
    <div>
      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
        <StatCard label="Total cajas"   value={tot.toLocaleString('es-CL')} />
        <StatCard label="SKUs activos"  value={new Set(agg.map(r => r.sku)).size} />
        <StatCard label="Críticos <60d" value={rg['Crítico']}    color="#dc2626" sub={`${rc['Crítico'].toLocaleString()} cajas`} />
        <StatCard label="Alto 60–89d"   value={rg['Alto Riesgo']} color="#d97706" sub={`${rc['Alto Riesgo'].toLocaleString()} cajas`} />
        {netaDelta !== null && (
          <StatCard label="Variación neta" value={netaDelta.toLocaleString('es-CL', { signDisplay: 'always' })} color="#0369a1" sub="vs día anterior" />
        )}
        {diff && (
          <StatCard label="FEFO incumple" value={incumples.length} color={incumples.length > 0 ? '#dc2626' : '#16a34a'} sub={`${diff.ok.length} OK`} />
        )}
      </div>

      {/* Risk bars */}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px', marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'DM Mono', monospace" }}>
          Distribución de cajas por tramo de riesgo
        </div>
        {riskRows.map(([lbl, color, bg]) => {
          const pct = tot > 0 ? rc[lbl] / tot * 100 : 0
          return (
            <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 90, fontSize: 11, color, fontWeight: 600, flexShrink: 0 }}>{lbl}</div>
              <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 4, height: 9 }}>
                <div style={{ width: `${pct.toFixed(1)}%`, background: color, height: 9, borderRadius: 4, transition: 'width .4s ease' }} />
              </div>
              <div style={{ width: 75, fontSize: 11, color: '#64748b', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>{rc[lbl].toLocaleString()}</div>
              <div style={{ width: 38, fontSize: 11, color, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{Math.round(pct)}%</div>
            </div>
          )
        })}
      </div>

      {/* Top alerts */}
      {crit.slice(0, 4).map((r, i) => (
        <AlertBar key={i} bgColor="#fef2f2" borderColor="#dc2626"
          title={`${r.sku} — ${r.desc}`}
          body={`${r.dias} días restantes · ${r.cajas.toLocaleString()} cajas · vence ${r.fv} · ${r.area}`}
        />
      ))}
      {diff && incumples.slice(0, 2).map((x, i) => (
        <AlertBar key={i} bgColor="#fffbeb" borderColor="#d97706"
          title={`⚠ FEFO incumplido — ${x.sku} · ${x.desc}`}
          body={`Lote ${x.dias_ant}d sin mover (${x.caj_ant} cj) en ${x.areas_ant.join(', ')} — lote ${x.dias_nvo}d consumido ${Math.abs(x.delta_nvo)} cj (${x.pct}%) en ${x.areas_nvo.join(', ')}`}
        />
      ))}
    </div>
  )
}
