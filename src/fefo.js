export const EXCLUDE_AREAS = ['STAGE DESPACHO', 'STAGE RECEPCION']
export const STORAGE_KEY = 'fefo_snapshots_v5'

export function classify(dias) {
  if (dias < 60)  return { label: 'Crítico',    color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' }
  if (dias < 90)  return { label: 'Alto Riesgo',color: '#d97706', bg: '#fffbeb', border: '#fcd34d' }
  if (dias <= 180)return { label: 'Medio',       color: '#ca8a04', bg: '#fefce8', border: '#fde047' }
  return           { label: 'Bajo',              color: '#16a34a', bg: '#f0fdf4', border: '#86efac' }
}

export function parseCSV(text) {
  const rows = []
  let cdDetectado = null

  for (const line of text.replace(/\r/g, '').split('\n')) {
    const t = line.trim()
    if (!t) continue
    const p = t.split(';')
    if (p.length < 9) continue

    const col0 = p[0].replace(/"/g, '').trim()

    if (!cdDetectado && col0 && col0 !== 'Id. de almacen' && col0 !== 'Centro' && col0 !== 'centro') {
      cdDetectado = col0
    }

    const area = p[1].replace(/["\n]/g, '').trim()
    if (EXCLUDE_AREAS.some(x => area.toUpperCase().includes(x))) continue

    const dias = parseInt(p[7])
    const cajas = parseInt(p[8])
    if (!p[2] || isNaN(dias) || isNaN(cajas) || dias < 0) continue

    rows.push({
      cd:   col0,
      sku:  p[2].trim(),
      desc: p[3].trim(),
      area,
      dias,
      cajas,
      fv:   p[6].trim().slice(0, 10),
    })
  }

  return { rows, cd: cdDetectado }
}

export function aggregateRows(rows) {
  const map = {}
  for (const r of rows) {
    // Clave estable: sku + fecha de vencimiento + area (no usa dias porque cambia cada día)
    const k = `${r.sku}||${r.fv}||${r.area}`
    if (!map[k]) map[k] = { ...r, cajas: 0 }
    else map[k].dias = r.dias
    map[k].cajas += r.cajas
  }
  return Object.values(map)
}

export function calcDiff(prev, curr) {
  const pm = {}, cm = {}
  for (const r of prev) pm[`${r.sku}||${r.fv}||${r.area}`] = r
  for (const r of curr) cm[`${r.sku}||${r.fv}||${r.area}`] = r
  const pk = new Set(Object.keys(pm)), ck = new Set(Object.keys(cm))

  const salidos = [...pk].filter(k => !ck.has(k)).map(k => pm[k])

  // Para nuevos ingresos usar solo sku+fv (sin área) para ignorar movimientos internos
  const pkSinArea = new Set(prev.map(r => `${r.sku}||${r.fv}`))
  const nuevos = curr
    .filter(r => !pkSinArea.has(`${r.sku}||${r.fv}`))
    // deduplicar por sku+fv en caso de que el mismo lote esté en varias áreas nuevas
    .filter((r, i, arr) => arr.findIndex(x => x.sku === r.sku && x.fv === r.fv) === i)

  const sklp = {}, sklc = {}
  for (const r of prev) {
    const k = `${r.sku}||${r.fv}`
    if (!sklp[k]) sklp[k] = { ...r, cajas: 0, areas: new Set() }
    sklp[k].cajas += r.cajas
    sklp[k].areas.add(r.area)
  }
  for (const r of curr) {
    const k = `${r.sku}||${r.fv}`
    if (!sklc[k]) sklc[k] = { ...r, cajas: 0, areas: new Set() }
    sklc[k].cajas += r.cajas
    sklc[k].areas.add(r.area)
  }

  const bsp = {}, bsc = {}
  for (const v of Object.values(sklp)) { if (!bsp[v.sku]) bsp[v.sku] = []; bsp[v.sku].push(v) }
  for (const v of Object.values(sklc)) { if (!bsc[v.sku]) bsc[v.sku] = []; bsc[v.sku].push(v) }

  const ok = [], riesgo = [], incumple = []

  for (const sku of Object.keys(bsp)) {
    if (!bsc[sku]) continue
    const lotes1 = bsp[sku].sort((a, b) => a.dias - b.dias)
    const cm2 = {}
    for (const l of bsc[sku]) cm2[l.fv] = l

    if (lotes1.length < 2) {
      const l = lotes1[0], l2 = cm2[l.fv]
      if (l2 && l2.cajas - l.cajas < -5) ok.push({ sku, desc: l.desc, areas: [...l.areas] })
      continue
    }

    const ant = lotes1[0], nvo = lotes1[1]
    const a2 = cm2[ant.fv], n2 = cm2[nvo.fv]
    const ca2 = a2 ? a2.cajas : ant.cajas
    const cn2 = n2 ? n2.cajas : nvo.cajas
    const da = ca2 - ant.cajas, dn = cn2 - nvo.cajas
    const aa = [...ant.areas], na = [...nvo.areas]

    if (da < -5 && dn >= -5)
      ok.push({ sku, desc: ant.desc, dias: ant.dias, delta: da, areas: aa })
    else if (da >= -5 && dn < -5 && ant.cajas > 20)
      incumple.push({ sku, desc: ant.desc, dias_ant: ant.dias, caj_ant: ant.cajas, areas_ant: aa, dias_nvo: nvo.dias, delta_nvo: dn, areas_nvo: na, pct: Math.round(Math.abs(dn) / nvo.cajas * 100) })
    else if (da < -5 && dn < -5)
      riesgo.push({ sku, desc: ant.desc, nota: 'Consumo simultáneo', areas: aa })
    else if (da >= -5 && ant.dias < 90 && ant.cajas > 20)
      riesgo.push({ sku, desc: ant.desc, dias_ant: ant.dias, caj_ant: ant.cajas, nota: 'Crítico sin movimiento', areas: aa })
  }

  return { salidos, nuevos, ok, riesgo, incumple }
}
