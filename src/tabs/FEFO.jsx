import { pctVida } from '../fefo.js'
import { AreaPill, TH, TD, EmptyState } from '../components.jsx'

export default function FEFOTab({ diff, prev, latest }) {
  if (!diff) return <EmptyState icon="📊" text="Se necesitan al menos 2 snapshots." />

  // Ordenar por criticidad del lote antiguo (% vida útil), luego por volumen mal despachado
  const ordenar = (arr) => [...(arr ?? [])].sort((a, b) => {
    const pa = a.vida_ant ? a.dias_ant / a.vida_ant * 100 : 999
    const pb = b.vida_ant ? b.dias_ant / b.vida_ant * 100 : 999
    if (Math.round(pa) !== Math.round(pb)) return pa - pb
    return Math.abs(b.delta_nvo ?? 0) - Math.abs(a.delta_nvo ?? 0)
  })

  const incumple       = ordenar(diff.incumple)
  const abastecimiento = ordenar(diff.abastecimiento)
  const riesgo         = diff.riesgo ?? []

  const colorVida = (p) => p == null ? '#64748b' : p < 30 ? '#dc2626' : p < 50 ? '#ef4444' : p <= 55 ? '#d97706' : '#64748b'

  const Tabla = ({ datos, titulo, color, descripcion }) => (
    <div style={{ marginBottom: 28 }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 2 }}>{titulo} ({datos.length})</div>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>{descripcion}</div>
      </div>
      {datos.length === 0 ? (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 16, textAlign: 'center', color: '#16a34a', fontWeight: 500, fontSize: 13 }}>
          ✅ Sin casos detectados
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <TH width="240px">SKU / Descripción</TH>
                <TH width="100px">Lote antiguo</TH>
                <TH width="190px">Disponible en</TH>
                <TH width="110px">Salió mal</TH>
                <TH width="190px">Desde</TH>
              </tr>
            </thead>
            <tbody>
              {datos.map((r, i) => {
                const p = r.vida_ant ? r.dias_ant / r.vida_ant * 100 : null
                const areasDisp = (r.areas_ant_rem?.length ? r.areas_ant_rem : r.areas_ant) ?? []
                const areasSal  = (r.areas_nvo_sal?.length ? r.areas_nvo_sal : r.areas_nvo) ?? []
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <TD>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#0369a1' }}>{r.sku}</div>
                      <div style={{ fontSize: 12, color: '#1e293b' }}>{r.desc}</div>
                    </TD>
                    <TD>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 14, color: colorVida(p) }}>{r.dias_ant}d</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{p != null ? `${Math.round(p)}% vida` : 'sin dato'}</div>
                    </TD>
                    <TD>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, marginBottom: 2 }}>{r.caj_ant?.toLocaleString()} cj</div>
                      <div>{areasDisp.map(a => <AreaPill key={a} area={a} />)}</div>
                    </TD>
                    <TD>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: '#dc2626' }}>{Math.abs(r.delta_nvo ?? 0).toLocaleString()} cj</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>lote {r.dias_nvo}d</div>
                    </TD>
                    <TD>{areasSal.map(a => <AreaPill key={a} area={a} />)}</TD>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  return (
    <div>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 18 }}>
        Incumplimientos detectados · <strong>{prev?.date}</strong> → <strong>{latest?.date}</strong>
        <span style={{ color: '#94a3b8' }}> · ordenados por criticidad del lote antiguo</span>
      </p>

      <Tabla
        datos={incumple}
        titulo="❌ Incumplimientos FEFO"
        color="#dc2626"
        descripcion='"Disponible en" es dónde quedó el stock antiguo sin mover. "Desde" es de qué área salieron las cajas del lote nuevo.'
      />

      <Tabla
        datos={abastecimiento}
        titulo="⚠️ Alertas de abastecimiento"
        color="#d97706"
        descripcion="El lote antiguo está en almacenamiento pero se consumió desde picking del lote nuevo — falta reabastecer picking."
      />

      {riesgo.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 10 }}>
            ⚡ En seguimiento ({riesgo.length})
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH width="240px">SKU / Descripción</TH>
                  <TH width="80px">Días</TH>
                  <TH width="80px">Cajas</TH>
                  <TH width="180px">Nota</TH>
                  <TH width="190px">Áreas</TH>
                </tr>
              </thead>
              <tbody>
                {riesgo.map((r, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <TD>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#0369a1' }}>{r.sku}</div>
                      <div style={{ fontSize: 12 }}>{r.desc}</div>
                    </TD>
                    <TD style={{ fontFamily: "'DM Mono', monospace", color: '#d97706', fontWeight: 600 }}>{r.dias_ant ? `${r.dias_ant}d` : '—'}</TD>
                    <TD style={{ fontFamily: "'DM Mono', monospace" }}>{r.caj_ant?.toLocaleString() ?? '—'}</TD>
                    <TD style={{ fontSize: 12, color: '#64748b' }}>{r.nota}</TD>
                    <TD>{r.areas?.map(a => <AreaPill key={a} area={a} />)}</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
