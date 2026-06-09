import { RiskBadge, AreaPill, TH, TD, EmptyState } from '../components.jsx'

export default function Criticos({ latest }) {
  const agg = latest ? latest.rows : []
  const crit = [...agg].filter(r => r.dias < 60).sort((a, b) => a.dias - b.dias || b.cajas - a.cajas)

  if (!latest) return <EmptyState icon="📦" text="Sube el primer CSV para ver lotes críticos." />
  if (crit.length === 0) return <EmptyState icon="✅" text="Sin lotes críticos en este snapshot." />

  return (
    <div>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
        Lotes con menos de 60 días de vida útil · snapshot {latest.date} · {crit.length} registros
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <TH width="105px">SKU</TH>
              <TH width="200px">Descripción</TH>
              <TH width="60px">Días</TH>
              <TH width="75px">Cajas</TH>
              <TH width="95px">Vence</TH>
              <TH width="200px">Área</TH>
              <TH width="95px">Riesgo</TH>
            </tr>
          </thead>
          <tbody>
            {crit.map((r, i) => (
              <tr key={i} style={{ background: r.dias < 15 ? '#fef2f2' : r.dias < 30 ? '#fffbeb' : 'white' }}>
                <TD style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{r.sku}</TD>
                <TD>{r.desc}</TD>
                <TD style={{ fontWeight: 700, fontFamily: "'DM Mono', monospace", color: r.dias < 15 ? '#dc2626' : '#d97706' }}>{r.dias}</TD>
                <TD style={{ fontFamily: "'DM Mono', monospace" }}>{r.cajas.toLocaleString()}</TD>
                <TD style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{r.fv}</TD>
                <TD><AreaPill area={r.area} /></TD>
                <TD><RiskBadge dias={r.dias} /></TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
