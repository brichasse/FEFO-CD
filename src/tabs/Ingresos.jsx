import { useState, useMemo } from 'react'
import { pctVida, classifyPct } from '../fefo.js'
import { VidaBadge, AreaPill, StatCard, TH, TD, EmptyState } from '../components.jsx'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

// Convierte "DD/MM/YYYY" en número comparable YYYYMMDD
const ord = (fecha) => fecha ? fecha.split('/').reverse().join('') : '0'

export default function Ingresos({ snapshots = [] }) {
  const [skuFiltro,       setSkuFiltro]       = useState('')
  const [skuSeleccionado, setSkuSeleccionado] = useState(null)
  const [desde, setDesde] = useState(null)  // null = primer snapshot
  const [hasta, setHasta] = useState(null)  // null = último snapshot

  if (snapshots.length < 2) return <EmptyState icon="📊" text="Se necesitan al menos 2 snapshots para ver ingresos." />

  // Fechas disponibles ordenadas cronológicamente
  const fechasDisp = snapshots.map(s => s.date)
  const desdeReal = desde ?? fechasDisp[0]
  const hastaReal = hasta ?? fechasDisp[fechasDisp.length - 1]

  // Snapshots dentro del rango (para el gráfico y para detectar ingresos)
  const enRango = (fecha) => ord(fecha) >= ord(desdeReal) && ord(fecha) <= ord(hastaReal)

  // ── Detectar todos los ingresos dentro del rango ──
  // Un ingreso = lote (sku+fv) que aparece por primera vez respecto al snapshot anterior
  const ingresos = useMemo(() => {
    const res = []
    for (let i = 1; i < snapshots.length; i++) {
      const curr = snapshots[i]
      if (!enRango(curr.date)) continue
      const prevSnap = snapshots[i - 1]
      const prevKeys = new Set(prevSnap.rows.map(r => `${r.sku}||${r.fv}`))
      // Agrupar los nuevos por sku+fv para no duplicar por área
      const nuevosMap = {}
      for (const r of curr.rows) {
        const k = `${r.sku}||${r.fv}`
        if (prevKeys.has(k)) continue
        if (!nuevosMap[k]) nuevosMap[k] = { ...r, cajas: 0, areas: new Set() }
        nuevosMap[k].cajas += r.cajas
        nuevosMap[k].areas.add(r.area)
      }
      for (const v of Object.values(nuevosMap)) {
        res.push({ ...v, fechaIngreso: curr.date, areas: [...v.areas] })
      }
    }
    // Ordenar por fecha de ingreso (más reciente primero), luego por menor vida útil
    return res.sort((a, b) => {
      if (ord(b.fechaIngreso) !== ord(a.fechaIngreso)) return ord(b.fechaIngreso) - ord(a.fechaIngreso) > 0 ? 1 : -1
      const pa = pctVida(a) ?? 999, pb = pctVida(b) ?? 999
      return pa - pb
    })
  }, [snapshots, desdeReal, hastaReal])

  const totalCajas = ingresos.reduce((s, r) => s + r.cajas, 0)
  const urgentes = ingresos.filter(r => { const c = classifyPct(pctVida(r), r.vidaUtil); return c.nivel === 4 }).length
  const criticos = ingresos.filter(r => { const c = classifyPct(pctVida(r), r.vidaUtil); return c.nivel === 3 }).length

  // ── Todos los SKUs para el autocomplete ──
  const todosSkus = useMemo(() => {
    const map = {}
    for (const snap of snapshots)
      for (const r of snap.rows)
        if (!map[r.sku]) map[r.sku] = r.desc
    return Object.entries(map).map(([sku, desc]) => ({ sku, desc })).sort((a, b) => a.sku.localeCompare(b.sku))
  }, [snapshots])

  const sugerencias = skuFiltro.length >= 2 && !skuSeleccionado
    ? todosSkus.filter(s =>
        s.sku.toLowerCase().includes(skuFiltro.toLowerCase()) ||
        s.desc.toLowerCase().includes(skuFiltro.toLowerCase())
      ).slice(0, 8)
    : []

  // ── Datos del gráfico (acotado al rango) ──
  const snapsRango = snapshots.filter(s => enRango(s.date))

  const datosGrafico = useMemo(() => {
    if (skuSeleccionado) {
      // Modo SKU: una línea por lote (fv), cajas en el tiempo
      const lotes = {}
      for (const snap of snapsRango) {
        for (const r of snap.rows) {
          if (r.sku !== skuSeleccionado) continue
          const loteKey = r.fv
          if (!lotes[loteKey]) lotes[loteKey] = { fechaDeteccion: r.fechaDeteccion ?? snap.date }
          lotes[loteKey][snap.date] = (lotes[loteKey][snap.date] ?? 0) + r.cajas
        }
      }
      const fechas = snapsRango.map(s => s.date)
      const series = Object.keys(lotes)
      const rows   = fechas.map(fecha => {
        const row = { fecha }
        for (const lote of series) row[lote] = lotes[lote][fecha] ?? null
        return row
      })
      return { tipo: 'sku', fechas, lotes, series, rows }
    } else {
      // Modo general: cajas ingresadas por fecha, apiladas por nivel de vida útil
      const rows = []
      for (let i = 1; i < snapshots.length; i++) {
        const curr = snapshots[i]
        if (!enRango(curr.date)) continue
        const prevSnap = snapshots[i - 1]
        const prevKeys = new Set(prevSnap.rows.map(r => `${r.sku}||${r.fv}`))
        const nuevos = curr.rows.filter(r => !prevKeys.has(`${r.sku}||${r.fv}`))
        let urg = 0, cri = 0, ale = 0, san = 0
        for (const r of nuevos) {
          const c = classifyPct(pctVida(r), r.vidaUtil)
          if (c.nivel === 4) urg += r.cajas
          else if (c.nivel === 3) cri += r.cajas
          else if (c.nivel === 2) ale += r.cajas
          else san += r.cajas
        }
        rows.push({ fecha: curr.date, 'Urgente <30%': urg, 'Crítico 30–50%': cri, 'Alerta 50–66%': ale, 'Sano >66%': san })
      }
      return { tipo: 'general', rows }
    }
  }, [snapshots, skuSeleccionado, desdeReal, hastaReal])

  const COLORES = ['#3b82f6','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#84cc16']

  const limpiarFiltro = () => { setSkuSeleccionado(null); setSkuFiltro('') }

  // Dropdown de fecha reutilizable
  const SelectorFecha = ({ valor, onChange, label }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
      {label}
      <select value={valor} onChange={e => onChange(e.target.value)}
        style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px', fontSize: 12, fontFamily: "'DM Mono', monospace", color: '#0f172a', cursor: 'pointer' }}>
        {fechasDisp.map(f => <option key={f} value={f}>{f}</option>)}
      </select>
    </label>
  )

  return (
    <div>
      {/* ── FILTRO DE RANGO ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>Rango de ingresos:</span>
        <SelectorFecha valor={desdeReal} onChange={setDesde} label="Desde" />
        <SelectorFecha valor={hastaReal} onChange={setHasta} label="Hasta" />
        <button onClick={() => { setDesde(null); setHasta(null) }}
          style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#64748b', cursor: 'pointer' }}>
          Todo el historial
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
        <StatCard label="Cajas ingresadas" value={totalCajas.toLocaleString()} sub={`${ingresos.length} lotes`} />
        <StatCard label="Urgentes <30%"  value={urgentes} color="#dc2626" />
        <StatCard label="Críticos <50%"  value={criticos} color="#ef4444" />
      </div>

      {/* ── GRÁFICO ── */}
      {snapsRango.length >= 1 && (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
              {skuSeleccionado
                ? `📦 ${skuSeleccionado} — ${todosSkus.find(s => s.sku === skuSeleccionado)?.desc ?? ''}`
                : '📈 Cajas ingresadas por día · color según vida útil al ingresar'}
            </div>
            <div style={{ position: 'relative' }}>
              <input
                value={skuFiltro}
                onChange={e => { setSkuFiltro(e.target.value); if (!e.target.value) setSkuSeleccionado(null) }}
                placeholder="Filtrar por SKU o descripción…"
                style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 32px 6px 12px', fontSize: 12, width: 270, outline: 'none', fontFamily: 'inherit', color: '#0f172a' }}
              />
              {(skuFiltro || skuSeleccionado) && (
                <button onClick={limpiarFiltro}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14, lineHeight: 1, padding: 0 }}>
                  ✕
                </button>
              )}
              {sugerencias.length > 0 && (
                <div style={{ position: 'absolute', top: '110%', left: 0, right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 20, overflow: 'hidden' }}>
                  {sugerencias.map(s => (
                    <div key={s.sku}
                      onClick={() => { setSkuSeleccionado(s.sku); setSkuFiltro(s.sku) }}
                      style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                      <span style={{ fontFamily: "'DM Mono', monospace", color: '#0369a1', fontSize: 11, flexShrink: 0 }}>{s.sku}</span>
                      <span style={{ color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.desc}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Gráfico general — barras apiladas por vida útil */}
          {datosGrafico.tipo === 'general' && (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={datosGrafico.rows} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(v, name) => [v.toLocaleString() + ' cj', name]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Urgente <30%"   stackId="a" fill="#dc2626" />
                <Bar dataKey="Crítico 30–50%" stackId="a" fill="#ef4444" />
                <Bar dataKey="Alerta 50–66%"  stackId="a" fill="#f59e0b" />
                <Bar dataKey="Sano >66%"      stackId="a" fill="#16a34a" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* Gráfico SKU — área por lote */}
          {datosGrafico.tipo === 'sku' && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {datosGrafico.series.map((lote, i) => (
                  <div key={lote} style={{ fontSize: 11, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 10px', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORES[i % COLORES.length], display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ color: '#0f172a', fontFamily: "'DM Mono', monospace" }}>vence {lote}</span>
                    <span style={{ color: '#94a3b8' }}>· ingresó {datosGrafico.lotes[lote].fechaDeteccion}</span>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={datosGrafico.rows} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    formatter={(v, name) => [v != null ? v.toLocaleString() + ' cj' : '—', `vence ${name}`]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={name => `vence ${name}`} />
                  {datosGrafico.series.map((lote, i) => (
                    <Area key={lote} type="monotone" dataKey={lote}
                      stroke={COLORES[i % COLORES.length]}
                      fill={COLORES[i % COLORES.length] + '22'}
                      strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      )}

      {/* ── TABLA ── */}
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
        Ingresos detectados entre <strong>{desdeReal}</strong> y <strong>{hastaReal}</strong> · {ingresos.length} lotes
      </div>
      {ingresos.length === 0 ? (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 20, textAlign: 'center', color: '#16a34a', fontWeight: 500 }}>
          ✅ Sin ingresos en el rango seleccionado
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <TH width="105px">SKU</TH>
                <TH width="190px">Descripción</TH>
                <TH width="95px">Ingresó</TH>
                <TH width="70px">Cajas</TH>
                <TH width="90px">Vence</TH>
                <TH width="60px">% Vida</TH>
                <TH width="170px">Área</TH>
                <TH width="115px">Frescura</TH>
              </tr>
            </thead>
            <tbody>
              {ingresos.map((r, i) => {
                const pct = pctVida(r)
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <TD style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: 'pointer', color: '#0369a1', textDecoration: 'underline' }}
                      onClick={() => { setSkuSeleccionado(r.sku); setSkuFiltro(r.sku) }}>
                      {r.sku}
                    </TD>
                    <TD>{r.desc}</TD>
                    <TD style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#0369a1', fontWeight: 600 }}>{r.fechaIngreso}</TD>
                    <TD style={{ fontFamily: "'DM Mono', monospace" }}>{r.cajas.toLocaleString()}</TD>
                    <TD style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{r.fv}</TD>
                    <TD style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{pct != null ? `${Math.round(pct)}%` : '—'}</TD>
                    <TD>{r.areas.map(a => <AreaPill key={a} area={a} />)}</TD>
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
