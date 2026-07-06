export const STORAGE_KEY = 'fefo_snapshots_v5'

const PATRONES_EXCLUIR        = ['STAGE DESPACHO', 'STAGE RECEPCION', 'RETENCION']
const PATRONES_ALMACENAMIENTO = ['ALMACENAMIENTO', 'VNA', 'CARPA', 'MIXTOS']

// Perfiles de antigüedad que no generan alerta de vida útil
const PERFILES_SIN_CONTROL = [600, 999, 1100, 9999]

const esExcluida       = (area) => PATRONES_EXCLUIR.some(p => area.toUpperCase().includes(p))
const esAlmacenamiento = (area) => PATRONES_ALMACENAMIENTO.some(p => area.toUpperCase().includes(p))
const esPicking        = (area) => !esAlmacenamiento(area) && !esExcluida(area)

const tieneAlmacen = (areas) => [...areas].some(a => esAlmacenamiento(a))
const soloPicking  = (areas) => [...areas].every(a => esPicking(a))
const tienePicking = (areas) => [...areas].some(a => esPicking(a))

// Porcentaje de vida útil disponible
export function pctVida(r) {
  if (!r.vidaUtil || r.vidaUtil <= 0) return null
  return r.dias / r.vidaUtil * 100
}

// Clasificación por % de vida útil
export function classifyPct(pct, vidaUtil) {
  // Productos sin control de vencimiento → nunca generan alerta
  if (vidaUtil != null && PERFILES_SIN_CONTROL.includes(vidaUtil))
    return { label: 'Sin control', nivel: 1, color: '#16a34a', bg: '#f0fdf4', border: '#86efac' }
  if (pct == null)  return { label: 'Sin dato', nivel: 0, color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0' }
  if (pct < 30)     return { label: 'Urgente',  nivel: 4, color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' }
  if (pct < 50)     return { label: 'Crítico',  nivel: 3, color: '#ef4444', bg: '#fef2f2', border: '#fecaca' }
  if (pct <= 55)    return { label: 'Alerta',   nivel: 2, color: '#d97706', bg: '#fffbeb', border: '#fcd34d' }
  return              { label: 'Sano',     nivel: 1, color: '#16a34a', bg: '#f0fdf4', border: '#86efac' }
}

// Compatibilidad: classify por días
export function classify(dias) {
  if (dias < 60)  return { label: 'Crítico',     color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' }
  if (dias < 90)  return { label: 'Alto Riesgo', color: '#d97706', bg: '#fffbeb', border: '#fcd34d' }
  if (dias <= 180)return { label: 'Medio',        color: '#ca8a04', bg: '#fefce8', border: '#fde047' }
  return           { label: 'Bajo',               color: '#16a34a', bg: '#f0fdf4', border: '#86efac' }
}

export function parseCSV(text) {
  const porCD = {}          // { CD: [rows] }
  let ultimoCd = null

  const lineas = []
  for (const line of text.replace(/\r/g, '').split('\n')) {
    if (lineas.length > 0 && lineas[lineas.length - 1].split(';').length < 9) {
      lineas[lineas.length - 1] += line
    } else {
      lineas.push(line)
    }
  }

  for (const line of lineas) {
    const t = line.trim()
    if (!t) continue
    const p = t.split(';')
    if (p.length < 9) continue

    const col0 = p[0].replace(/"/g, '').replace(/\uFEFF/g, '').trim()

    if (col0 && col0 !== 'Id. de almacen' && col0 !== 'Centro' && col0 !== 'centro') {
      ultimoCd = col0
    }

    const cdFila = col0 || ultimoCd
    if (!cdFila) continue
    if (cdFila === 'Id. de almacen' || cdFila === 'Centro' || cdFila === 'centro') continue

    const area = p[1].replace(/["\n]/g, '').trim()
    if (!area) continue
    if (esExcluida(area)) continue

    const estado = (p[4] || '').replace(/["\n]/g, '').trim() || 'Sin estado'
    const vidaUtil = parseInt(p[5])
    const dias = parseInt(p[7])
    const cajas = parseInt(p[8])
    if (!p[2] || isNaN(dias) || isNaN(cajas) || dias < 0) continue

    if (!porCD[cdFila]) porCD[cdFila] = []
    porCD[cdFila].push({
      cd:   cdFila,
      sku:  p[2].trim(),
      desc: p[3].trim(),
      area,
      estado,
      vidaUtil: isNaN(vidaUtil) ? null : vidaUtil,
      dias,
      cajas,
      fv:   p[6].trim().slice(0, 10),
    })
  }

  return porCD   // { CD1500: [...], RENCA: [...] }
}
export function aggregateRows(rows) {
  const map = {}
  for (const r of rows) {
    const k = `${r.sku}||${r.fv}||${r.area}||${r.estado}`
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

  const pkSinArea = new Set(prev.map(r => `${r.sku}||${r.fv}`))
  const nuevos = curr
    .filter(r => !pkSinArea.has(`${r.sku}||${r.fv}`))
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

  const ok = [], riesgo = [], incumple = [], abastecimiento = []

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

    if (da < -5 && dn >= -5) {
      ok.push({ sku, desc: ant.desc, dias: ant.dias, delta: da, areas: aa })
    } else if (da < -5 && dn < -5) {
      riesgo.push({ sku, desc: ant.desc, nota: 'Consumo simultáneo', areas: aa })
    } else if (da >= -5 && ant.cajas > 20) {
      if (dn < -5) {
        const antSoloPicking  = soloPicking(ant.areas)
        const antTieneAlmacen = tieneAlmacen(ant.areas)
        const nvoTieneAlmacen = tieneAlmacen(nvo.areas)
        const nvoTienePicking = tienePicking(nvo.areas)

        if (antSoloPicking && nvoTieneAlmacen) {
          // OK
        } else if (antTieneAlmacen && nvoTieneAlmacen) {
          incumple.push({ sku, desc: ant.desc, dias_ant: ant.dias, caj_ant: ant.cajas, areas_ant: aa, dias_nvo: nvo.dias, delta_nvo: dn, areas_nvo: na, pct: Math.round(Math.abs(dn) / nvo.cajas * 100) })
        } else if (antTieneAlmacen && !nvoTieneAlmacen && nvoTienePicking) {
          abastecimiento.push({ sku, desc: ant.desc, dias_ant: ant.dias, caj_ant: ant.cajas, areas_ant: aa, dias_nvo: nvo.dias, delta_nvo: dn, areas_nvo: na, pct: Math.round(Math.abs(dn) / nvo.cajas * 100) })
        } else if (antSoloPicking && nvoTienePicking) {
          incumple.push({ sku, desc: ant.desc, dias_ant: ant.dias, caj_ant: ant.cajas, areas_ant: aa, dias_nvo: nvo.dias, delta_nvo: dn, areas_nvo: na, pct: Math.round(Math.abs(dn) / nvo.cajas * 100) })
        }
      } else if (ant.dias < 90) {
        riesgo.push({ sku, desc: ant.desc, dias_ant: ant.dias, caj_ant: ant.cajas, nota: 'Crítico sin movimiento', areas: aa })
      }
    }
  }

  return { salidos, nuevos, ok, riesgo, incumple, abastecimiento }
}
