export default function CDSelector({ cds, activeCd, allData, onSelect, onDelete, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: 14, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>Centros de Distribución</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Selecciona o elimina un CD</div>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 10px', fontSize: 18, color: '#94a3b8', cursor: 'pointer', lineHeight: 1 }}>
            ×
          </button>
        </div>

        {cds.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8', fontSize: 13 }}>
            Sin CDs registrados. Sube un CSV para agregar uno.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cds.map(cd => {
              const snaps = allData[cd] || []
              const last  = snaps[snaps.length - 1]
              const crit  = last?.rows.filter(r => r.dias < 60).length ?? 0
              const tot   = last?.rows.reduce((s, r) => s + r.cajas, 0) ?? 0
              const isActive = cd === activeCd

              return (
                <div key={cd} style={{ display: 'flex', alignItems: 'center', gap: 12, background: isActive ? '#f0fdf4' : '#f8fafc', border: `1px solid ${isActive ? '#86efac' : '#e2e8f0'}`, borderRadius: 10, padding: '12px 16px', cursor: 'pointer', transition: 'all .15s' }}
                  onClick={() => onSelect(cd)}>

                  {/* CD badge */}
                  <div style={{ background: isActive ? '#16a34a' : '#0f172a', color: 'white', borderRadius: 8, padding: '4px 10px', fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                    {cd}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#0f172a' }}>
                      {snaps.length} snapshot{snaps.length !== 1 ? 's' : ''}
                      {last && <span style={{ color: '#94a3b8', fontWeight: 400 }}> · último: {last.date}</span>}
                    </div>
                    {last && (
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {tot.toLocaleString()} cajas
                        {crit > 0 && <span style={{ color: '#dc2626', fontWeight: 500 }}> · {crit} lotes críticos</span>}
                      </div>
                    )}
                  </div>

                  {/* Active indicator */}
                  {isActive && (
                    <span style={{ fontSize: 10, background: '#16a34a', color: 'white', borderRadius: 4, padding: '1px 8px', fontWeight: 600, flexShrink: 0 }}>
                      activo
                    </span>
                  )}

                  {/* Delete button */}
                  <button
                    onClick={e => { e.stopPropagation(); if (window.confirm(`¿Eliminar todos los datos de ${cd}?`)) onDelete(cd) }}
                    title={`Eliminar ${cd}`}
                    style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: '#dc2626', cursor: 'pointer', flexShrink: 0 }}>
                    Eliminar
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ marginTop: 20, padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            💡 El CD se detecta automáticamente al subir cada CSV. Puedes tener múltiples CDs con sus propios historiales independientes.
          </div>
        </div>
      </div>
    </div>
  )
}
