import { EmptyState } from '../components.jsx'

export default function Snapshots({ snapshots, onDelete }) {
  if (snapshots.length === 0) return <EmptyState icon="📂" text="Sin snapshots aún. Sube tu primer CSV." />

  return (
    <div>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
        Historial almacenado · el análisis FEFO compara siempre el último vs el anterior
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[...snapshots].reverse().map((s, i) => {
          const tc   = s.rows.reduce((a, r) => a + r.cajas, 0)
          const crit = s.rows.filter(r => r.dias < 60).length
          const isLatest = i === 0
          return (
            <div key={s.date} style={{ background: isLatest ? '#f0fdf4' : '#f8fafc', border: `1px solid ${isLatest ? '#86efac' : '#e2e8f0'}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, fontSize: 14 }}>{s.date}</span>
                  {isLatest && (
                    <span style={{ background: '#16a34a', color: 'white', borderRadius: 4, padding: '1px 8px', fontSize: 10, fontWeight: 600 }}>último</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                  {tc.toLocaleString()} cajas · {new Set(s.rows.map(r => r.sku)).size} SKUs · {crit} lotes críticos
                </div>
              </div>
              <button
                onClick={() => onDelete(s.date)}
                style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}
              >
                Eliminar
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
