import { RiskBadge, AreaPill, StatCard, TH, TD, EmptyState } from '../components.jsx'

export default function Ingresos({ diff, prev, latest }) {
  if (!diff) return <EmptyState icon="📊" text="Se necesitan al menos 2 snapshots." />

  const criticos  = diff.nuevos.filter(r => r.dias < 60)
  const altoRiesgo = diff.nuevos.filter(r => r.dias >= 60 && r.dias < 90)
  const mostrar   = diff.nuevos.filter(r => r.dias < 90).sort((a, b) => a.dias - b.dias)

  return (
    <div>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
        Nuevos lotes detectados · <strong>{prev?.date}</strong> → <strong>{latest?.date}</strong>
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
        <StatCard label="Total nuevos"    value={diff.nuevos.length} />
        <StatCard label="Críticos <60d"   value={criticos.length}    color="#dc2626" />
        <StatCard label="Alto 60–89d"     value={altoRiesgo.length}  color="#d97706" />
      </div>

      {mostrar.length === 0 ? (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 20, textAlign: 'center', color: '#16a34a', fontWeight: 500 }}>
          ✅ Sin nuevos ingresos críticos en este período
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <TH width="105px">SKU</TH>
                <TH width="200px">Descripción</TH>
                <TH width="60px">Días</TH>
                <TH width="75px">Cajas</TH>
                <TH width="95px">Vence</TH>
                <TH width="200px">Área de ingreso</TH>
                <TH width="95px">Riesgo</TH>
              </tr>
            </thead>
            <tbody>
              {mostrar.map((r, i) => (
                <tr key={i} style={{ background: r.dias < 30 ? '#fef2f2' : r.dias < 60 ? '#fffbeb' : '#fefce8' }}>
                  <TD style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{r.sku}</TD>
                  <TD>{r.desc}</TD>
                  <TD style={{ fontWeight: 700, fontFamily: "'DM Mono', monospace", color: '#dc2626' }}>{r.dias}</TD>
                  <TD style={{ fontFamily: "'DM Mono', monospace" }}>{r.cajas.toLocaleString()}</TD>
                  <TD style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{r.fv}</TD>
                  <TD><AreaPill area={r.area} /></TD>
                  <TD><RiskBadge dias={r.dias} /></TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
