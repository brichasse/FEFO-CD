import { RiskBadge, AreaPill, TH, TD, EmptyState } from '../components.jsx'

export default function FEFOTab({ diff, prev, latest }) {
  if (!diff) return <EmptyState icon="📊" text="Se necesitan al menos 2 snapshots." />

  const incumple      = diff.incumple?.sort((a, b) => a.dias_ant - b.dias_ant) ?? []
  const abastecimiento = diff.abastecimiento?.sort((a, b) => a.dias_ant - b.dias_ant) ?? []
  const riesgo        = diff.riesgo ?? []

  const TablaIncumplimientos = ({ datos, titulo, color, descripcion }) => (
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
                <TH width="105px">SKU</TH>
                <TH width="180px">Descripción</TH>
                <TH width="80px">Lote ant.</TH>
                <TH width="65px">Cj ant.</TH>
                <TH width="160px">Área lote antiguo</TH>
                <TH width="80px">Lote nvo.</TH>
                <TH width="65px">Consumo</TH>
                <TH width="160px">Área lote nuevo</TH>
                <TH width="45px">%</TH>
              </tr>
            </thead>
            <tbody>
              {datos.map((r, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <TD style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{r.sku}</TD>
                  <TD>{r.desc}</TD>
                  <TD style={{ fontWeight: 700, fontFamily: "'DM Mono', monospace", color: '#dc2626' }}>{r.dias_ant}d</TD>
                  <TD style={{ fontFamily: "'DM Mono', monospace" }}>{r.caj_ant}</TD>
                  <TD>{r.areas_ant?.map(a => <AreaPill key={a} area={a} />)}</TD>
                  <TD style={{ fontFamily: "'DM Mono', monospace", color: '#64748b' }}>{r.dias_nvo}d</TD>
                  <TD style={{ fontFamily: "'DM Mono', monospace", color: '#16a34a', fontWeight: 600 }}>{Math.abs(r.delta_nvo ?? 0)}</TD>
                  <TD>{r.areas_nvo?.map(a => <AreaPill key={a} area={a} />)}</TD>
                  <TD style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, color }}>{r.pct}%</TD>
                </tr>
              ))}
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
        &nbsp;&nbsp;<span style={{ color: '#94a3b8' }}>"Área lote antiguo" = dónde estaba el stock sin moverse</span>
      </p>

      {/* Incumplimientos reales */}
      <TablaIncumplimientos
        datos={incumple}
        titulo="❌ Incumplimientos FEFO"
        color="#dc2626"
        descripcion="El lote más antiguo no se consumió primero — hay consumo del lote nuevo mientras el antiguo tiene stock disponible en la misma zona."
      />

      {/* Alertas de abastecimiento */}
      <TablaIncumplimientos
        datos={abastecimiento}
        titulo="⚠️ Alertas de abastecimiento"
        color="#d97706"
        descripcion="El lote antiguo está en almacenamiento pero se está consumiendo desde picking del lote nuevo — posible falta de reabastecimiento al área de picking."
      />

      {/* Riesgo / consumo simultáneo */}
      {riesgo.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 10 }}>
            ⚡ En seguimiento ({riesgo.length})
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH width="105px">SKU</TH>
                  <TH width="200px">Descripción</TH>
                  <TH width="80px">Días</TH>
                  <TH width="75px">Cajas</TH>
                  <TH>Nota</TH>
                  <TH width="200px">Áreas</TH>
                </tr>
              </thead>
              <tbody>
                {riesgo.map((r, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <TD style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{r.sku}</TD>
                    <TD>{r.desc}</TD>
                    <TD style={{ fontFamily: "'DM Mono', monospace", color: '#d97706', fontWeight: 600 }}>{r.dias_ant ? `${r.dias_ant}d` : '—'}</TD>
                    <TD style={{ fontFamily: "'DM Mono', monospace" }}>{r.caj_ant ?? '—'}</TD>
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
