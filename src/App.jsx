import { useState, useEffect, useCallback } from 'react'
import { parseCSV, aggregateRows, calcDiff, STORAGE_KEY } from './fefo.js'
import Dashboard from './tabs/Dashboard.jsx'
import Criticos  from './tabs/Criticos.jsx'
import FEFOTab   from './tabs/FEFO.jsx'
import Ingresos  from './tabs/Ingresos.jsx'
import Snapshots from './tabs/Snapshots.jsx'
import CDSelector from './tabs/CDSelector.jsx'
import Resumen from './tabs/Resumen.jsx'

const ANALYSIS_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'criticos',  labelFn: (snaps) => `Vida Útil (${snaps[snaps.length-1]?.rows.filter(r=>r.dias<60).length ?? 0})` },
  { id: 'fefo',      labelFn: (_, inc) => `FEFO${inc ? ` — ${inc.length} ❌` : ''}` },
  { id: 'ingresos',  labelFn: (_, __, diff) => `Ingresos${diff ? ` (${diff.nuevos.filter(r=>r.dias<90).length})` : ''}` },
  { id: 'snapshots', labelFn: (snaps) => `Snapshots (${snaps.length})` },
]

function loadStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (_) {}
  return {}
}
function saveStorage(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch (_) {}
}

export default function App() {
  const [allData,      setAllData]      = useState({})
  const [activeCd,     setActiveCd]     = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [tab,          setTab]          = useState('dashboard')
  const [busy,         setBusy]         = useState(false)
  const [toast,        setToast]        = useState(null)
  const [showCdSel,    setShowCdSel]    = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [estadosActivos, setEstadosActivos] = useState(null) // null = todos
  const [showEstados, setShowEstados] = useState(false)
  const [showDias, setShowDias] = useState(false)

  useEffect(() => {
    const data = loadStorage()
    setAllData(data)
    const cds = Object.keys(data)
    if (cds.length > 0) setActiveCd(cds[0])
    setLoading(false)
  }, [])

  // Al cambiar de CD, resetear selectedDate para apuntar al último snapshot
  useEffect(() => {
    setSelectedDate(null)
  }, [activeCd])

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const save = (data) => {
    setAllData(data)
    saveStorage(data)
  }

  const onFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || [])
    if (files.length === 0) return
    setBusy(true)

    // Ordenar archivos por fecha detectada en el nombre (más antiguo primero)
    const conFecha = files.map(file => {
      const m = file.name.match(/(\d{2})[_\-](\d{2})/)
      const date = m ? `${m[1]}/${m[2]}/2026` : null
      return { file, date, orden: date ? date.split('/').reverse().join('') : '0' }
    }).sort((a, b) => a.orden.localeCompare(b.orden))

    let newData = { ...allData }
    let procesados = 0, omitidos = 0
    let ultimaFecha = null, ultimoCd = null
    const errores = []

    for (const { file, date: dateFromName } of conFecha) {
      try {
        const text = await file.text()
        const porCD = parseCSV(text)
        const cdsEncontrados = Object.keys(porCD)
        if (cdsEncontrados.length === 0) { errores.push(`${file.name}: sin CD`); continue }

        const date = dateFromName || new Date().toLocaleDateString('es-CL')

        for (const cd of cdsEncontrados) {
          const rows = aggregateRows(porCD[cd])
          const current = newData[cd] || []

          if (current.some(s => s.date === date)) { omitidos++; continue }

          const prevFechas = {}
          for (const snap of current) {
            for (const r of snap.rows) {
              const k = `${r.sku}||${r.fv}`
              if (!prevFechas[k]) prevFechas[k] = r.fechaDeteccion ?? snap.date
            }
          }
          const rowsConFecha = rows.map(r => {
            const k = `${r.sku}||${r.fv}`
            return { ...r, fechaDeteccion: prevFechas[k] ?? date }
          })

          newData[cd] = [...current, { date, rows: rowsConFecha }].sort((a, b) =>
            a.date.split('/').reverse().join('').localeCompare(b.date.split('/').reverse().join(''))
          )
          procesados++
          ultimaFecha = date
          ultimoCd = cd
        }
      } catch (e) {
        console.error('Error procesando', file.name, e)
        errores.push(`${file.name}: ${e.message}`)
      }
    }

    save(newData)

    if (procesados > 0) {
      if (!activeCd || !newData[activeCd]) setActiveCd(ultimoCd)
      setSelectedDate(ultimaFecha)
      setTab('dashboard')
    }

    // Resumen del resultado
    const partes = []
    if (procesados > 0) partes.push(`${procesados} snapshot${procesados > 1 ? 's' : ''} cargado${procesados > 1 ? 's' : ''}`)
    if (omitidos > 0) partes.push(`${omitidos} ya existía${omitidos > 1 ? 'n' : ''}`)
    if (errores.length > 0) partes.push(`${errores.length} con error`)
    showToast(
      (procesados > 0 ? '✓ ' : '') + (partes.join(' · ') || 'Sin cambios'),
      procesados > 0 || omitidos > 0
    )

    setBusy(false)
  }, [allData, activeCd])

  const onDelete = (date) => {
    if (!activeCd) return
    const newSnaps = (allData[activeCd] || []).filter(s => s.date !== date)
    const newData = { ...allData, [activeCd]: newSnaps }
    if (newSnaps.length === 0) delete newData[activeCd]
    save(newData)
    if (!newData[activeCd]) setActiveCd(Object.keys(newData)[0] || null)
    if (selectedDate === date) setSelectedDate(null)
    showToast(`Snapshot ${date} eliminado.`)
  }

  const onDeleteCd = (cd) => {
    const newData = { ...allData }
    delete newData[cd]
    save(newData)
    if (activeCd === cd) setActiveCd(Object.keys(newData)[0] || null)
    showToast(`CD ${cd} eliminado.`)
  }

  // Snapshot seleccionado (por defecto el último)
  const snapshotsRaw = activeCd ? (allData[activeCd] || []) : []

  // Perfiles de antigüedad sin control de vencimiento
  const PERFILES_SIN_CONTROL = [600, 999, 1100, 9999]
  const esSinControl = (r) => r.vidaUtil != null && PERFILES_SIN_CONTROL.includes(r.vidaUtil)

  // Categoría de cada fila para el filtro: "Sin control" si aplica, si no su estado real
  const categoriaEstado = (r) => esSinControl(r) ? 'Sin control' : (r.estado || 'Sin estado')

  // Todas las categorías presentes en el CD (o en todos si estamos en resumen)
  const estadosDisponibles = [...new Set(
    (tab === 'resumen'
      ? Object.values(allData).flat().flatMap(s => s.rows.map(categoriaEstado))
      : snapshotsRaw.flatMap(s => s.rows.map(categoriaEstado))
    )
  )].sort()

  // Filtrar filas por categoría activa (null = todas)
  const filtraEstado = (rows) =>
    estadosActivos === null ? rows : rows.filter(r => estadosActivos.includes(categoriaEstado(r)))

  const snapshots  = snapshotsRaw.map(s => ({ ...s, rows: filtraEstado(s.rows) }))
  const latestIdx  = selectedDate
    ? snapshots.findIndex(s => s.date === selectedDate)
    : snapshots.length - 1
  const latest     = snapshots[latestIdx] ?? null
  const prev       = latestIdx > 0 ? snapshots[latestIdx - 1] : null
  const diff       = prev && latest ? calcDiff(prev.rows, latest.rows) : null
  const incumples  = diff ? diff.incumple.sort((a, b) => a.dias_ant - b.dias_ant) : null
  const cds        = Object.keys(allData)

  const tabLabel = (t) => t.labelFn ? t.labelFn(snapshots, incumples, diff) : t.label

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#64748b', fontSize: 14 }}>
        Cargando…
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>

      {/* ── HEADER ── */}
      <header style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: '#0f172a', color: 'white', borderRadius: 8, padding: '5px 10px', fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, letterSpacing: 1 }}>
            FEFO
          </div>

          {cds.length === 0 ? (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>Panel FEFO</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Sin datos — sube tu primer CSV</div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setTab('resumen')}
                style={{ background: tab === 'resumen' ? '#0369a1' : '#f1f5f9', color: tab === 'resumen' ? 'white' : '#475569', border: '1px solid ' + (tab === 'resumen' ? '#0369a1' : '#e2e8f0'), borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s' }}>
                🏢 Resumen
              </button>
              <span style={{ width: 1, height: 20, background: '#e2e8f0', margin: '0 2px' }} />
              {cds.map(cd => (
                <button key={cd} onClick={() => { setActiveCd(cd); setTab('dashboard') }}
                  style={{ background: cd === activeCd && tab !== 'resumen' ? '#0f172a' : '#f1f5f9', color: cd === activeCd && tab !== 'resumen' ? 'white' : '#475569', border: '1px solid ' + (cd === activeCd && tab !== 'resumen' ? '#0f172a' : '#e2e8f0'), borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: cd === activeCd ? 600 : 400, cursor: 'pointer', transition: 'all .15s' }}>
                  {cd}
                </button>
              ))}
              <button onClick={() => setShowCdSel(true)}
                title="Gestionar CDs"
                style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 20, padding: '4px 10px', fontSize: 11, color: '#94a3b8', cursor: 'pointer' }}>
                ···
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {activeCd && latest && (
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              {snapshots.length} snapshot{snapshots.length > 1 ? 's' : ''} · último: {snapshots[snapshots.length - 1]?.date}
            </span>
          )}
          <label style={{ cursor: busy ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, background: busy ? '#e2e8f0' : '#0f172a', color: busy ? '#64748b' : 'white', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 500, transition: 'background .15s' }}>
            <input type="file" accept=".csv" multiple style={{ display: 'none' }} onChange={e => { onFiles(e.target.files); e.target.value = '' }} disabled={busy} />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {busy ? 'Procesando…' : 'Subir CSV'}
          </label>
        </div>
      </header>

      {/* ── SELECTOR DE SNAPSHOT + TABS ── */}
      {activeCd && (
        <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0' }}>
          {/* Selector de día */}
          {snapshots.length > 1 && (
            <div style={{ padding: '8px 24px 0', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>Viendo:</span>

              {/* Dropdown de días */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button onClick={() => setShowDias(v => !v)}
                  style={{ background: '#0f172a', color: 'white', border: '1px solid #0f172a', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontFamily: "'DM Mono', monospace", fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {latest?.date}
                  {latestIdx === snapshots.length - 1 && (
                    <span style={{ fontSize: 9, background: 'rgba(255,255,255,0.25)', color: 'white', borderRadius: 3, padding: '1px 4px' }}>último</span>
                  )}
                  <span style={{ fontSize: 9 }}>▼</span>
                </button>
                {showDias && (
                  <>
                    <div onClick={() => setShowDias(false)} style={{ position: 'fixed', inset: 0, zIndex: 25 }} />
                    <div style={{ position: 'absolute', top: '110%', left: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 30, padding: 4, minWidth: 150, maxHeight: 280, overflowY: 'auto' }}>
                      {[...snapshots].reverse().map((s, ri) => {
                        const isSelected = latest?.date === s.date
                        const isLast = ri === 0
                        return (
                          <button key={s.date} onClick={() => { setSelectedDate(s.date); setShowDias(false) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', background: isSelected ? '#f0f9ff' : 'transparent', color: isSelected ? '#0369a1' : '#1e293b', border: 'none', borderRadius: 4, padding: '6px 10px', fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: isSelected ? 600 : 400, cursor: 'pointer' }}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc' }}
                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}>
                            {s.date}
                            {isLast && <span style={{ fontSize: 9, background: '#e2e8f0', color: '#94a3b8', borderRadius: 3, padding: '1px 4px' }}>último</span>}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>

              {prev && (
                <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4, flexShrink: 0 }}>
                  vs {prev.date}
                </span>
              )}

              {/* Selector de Estado */}
              <div style={{ position: 'relative', marginLeft: 'auto' }}>
                <button onClick={() => setShowEstados(v => !v)}
                  style={{ background: estadosActivos === null ? '#f1f5f9' : '#0f172a', color: estadosActivos === null ? '#475569' : 'white', border: '1px solid ' + (estadosActivos === null ? '#e2e8f0' : '#0f172a'), borderRadius: 6, padding: '3px 12px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  Estado{estadosActivos !== null ? ` · ${estadosActivos.length}` : ''}
                  <span style={{ fontSize: 9 }}>▼</span>
                </button>
                {showEstados && (
                  <>
                    <div onClick={() => setShowEstados(false)} style={{ position: 'fixed', inset: 0, zIndex: 25 }} />
                    <div style={{ position: 'absolute', top: '110%', right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 30, padding: 8, minWidth: 180 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', marginBottom: 4, borderBottom: '1px solid #f1f5f9' }}>
                        <button onClick={() => setEstadosActivos(null)}
                          style={{ background: 'none', border: 'none', color: '#0369a1', fontSize: 11, cursor: 'pointer', padding: 0 }}>
                          Todos
                        </button>
                        <button onClick={() => setEstadosActivos([])}
                          style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 11, cursor: 'pointer', padding: 0 }}>
                          Ninguno
                        </button>
                      </div>
                      {estadosDisponibles.map(est => {
                        const activo = estadosActivos === null || estadosActivos.includes(est)
                        return (
                          <label key={est} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', fontSize: 12, cursor: 'pointer', borderRadius: 4 }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <input type="checkbox" checked={activo}
                              onChange={() => {
                                const base = estadosActivos === null ? estadosDisponibles : estadosActivos
                                if (activo) setEstadosActivos(base.filter(x => x !== est))
                                else setEstadosActivos([...base, est])
                              }}
                            />
                            <span style={{ color: '#1e293b' }}>{est}</span>
                          </label>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          {/* Tabs */}
          <nav style={{ padding: '0 24px', display: 'flex', overflowX: 'auto' }}>
            {ANALYSIS_TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ background: 'none', border: 'none', borderBottom: tab === t.id ? '2px solid #0f172a' : '2px solid transparent', padding: '12px 16px', fontSize: 12, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? '#0f172a' : '#64748b', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color .1s' }}>
                {tabLabel(t)}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* ── CONTENT ── */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px' }}>
        {tab === 'resumen' ? (
          <Resumen
            allData={allData}
            filtraEstado={filtraEstado}
            onSelectCd={(cd) => { setActiveCd(cd); setSelectedDate(null); setTab('dashboard') }}
          />
        ) : !activeCd ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94a3b8' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📦</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: '#64748b', marginBottom: 8 }}>Sin datos aún</div>
            <div style={{ fontSize: 13 }}>Sube uno o varios CSV — los centros se detectan automáticamente desde el archivo</div>
          </div>
        ) : (
          <>
            {tab === 'dashboard' && <Dashboard snapshots={snapshots} latest={latest} prev={prev} diff={diff} incumples={incumples ?? []} cdName={activeCd} />}
            {tab === 'criticos'  && <Criticos  latest={latest} />}
            {tab === 'fefo'      && <FEFOTab   diff={diff} prev={prev} latest={latest} />}
            {tab === 'ingresos'  && <Ingresos  diff={diff} prev={prev} latest={latest} snapshots={snapshots} />}
            {tab === 'snapshots' && <Snapshots snapshots={snapshots} onDelete={onDelete} />}
          </>
        )}
      </main>

      {/* ── CD MANAGER MODAL ── */}
      {showCdSel && (
        <CDSelector
          cds={cds}
          activeCd={activeCd}
          allData={allData}
          onSelect={(cd) => { setActiveCd(cd); setTab('dashboard'); setShowCdSel(false) }}
          onDelete={onDeleteCd}
          onClose={() => setShowCdSel(false)}
        />
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, background: toast.ok ? '#0f172a' : '#dc2626', color: 'white', borderRadius: 10, padding: '12px 18px', fontSize: 13, fontWeight: 500, maxWidth: 340, zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', animation: 'slideUp .2s ease' }}>
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        button:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
        ::-webkit-scrollbar { height: 5px; width: 5px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
      `}</style>
    </div>
  )
}
