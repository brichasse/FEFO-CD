import { useState, useMemo } from 'react'
import { pctVida, classifyPct, calcDiff, calcCumplimientoSemanal, getSemanaISO } from '../fefo.js'
import { TH, TD, EmptyState, StatCard } from '../components.jsx'

function semanaDe(fechaStr) {
  const [d, m, y] = fechaStr.split('/').map(Number)
  const date = new Date(y, m - 1, d)
  const target = new Date(date.valueOf())
  const dayNr = (date.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = target.valueOf()
  target.setMonth(0, 1)
  if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7)
  return 1 + Math.ceil((firstThursday - target) / 604800000)
}

export default function Resumen({ allData, filtraEstado, onSelectCd }) {
  const cds = Object.keys(allData)
  const [semanaSel, setSemanaSel] = useState(null) // null = última semana

  if (cds.length === 0) return <EmptyState icon="🏢" text="Sube una base para ver el resumen de centros." />

  const filtrar = filtraEstado || ((rows) => rows)

  // ── Tabla de inventario por centro (último snapshot) ──
  const filas = cds.map(cd => {
    const snaps = allData[cd] || []
    const latest = snaps[snaps.length - 1]
    const prev = snaps[snaps.length - 2]
    const rows = latest ? filtrar(latest.rows) : []

    const totCajas = rows.reduce((s, r) => s + r.cajas, 0)
    const skus = new Set(rows.map(r => r.sku)).size

    let urgentes = 0, criticos = 0, alertas = 0, cjUrgente = 0, cjCritico = 0
    for (const r of rows) {
      const c = classifyPct(pctVida(r), r.vidaUtil)
      if (c.nivel === 4) { urgentes++; cjUrgente += r.cajas }
      else if (c.nivel === 3) { criticos++; cjCritico += r.cajas }
      else if (c.nivel === 2) { alertas++ }
    }

    const diff = prev && latest ? calcDiff(filtrar(prev.rows), filtrar(latest.rows)) : null
    const incumple = diff ? diff.incumple.length : null

    return { cd, fecha: latest?.date, totCajas, skus, urgentes, criticos, alertas, cjUrgente, cjCritico, incumple }
  }).sort((a, b) => (b.urgentes + b.criticos) - (a.urgentes + a.criticos))

  const totalGeneral = filas.reduce((acc, f) => ({
    cajas: acc.cajas + f.totCajas,
    urgentes: acc.urgentes + f.urgentes,
    criticos: acc.criticos + f.criticos,
    incumple: acc.incumple + (f.incumple ?? 0),
  }), { cajas: 0, urgentes: 0, criticos: 0, incumple: 0 })

  // ── Cumplimiento FEFO semanal por centro ──
  const cumplimientoPorCd = useMemo(() => {
    const res = {}
    for (const cd of cds) {
      const snaps = (allData[cd] || []).map(s => ({ ...s, rows: filtrar(s.rows) }))
      res[cd] = calcCumplimientoSemanal(snaps)
    }
    return res
  }, [allData, filtraEstado])

  // Todas las semanas disponibles (unión de todos los centros)
  const semanasDisponibles = useMemo(() => {
    const set = new Set()
    for (const cd of cds) for (const s of (cumplimientoPorCd[cd] || [])) set.add(s.semana)
    return [...set].sort()
  }, [cumplimientoPorCd])

  const semanaActiva = semanaSel || semanasDisponibles[semanasDisponibles.length - 1]

  // Datos de cumplimiento de la semana activa por centro
  const cumplimientoSemana = cds.map(cd => {
    const serie = cumplimientoPorCd[cd] || []
    const idx = serie.findIndex(s => s.semana === semanaActiva)
    const actual = idx >= 0 ? serie[idx] : null
    const anterior = idx > 0 ? serie[idx - 1] : null
    return { cd, actual, anterior }
  })

  // Totales de cumplimiento (ponderado por cajas) de la semana activa
  const totCumpl = cumplimientoSemana.reduce((acc, c) => {
    if (c.actual) {
      acc.ok += c.actual.cajasOK
      acc.desp += c.actual.cajasDespachadas
      acc.okTodo += c.actual.cajasOKTodo
      acc.todo += c.actual.cajasTodo
      acc.nIncumple += c.actual.nIncumple
      acc.nAbast += c.actual.nAbastecimiento
    }
    return acc
  }, { ok: 0, desp: 0, okTodo: 0, todo: 0, nIncumple: 0, nAbast: 0 })
  const pctTotal     = totCumpl.desp > 0 ? totCumpl.ok / totCumpl.desp * 100 : null
  const pctTotalTodo = totCumpl.todo > 0 ? totCumpl.okTodo / totCumpl.todo * 100 : null

  const colorPct = (p) => p == null ? '#94a3b8' : p >= 98 ? '#16a34a' : p >= 95 ? '#d97706' : '#dc2626'

  return (
    <div>
      {/* ── CUMPLIMIENTO FEFO SEMANAL ── */}
      {semanasDisponibles.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
              📊 Cumplimiento FEFO semanal <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 11 }}>· por volumen despachado</span>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {semanasDisponibles.map(sem => {
                const isSel = sem === semanaActiva
                const registro = Object.values(cumplimientoPorCd).flat().find(x => x.semana === sem)
                const base = registro?.fechaRepPrev
                const numSemana = base ? semanaDe(base) : parseInt(sem.split('-W')[1]) - 1
                return (
                  <button key={sem} onClick={() => setSemanaSel(sem)}
                    style={{ background: isSel ? '#0369a1' : '#f1f5f9', color: isSel ? 'white' : '#475569', border: '1px solid ' + (isSel ? '#0369a1' : '#e2e8f0'), borderRadius: 6, padding: '3px 10px', fontSize: 11, fontFamily: "'DM Mono', monospace", fontWeight: isSel ? 600 : 400, cursor: 'pointer', lineHeight: 1.3 }}>
                    S{numSemana} · base {base}
                    {base && (
                      <span style={{ display: 'block', fontSize: 9, opacity: 0.7 }}>
                        {base.slice(0,5)} → {registro.fechaRep.slice(0,5)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* KPI titular */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'DM Mono', monospace" }}>Sobre total despachado</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: colorPct(pctTotalTodo), fontFamily: "'DM Mono', monospace" }}>
                {pctTotalTodo != null ? `${pctTotalTodo.toFixed(1)}%` : '—'}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>incluye SKU de un solo lote</div>
            </div>
            <StatCard label="Incumplimientos" value={totCumpl.nIncumple} color={totCumpl.nIncumple > 0 ? '#dc2626' : '#16a34a'} sub="eventos SKU" />
            <StatCard label="Abastecimiento" value={totCumpl.nAbast} color="#d97706" sub="registro aparte" />
          </div>

          {/* Detalle por centro */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH width="120px">Centro</TH>
                  <TH width="110px">Cumplimiento</TH>
                  <TH width="105px">% s/ total</TH>
                  <TH width="90px">vs sem. ant.</TH>
                  <TH width="130px">Cajas OK / desp.</TH>
                  <TH width="90px">Incumple</TH>
                  <TH width="90px">Cajas mal</TH>
                  <TH width="90px">Abastec.</TH>
                </tr>
              </thead>
              <tbody>
                {cumplimientoSemana.map(({ cd, actual, anterior }, i) => {
                  const p = actual?.pctCajas
                  const pAnt = anterior?.pctCajas
                  const delta = (p != null && pAnt != null) ? p - pAnt : null
                  return (
                    <tr key={cd} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                      <TD style={{ fontWeight: 600, color: '#0f172a' }}>{cd}</TD>
                      <TD style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: colorPct(p), fontSize: 14 }}>
                        {p != null ? `${p.toFixed(1)}%` : '—'}
                      </TD>
                      <TD style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, color: colorPct(actual?.pctCajasTodo) }}>
                        {actual?.pctCajasTodo != null ? `${actual.pctCajasTodo.toFixed(1)}%` : '—'}
                      </TD>
                      <TD style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: delta == null ? '#94a3b8' : delta >= 0 ? '#16a34a' : '#dc2626' }}>
                        {delta == null ? '—' : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}`}
                      </TD>
                      <TD style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                        {actual ? `${actual.cajasOK.toLocaleString()} / ${actual.cajasDespachadas.toLocaleString()}` : '—'}
                      </TD>
                      <TD style={{ fontFamily: "'DM Mono', monospace", color: actual?.nIncumple > 0 ? '#dc2626' : '#94a3b8', fontWeight: actual?.nIncumple > 0 ? 700 : 400 }}>
                        {actual?.nIncumple ?? '—'}
                      </TD>
                      <TD style={{ fontFamily: "'DM Mono', monospace", color: actual?.cajasIncumplidas > 0 ? '#dc2626' : '#94a3b8' }}>
                        {actual ? actual.cajasIncumplidas.toLocaleString() : '—'}
                      </TD>
                      <TD style={{ fontFamily: "'DM Mono', monospace", color: '#d97706' }}>
                        {actual?.nAbastecimiento ?? '—'}
                      </TD>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 8 }}>
            Comparación semanal punta a punta (lunes vs lunes). Movimientos intra-semana no se reflejan. El cumplimiento pondera por cajas despachadas de SKUs con FEFO aplicable.
          </p>
        </div>
      )}

      {/* ── TABLA DE INVENTARIO POR CENTRO ── */}
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>🏢 Inventario por centro</div>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
        Datos del último snapshot de cada centro
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
