import { pctVida, classifyPct, calcDiff } from '../fefo.js'
import { TH, TD, EmptyState } from '../components.jsx'

export default function Resumen({ allData, filtraEstado, onSelectCd }) {
  const cds = Object.keys(allData)
  if (cds.length === 0) return <EmptyState icon="🏢" text="Sube una base para ver el resumen de centros." />

  // Si no se pasa filtraEstado, usar identidad (sin filtro)
  const filtrar = filtraEstado || ((rows) => rows)

  const filas = cds.map(cd => {
    const snaps = allData[cd] || []
    const latest = snaps[snaps.length - 1]
    const prev = snaps[snaps.length - 2]
    const rows = latest ? filtrar(latest.rows) : []

    const totCajas = rows.reduce((s, r) => s + r.cajas, 0)
    const skus = new Set(rows.map(r => r.sku)).size

    let urgentes = 0, criticos = 0, alertas = 0
    let cjUrgente = 0, cjCritico = 0
    for (const r of rows) {
      const c = classifyPct(pctVida(r), r.vidaUtil)
      if (c.nivel === 4) { urgentes++; cjUrgente += r.cajas }
      else if (c.nivel === 3) { criticos++; cjCritico += r.cajas }
      else if (c.nivel === 2) { alertas++ }
    }

    // FEFO se calcula sobre datos filtrados también
    const diff = prev && latest ? calcDiff(filtrar(prev.rows), filtrar(latest.rows)) : null
    const incumple = diff ? diff.incumple.length : null

    return { cd, fecha: latest?.date, snaps: snaps.length, totCajas, skus, urgentes, criticos, alertas, cjUrgente, cjCritico, incumple }
  }).sort((a, b) => (b.urgentes + b.criticos) - (a.urgentes + a.criticos))

  const totalGeneral = filas.reduce((acc, f) => ({
    cajas: acc.cajas + f.totCajas,
    urgentes: acc.urgentes + f.urgentes,
    criticos: acc.criticos + f.criticos,
    incumple: acc.incumple + (f.incumple ?? 0),
  }), { cajas: 0, urgentes: 0, criticos: 0, incumple: 0 })

  return (
    <div>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
        Resumen de {cds.length} centro{cds.length > 1 ? 's' : ''} · datos del último snapshot de cada uno
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <TH width="120px">Centro</TH>
              <TH width="85px">Fecha</TH>
              <TH width="90px">Total cajas</TH>
              <TH width="60px">SKUs</TH>
              <TH width="120px">Urgentes &lt;30%</TH>
              <TH width="120px">Críticos &lt;50%</TH>
              <TH width="75px">Alertas</TH>
              <TH width="90px">FEFO ❌</TH>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={f.cd}
                onClick={() => onSelectCd(f.cd)}
                style={{ background: i % 2 === 0 ? 'white' : '#fafafa', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fafafa'}>
                <TD style={{ fontWeight: 600, color: '#0f172a' }}>{f.cd}</TD>
                <TD style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#64748b' }}>{f.fecha ?? '—'}</TD>
                <TD style={{ fontFamily: "'DM Mono', monospace" }}>{f.totCajas.toLocaleString()}</TD>
                <TD style={{ fontFamily: "'DM Mono', monospace" }}>{f.skus}</TD>
                <TD style={{ fontFamily: "'DM Mono', monospace", color: f.urgentes > 0 ? '#dc2626' : '#94a3b8', fontWeight: f.urgentes > 0 ? 700 : 400 }}>
                  {f.urgentes} <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}>· {f.cjUrgente.toLocaleString()} cj</span>
                </TD>
                <TD style={{ fontFamily: "'DM Mono', monospace", color: f.criticos > 0 ? '#ef4444' : '#94a3b8', fontWeight: f.criticos > 0 ? 700 : 400 }}>
                  {f.criticos} <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}>· {f.cjCritico.toLocaleString()} cj</span>
                </TD>
                <TD style={{ fontFamily: "'DM Mono', monospace", color: f.alertas > 0 ? '#d97706' : '#94a3b8' }}>{f.alertas}</TD>
                <TD style={{ fontFamily: "'DM Mono', monospace", color: f.incumple > 0 ? '#dc2626' : '#16a34a', fontWeight: f.incumple > 0 ? 700 : 400 }}>
                  {f.incumple ?? '—'}
                </TD>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
              <TD style={{ fontWeight: 700 }}>TOTAL</TD>
              <TD></TD>
              <TD style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{totalGeneral.cajas.toLocaleString()}</TD>
              <TD></TD>
              <TD style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: totalGeneral.urgentes > 0 ? '#dc2626' : '#94a3b8' }}>{totalGeneral.urgentes}</TD>
              <TD style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: totalGeneral.criticos > 0 ? '#ef4444' : '#94a3b8' }}>{totalGeneral.criticos}</TD>
              <TD></TD>
              <TD style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: totalGeneral.incumple > 0 ? '#dc2626' : '#16a34a' }}>{totalGeneral.incumple}</TD>
            </tr>
          </tfoot>
        </table>
      </div>

      <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 12 }}>
        Haz click en cualquier centro para ver su detalle.
      </p>
    </div>
  )
}
