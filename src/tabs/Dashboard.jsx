import { pctVida, classifyPct } from '../fefo.js'
import { StatCard, AlertBar } from '../components.jsx'

export default function Dashboard({ snapshots, latest, prev, diff, incumples, cdName }) {
  const agg = latest ? latest.rows : []
  const tot = agg.reduce((s, r) => s + r.cajas, 0)

  const niveles = ['Urgente', 'Crítico', 'Alerta', 'Sano', 'Sin control', 'Sin dato']
  const rg = Object.fromEntries(niveles.map(n => [n, 0]))
  const rc = Object.fromEntries(niveles.map(n => [n, 0]))
  for (const r of agg) {
    const c = classifyPct(pctVida(r), r.vidaUtil)
    rg[c.label] = (rg[c.label] ?? 0) + 1
    rc[c.label] = (rc[c.label] ?? 0) + r.cajas
  }

  const criticos = [...agg]
    .filter(r => {
      const c = classifyPct(pctVida(r), r.vidaUtil)
      return c.nivel >= 3
    })
    .sort((a, b) => (pctVida(a) ?? 999) - (pctVida(b) ?? 999))

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
    ['Urgente', '#dc2626', '<30% vida'],
    ['Crítico', '#ef4444', '30–50% vida'],
    ['Alerta',  '#d97706', '50–55% vida'],
    ['Sano',    '#16a34a', '>55% vida'],
  ]

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
        <StatCard label="Total cajas"  value={tot.toLocaleString('es-CL')} />
        <StatCard label="SKUs activos" value={new Set(agg.map(r => r.sku)).size} />
        <StatCard label="Urgentes <30%" value={rg['Urgente']} color="#dc2626" sub={`${rc['Urgente'].toLocaleString()} cajas`} />
        <StatCard label="Críticos <50%" value={rg['Crítico']} color="#ef4444" sub={`${rc['Crítico'].toLocaleString()} cajas`} />
        {netaDelta !== null && (
          <StatCard label="Variación neta" value={netaDelta.toLocaleString('es-CL', { signDisplay: 'always' })} color="#0369a1" sub="vs día anterior" />
        )}
        {diff && (
          <StatCard label="FEFO incumple" value={incumples.length} color={incumples.length > 0 ? '#dc2626' : '#16a34a'} sub={`${diff.ok.length} OK`} />
        )}
      </div>

      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 18px', marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'DM Mono', monospace" }}>
          Distribución de cajas por % de vida útil
        </div>
        {riskRows.map(([lbl, color, rango]) => {
          const pct = tot > 0 ? rc[lbl] / tot * 100 : 0
          return (
            <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 70, fontSize: 11, color, fontWeight: 600, flexShrink: 0 }}>{lbl}</div>
              <div style={{ width: 80, fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>{rango}</div>
              <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 4, height: 9 }}>
                <div style={{ width: `${pct.toFixed(1)}%`, background: color, height: 9, borderRadius: 4, transition: 'width .4s ease' }} />
              </div>
              <div style={{ width: 75, fontSize: 11, color: '#64748b', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>{rc[lbl].toLocaleString()}</div>
              <div style={{ width: 38, fontSize: 11, color, fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{Math.round(pct)}%</div>
            </div>
          )
        })}
        {(rg['Sin control'] > 0 || rg['Sin dato'] > 0) && (
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 8, paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
            {rg['Sin control'] > 0 && `${rc['Sin control'].toLocaleString()} cajas sin control de vencimiento (perfiles 600/999/1100/9999)`}
            {rg['Sin control'] > 0 && rg['Sin dato'] > 0 && ' · '}
            {rg['Sin dato'] > 0 && `${rc['Sin dato'].toLocaleString()} cajas sin dato de vida útil`}
          </div>
        )}
      </div>

      {criticos.slice(0, 4).map((r, i) => {
        const pct = pctVida(r)
        return (
          <AlertBar key={i} bgColor="#fef2f2" borderColor="#dc2626"
            title={`${r.sku} — ${r.desc}`}
            body={`${Math.round(pct)}% vida útil (${r.dias}/${r.vidaUtil}d) · ${r.cajas.toLocaleString()} cajas · vence ${r.fv} · ${r.area}`}
          />
        )
      })}
      {diff && incumples.slice(0, 2).map((x, i) => (
        <AlertBar key={i} bgColor="#fffbeb" borderColor="#d97706"
          title={`⚠ FEFO incumplido — ${x.sku} · ${x.desc}`}
          body={`Lote ${x.dias_ant}d sin mover (${x.caj_ant} cj) en ${x.areas_ant.join(', ')} — lote ${x.dias_nvo}d consumido ${Math.abs(x.delta_nvo)} cj (${x.pct}%) en ${x.areas_nvo.join(', ')}`}
        />
      ))}
    </div>
  )
}
