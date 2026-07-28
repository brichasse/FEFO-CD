import { useState, useMemo } from 'react'
import { pctVida, classifyPct, calcDiff, calcCumplimientoSemanal, getSemanaISO, cumplimientoFrescura } from '../fefo.js'
import { TH, TD, EmptyState, StatCard } from '../components.jsx'

function semanaDe(fechaStr) {
  const [d, m, y] = fechaStr.split('/').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dayNr = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNr + 3)   // jueves de esa semana
  const jueves = date.valueOf()
  const ene1 = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return 1 + Math.round(((jueves - ene1) / 86400000 - 3 + ((ene1.getUTCDay() + 6) % 7)) / 7)
}

export default function Resumen({ allData, filtraEstado, onSelectCd }) {
  const cds = Object.keys(allData)
  const [semanaSel, setSemanaSel] = useState(null) // null = última semana

  const filtrar = filtraEstado || ((rows) => rows)

  // ── Cumplimiento FEFO semanal por centro ──
  const cumplimientoPorCd = useMemo(() => {
    const res = {}
    for (const cd of cds) {
      const snaps = (allData[cd] || []).map(s => ({ ...s, rows: filtrar(s.rows) }))
      res[cd] = calcCumplimientoSemanal(snaps)
    }
    return res
  }, [allData, filtraEstado])

  const semanasDisponibles = useMemo(() => {
    const set = new Set()
    for (const cd of cds) for (const s of (cumplimientoPorCd[cd] || [])) set.add(s.semana)
    return [...set].sort()
  }, [cumplimientoPorCd])

  if (cds.length === 0) return <EmptyState icon="🏢" text="Sube una base para ver el resumen de centros." />

  const semanaActiva = semanaSel || semanasDisponibles[semanasDisponibles.length - 1]

  const cumplimientoSemana = cds.map(cd => {
    const serie = cumplimientoPorCd[cd] || []
    const idx = serie.findIndex(s => s.semana === semanaActiva)
    const actual = idx >= 0 ? serie[idx] : null
    const anterior = idx > 0 ? serie[idx - 1] : null
    return { cd, actual, anterior }
  })

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

  // ── Criticidad de frescura por centro ──
  const filasFrescura = cds.map(cd => {
    const snaps = allData[cd] || []
    const latest = snaps[snaps.length - 1]
    const rows = latest ? filtrar(latest.rows) : []
    const f = cumplimientoFrescura(rows)
    return { cd, fecha: latest?.date, ...f }
  }).sort((a, b) => (a.pct ?? 999) - (b.pct ?? 999))

  const totF = filasFrescura.reduce((acc, f) => {
    acc.total += f.total
    acc.cumple += f.cumple
    for (const k of Object.keys(f.porNivel)) acc.porNivel[k] = (acc.porNivel[k] ?? 0) + f.porNivel[k]
    return acc
  }, { total: 0, cumple: 0, porNivel: {} })
  const pctFrescuraTotal = totF.total > 0 ? totF.cumple / totF.total * 100 : null

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
                    Semana {numSemana}
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
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'DM Mono', monospace" }}>Cumplimiento FEFO</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: colorPct(pctTotal), fontFamily: "'DM Mono', monospace" }}>
                {pctTotal != null ? `${pctTotal.toFixed(1)}%` : '—'}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>solo SKU multi-lote</div>
            </div>
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
            Comparación semanal punta a punta (lunes vs lunes). Movimientos intra-semana no se reflejan. La vista diaria aplica un criterio más estricto y detecta casos que a nivel semanal se resuelven correctamente.
          </p>
        </div>
      )}

      {/* ── CRITICIDAD DE FRESCURA POR CENTRO ── */}
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
        Criticidad de frescura por centro
      </div>
      <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
        Cumplimiento = cajas sobre 66% de vida util restante (dentro del primer tercio consumido)
      </p>

      {/* KPIs globales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'DM Mono', monospace" }}>Cumplimiento global</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: colorPct(pctFrescuraTotal), fontFamily: "'DM Mono', monospace" }}>
            {pctFrescuraTotal != null ? `${pctFrescuraTotal.toFixed(1)}%` : '—'}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{totF.total.toLocaleString()} cajas</div>
        </div>
        <StatCard label="Sano >66%"      value={(totF.porNivel['Sano'] ?? 0).toLocaleString()}    color="#16a34a" />
        <StatCard label="Alerta 50–66%"  value={(totF.porNivel['Alerta'] ?? 0).toLocaleString()}  color="#d97706" />
        <StatCard label="Crítico 30–50%" value={(totF.porNivel['Crítico'] ?? 0).toLocaleString()} color="#ef4444" />
        <StatCard label="Urgente <30%"   value={(totF.porNivel['Urgente'] ?? 0).toLocaleString()} color="#dc2626" />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <TH width="110px">Centro</TH>
              <TH width="80px">Fecha</TH>
              <TH width="110px">Cumplimiento</TH>
              <TH width="95px">Total cajas</TH>
              <TH width="105px">Sano &gt;66%</TH>
              <TH width="105px">Alerta 50–66%</TH>
              <TH width="105px">Crítico 30–50%</TH>
              <TH width="105px">Urgente &lt;30%</TH>
            </tr>
          </thead>
          <tbody>
            {filasFrescura.map((f, i) => {
              const cel = (n, color) => {
                const v = f.porNivel[n] ?? 0
                return (
                  <TD style={{ fontFamily: "'DM Mono', monospace", color: v > 0 ? color : '#cbd5e1' }}>
                    <div style={{ fontWeight: v > 0 ? 600 : 400 }}>{v.toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>{f.total > 0 ? `${(v / f.total * 100).toFixed(1)}%` : '—'}</div>
                  </TD>
                )
              }
              return (
                <tr key={f.cd}
                  onClick={() => onSelectCd(f.cd)}
                  style={{ background: i % 2 === 0 ? 'white' : '#fafafa', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fafafa'}>
                  <TD style={{ fontWeight: 600, color: '#0f172a' }}>{f.cd}</TD>
                  <TD style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#64748b' }}>{f.fecha ?? '—'}</TD>
                  <TD style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 15, color: colorPct(f.pct) }}>
                    {f.pct != null ? `${f.pct.toFixed(1)}%` : '—'}
                  </TD>
                  <TD style={{ fontFamily: "'DM Mono', monospace" }}>{f.total.toLocaleString()}</TD>
                  {cel('Sano', '#16a34a')}
                  {cel('Alerta', '#d97706')}
                  {cel('Crítico', '#ef4444')}
                  {cel('Urgente', '#dc2626')}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
              <TD style={{ fontWeight: 700 }}>TOTAL</TD>
              <TD></TD>
              <TD style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 15, color: colorPct(pctFrescuraTotal) }}>
                {pctFrescuraTotal != null ? `${pctFrescuraTotal.toFixed(1)}%` : '—'}
              </TD>
              <TD style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{totF.total.toLocaleString()}</TD>
              {['Sano','Alerta','Crítico','Urgente'].map(n => (
                <TD key={n} style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>
                  {(totF.porNivel[n] ?? 0).toLocaleString()}
                </TD>
              ))}
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
