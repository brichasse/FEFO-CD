import { useState, useEffect, useCallback } from 'react'
import { parseCSV, aggregateRows, calcDiff, STORAGE_KEY } from './fefo.js'
import Dashboard from './tabs/Dashboard.jsx'
import Criticos  from './tabs/Criticos.jsx'
import FEFOTab   from './tabs/FEFO.jsx'
import Ingresos  from './tabs/Ingresos.jsx'
import Snapshots from './tabs/Snapshots.jsx'
import CDSelector from './tabs/CDSelector.jsx'

const ANALYSIS_TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'criticos',  labelFn: (snaps) => `Críticos (${snaps[snaps.length-1]?.rows.filter(r=>r.dias<60).length ?? 0})` },
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
  const [selectedDate, setSelectedDate] = useState(null) // snapshot seleccionado

  useEffect(() => {
    const data = loadStorage()
    setAllData(data)
    const cds = Object.keys(data)
    if (cds.length > 0) setActiveCd(cds[0])
    setLoading(false)
  }, [])

  // Al cambiar de CD, resetear selectedDate para que apunte al último snapshot
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

  const onFile = useCallback(async (file) => {
    if (!file) return
    setBusy(true)
    try {
      const text = await file.text()
      const { rows: rawRows, cd } = parseCSV(text)
      if (!rawRows.length || !cd) {
        showToast('No se detectó CD válido en el archivo.', false)
        setBusy(false)
        return
      }
      const rows = aggregateRows(rawRows)
      const m = file.name.match(/(\d{2})[_\-](\d{2})/)
      const date = m ? `${m[1]}/${m[2]}/2026` : new Date().toLocaleDateString('es-CL')

      const current = allData[cd] || []
      if (current.some(s => s.date === date)) {
        showToast(`Ya existe snapshot del ${date} para ${cd}.`, false)
        setBusy(false)
        return
      }

      // Construir mapa de fechaDeteccion con clave estable sku+fv+area (dias cambia cada día)
      const prevFechas = {}
      for (const snap of current) {
        for (const r of snap.rows) {
          const k = `${r.sku}||${r.fv}||${r.area}`
          if (!prevFechas[k]) prevFechas[k] = r.fechaDeteccion ?? snap.date
        }
      }
      const rowsConFecha = rows.map(r => {
        const k = `${r.sku}||${r.fv}||${r.area}`
        return { ...r, fechaDeteccion: prevFechas[k] ?? date }
      })

      const newSnaps = [...current, { date, rows: rowsConFecha }].sort((a, b) =>
        a.date.split('/').reverse().join('').localeCompare(b.date.split('/').reverse().join(''))
      )
      const newData = { ...allData, [cd]: newSnaps }
      save(newData)
      setActiveCd(cd)
      setSelectedDate(date)
      setTab('dashboard')
      showToast(`✓ ${cd} · ${date} cargado — ${rows.length.toLocaleString()} registros`)
    } catch (e) {
      showToast('Error al leer el archivo.', false)
    }
    setBusy(false)
  }, [allData])

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
  const snapshots = activeCd ? (allData[activeCd] || []) : []
  const latestIdx = selectedDate
    ? snapshots.findIndex(s => s.date === selectedDate)
    : snapshots.length - 1
  const latest    = snapshots[latestIdx] ?? null
  const prev      = latestIdx > 0 ? snapshots[latestIdx - 1] : null
  const diff      = prev && latest ? calcDiff(prev.rows, latest.rows) : null
  const incumples = diff ? diff.incumple.sort((a, b) => a.dias_ant - b.dias_ant) : null
  const cds       = Object.keys(allData)

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
              {cds.map(cd => (
                <button key={cd} onClick={() => { setActiveCd(cd); setTab('dashboard') }}
                  style={{ background: cd === activeCd ? '#0f172a' : '#f1f5f9', color: cd === activeCd ? 'white' : '#475569', border: '1px solid ' + (cd === activeCd ? '#0f172a' : '#e2e8f0'), borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: cd === activeCd ? 600 : 400, cursor: 'pointer', transition: 'all .15s' }}>
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
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={e => onFile(e.target.files[0])} disabled={busy} />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {busy ? 'Procesando…' : 'Subir CSV del día'}
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
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {snapshots.map((s, i) => {
                  const isSelected = latest?.date === s.date
                  const isLast = i === snapshots.length - 1
                  return (
                    <button key={s.date} onClick={() => setSelectedDate(s.date)}
                      style={{
                        background: isSelected ? '#0f172a' : '#f1f5f9',
                        color: isSelected ? 'white' : '#475569',
                        border: '1px solid ' + (isSelected ? '#0f172a' : '#e2e8f0'),
                        borderRadius: 6,
                        padding: '3px 10px',
                        fontSize: 11,
                        fontFamily: "'DM Mono', monospace",
                        fontWeight: isSelected ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all .15s',
                        position: 'relative',
                      }}>
                      {s.date}
                      {isLast && (
                        <span style={{ marginLeft: 5, fontSize: 9, background: isSelected ? 'rgba(255,255,255,0.25)' : '#e2e8f0', color: isSelected ? 'white' : '#94a3b8', borderRadius: 3, padding: '1px 4px' }}>
                          último
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              {prev && (
                <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4, flexShrink: 0 }}>
                  vs {prev.date}
                </span>
              )}
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
        {!activeCd ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94a3b8' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📦</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: '#64748b', marginBottom: 8 }}>Sin datos aún</div>
            <div style={{ fontSize: 13 }}>Sube un CSV — el CD se detecta automáticamente desde el archivo</div>
          </div>
        ) : (
          <>
            {tab === 'dashboard' && <Dashboard snapshots={snapshots} latest={latest} prev={prev} diff={diff} incumples={incumples ?? []} cdName={activeCd} />}
            {tab === 'criticos'  && <Criticos  latest={latest} />}
            {tab === 'fefo'      && <FEFOTab   diff={diff} prev={prev} latest={latest} />}
            {tab === 'ingresos'  && <Ingresos  diff={diff} prev={prev} latest={latest} />}
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
