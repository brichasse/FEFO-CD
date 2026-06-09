import { AreaPill, StatCard, TH, TD, EmptyState } from '../components.jsx'

export default function FEFO({ diff, prev, latest }) {
  if (!diff) return <EmptyState icon="📊" text="Se necesitan al menos 2 snapshots para el análisis FEFO." />

  const incumples = diff.incumple.sort((a, b) => a.dias_ant - b.dias_ant)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
        <StatCard label="Cumple FEFO" value={diff.ok.length}       color="#16a34a" />
        <StatCard label="En riesgo"   value={diff.riesgo.length}   color="#d97706" />
        <StatCard label="Incumple"    value={diff.incumple.length} color="#dc2626" />
      </div>

      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
        Incumplimientos detectados · <strong>{prev?.date}</strong> → <strong>{latest?.date}</strong>
        <span style={{ marginLeft: 10, color: '#94a3b8', fontSize: 11 }}>
          "Área lote antiguo" = dónde estaba el stock sin moverse
        </span>
      </p>

      {incumples.length === 0 ? (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 20, textAlign: 'center', color: '#16a34a', fontWeight: 500 }}>
          ✅ Sin incumplimientos FEFO en este período
        </div>
      ) : (
        <div style={{ overflowX: 'auto', marginBottom: 24 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <TH width="100px">SKU</TH>
                <TH width="160px">Descripción</TH>
                <TH width="75px">Lote ant.</TH>
                <TH width="65px">Cj ant.</TH>
                <TH width="180px">Área lote antiguo</TH>
                <TH width="75px">Lote nvo.</TH>
                <TH width="80px">Consumo</TH>
                <TH width="180px">Área lote nuevo</TH>
                <TH width="45px">%</TH>
              </tr>
            </thead>
            <tbody>
              {incumples.map((x, i) => (
                <tr key={i} style={{ background: x.dias_ant < 60 ? '#fef2f2' : '#fffbeb' }}>
                  <TD style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{x.sku}</TD>
                  <TD>{x.desc}</TD>
                  <TD style={{ color: '#dc2626', fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{x.dias_ant}d</TD>
                  <TD style={{ fontFamily: "'DM Mono', monospace" }}>{x.caj_ant.toLocaleString()}</TD>
                  <TD>{x.areas_ant.map((a, j) => <AreaPill key={j} area={a} />)}</TD>
                  <TD style={{ fontFamily: "'DM Mono', monospace" }}>{x.dias_nvo}d</TD>
                  <TD style={{ color: '#16a34a', fontFamily: "'DM Mono', monospace" }}>{Math.abs(x.delta_nvo).toLocaleString()}</TD>
                  <TD>{x.areas_nvo.map((a, j) => <AreaPill key={j} area={a} />)}</TD>
                  <TD style={{ fontFamily: "'DM Mono', monospace" }}>{x.pct}%</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* En riesgo */}
      {diff.riesgo.length > 0 && (
        <>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>
            En riesgo ({diff.riesgo.length}) — consumo simultáneo o crítico sin movimiento
          </p>
          <div style={{ overflowX: 'auto', marginBottom: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH width="100px">SKU</TH>
                  <TH width="200px">Descripción</TH>
                  <TH width="65px">Días</TH>
                  <TH width="70px">Cajas</TH>
                  <TH width="200px">Área</TH>
                  <TH width="180px">Nota</TH>
                </tr>
              </thead>
              <tbody>
                {diff.riesgo.map((x, i) => (
                  <tr key={i} style={{ background: '#fffbeb' }}>
                    <TD style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{x.sku}</TD>
                    <TD>{x.desc}</TD>
                    <TD style={{ color: '#d97706', fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{x.dias_ant ?? '—'}</TD>
                    <TD style={{ fontFamily: "'DM Mono', monospace" }}>{x.caj_ant?.toLocaleString() ?? '—'}</TD>
                    <TD>{(x.areas || []).map((a, j) => <AreaPill key={j} area={a} />)}</TD>
                    <TD style={{ fontSize: 11, color: '#92400e' }}>{x.nota}</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p style={{ fontSize: 12, color: '#64748b' }}>
        Lotes críticos liquidados completos: <strong style={{ color: '#16a34a' }}>{diff.salidos.filter(r => r.dias < 60).length}</strong>
      </p>
    </div>
  )
}
