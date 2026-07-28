export const STORAGE_KEY = 'fefo_snapshots_v5'
export const TOLERANCIA_DIAS = 0

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
  if (pct <= 66)    return { label: 'Alerta',   nivel: 2, color: '#d97706', bg: '#fffbeb', border: '#fcd34d' }
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

  // Áreas donde queda stock de un lote, y áreas de donde salieron cajas
  const infoAreas = (sku, fv, areasPrev) => {
    const todas = new Set(areasPrev)
    for (const k of Object.keys(cm)) {
      const [s, f, a] = k.split('||')
      if (s === sku && f === fv) todas.add(a)
    }
    const restantes = new Set(), salida = new Set()
    for (const a of todas) {
      const ini = pm[`${sku}||${fv}||${a}`]?.cajas ?? 0
      const fin = cm[`${sku}||${fv}||${a}`]?.cajas ?? 0
      if (fin > 5) restantes.add(a)
      if (ini - fin > 0) salida.add(a)
    }
    return { restantes: [...restantes], salida: [...salida] }
  }
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
    if (nvo.dias - ant.dias <= TOLERANCIA_DIAS) continue  // mismo tramo, no aplica FEFO
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
          incumple.push({ sku, desc: ant.desc, dias_ant: ant.dias, vida_ant: ant.vidaUtil,
            caj_ant: ant.cajas, areas_ant: aa, areas_ant_rem: infoAreas(sku, ant.fv, ant.areas).restantes,
            dias_nvo: nvo.dias, delta_nvo: dn, areas_nvo: na, areas_nvo_sal: infoAreas(sku, nvo.fv, nvo.areas).salida,
            pct: Math.round(Math.abs(dn) / nvo.cajas * 100) })
        } else if (antTieneAlmacen && !nvoTieneAlmacen && nvoTienePicking) {
          abastecimiento.push({ sku, desc: ant.desc, dias_ant: ant.dias, vida_ant: ant.vidaUtil,
            caj_ant: ant.cajas, areas_ant: aa, areas_ant_rem: infoAreas(sku, ant.fv, ant.areas).restantes,
            dias_nvo: nvo.dias, delta_nvo: dn, areas_nvo: na, areas_nvo_sal: infoAreas(sku, nvo.fv, nvo.areas).salida,
            pct: Math.round(Math.abs(dn) / nvo.cajas * 100) })
        } else if (antSoloPicking && nvoTienePicking) {
          incumple.push({ sku, desc: ant.desc, dias_ant: ant.dias, vida_ant: ant.vidaUtil,
            caj_ant: ant.cajas, areas_ant: aa, areas_ant_rem: infoAreas(sku, ant.fv, ant.areas).restantes,
            dias_nvo: nvo.dias, delta_nvo: dn, areas_nvo: na, areas_nvo_sal: infoAreas(sku, nvo.fv, nvo.areas).salida,
            pct: Math.round(Math.abs(dn) / nvo.cajas * 100) })
        }
      } else if (ant.dias < 90) {
        riesgo.push({ sku, desc: ant.desc, dias_ant: ant.dias, caj_ant: ant.cajas, nota: 'Crítico sin movimiento', areas: aa })
      }
    }
  }

  return { salidos, nuevos, ok, riesgo, incumple, abastecimiento }
}

// ── Cumplimiento FEFO semanal ──

function parseFecha(f) {
  const [d, m, y] = f.split('/').map(Number)
  return new Date(y, m - 1, d)
}

// Semana ISO de una fecha "DD/MM/YYYY" → "2026-W26"
export function getSemanaISO(fechaStr) {
  const [d, m, y] = fechaStr.split('/').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dayNr = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNr + 3)
  const jueves = date.valueOf()
  const anio = date.getUTCFullYear()
  const ene1 = new Date(Date.UTC(anio, 0, 1))
  const semana = 1 + Math.round(((jueves - ene1) / 86400000 - 3 + ((ene1.getUTCDay() + 6) % 7)) / 7)
  return `${anio}-W${String(semana).padStart(2, '0')}`
}

// Lunes de la semana de una fecha → "DD/MM/YYYY"
export function lunesDeLaSemana(fechaStr) {
  const [d, m, y] = fechaStr.split('/').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dayNr = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNr)
  return `${String(date.getUTCDate()).padStart(2,'0')}/${String(date.getUTCMonth()+1).padStart(2,'0')}/${date.getUTCFullYear()}`
}
// Cumplimiento FEFO por cajas entre dos snapshots (lunes vs lunes)
// Devuelve cajas despachadas OK, total despachado, y conteos de eventos
export function calcCumplimientoCajas(prevRows, currRows) {
  // Agrupa a nivel lote y también guarda cajas por área
  const build = (rows) => {
    const lot = {}, area = {}
    for (const r of rows) {
      const k = `${r.sku}||${r.fv}`
      if (!lot[k]) lot[k] = { sku: r.sku, fv: r.fv, dias: r.dias, cajas: 0, areas: new Set() }
      lot[k].cajas += r.cajas
      lot[k].areas.add(r.area)
      const ka = `${r.sku}||${r.fv}||${r.area}`
      area[ka] = (area[ka] ?? 0) + r.cajas
    }
    return { lot, area }
  }

  const { lot: pl, area: pa } = build(prevRows)
  const { lot: cl, area: ca } = build(currRows)

  const porSku = {}
  for (const k of Object.keys(pl)) {
    const { sku } = pl[k]
    if (!porSku[sku]) porSku[sku] = []
    porSku[sku].push(pl[k])
  }

  let cajasDespachadas = 0, cajasTodo = 0, cajasIncumplidas = 0
  let nIncumple = 0, nAbastecimiento = 0, nEmpates = 0, nPalletCompleto = 0

  const { esAlmacenamiento, esPicking } = clasificadoresArea()

  for (const sku of Object.keys(porSku)) {
    const lotes = porSku[sku].sort((a, b) => a.dias - b.dias)

    const info = lotes.map(l => {
      const kc = `${l.sku}||${l.fv}`
      const cajasFin = cl[kc] ? cl[kc].cajas : 0

      // Áreas de donde SALIERON cajas de este lote
      const areasSalida = new Set()
      // Áreas donde QUEDA stock de este lote al cierre
      const areasRestantes = new Set()
      const todasAreas = new Set([...l.areas, ...(cl[kc]?.areas ?? [])])
      for (const a of todasAreas) {
        const ka = `${l.sku}||${l.fv}||${a}`
        const ini = pa[ka] ?? 0
        const fin = ca[ka] ?? 0
        if (ini - fin > 0) areasSalida.add(a)
        if (fin > 5) areasRestantes.add(a)
      }

      return {
        ...l,
        cajasIni: l.cajas,
        cajasFin,
        despachado: Math.max(0, l.cajas - cajasFin),
        areasSalida,
        areasRestantes,
      }
    })

    const totalDespachadoSku = info.reduce((s, d) => s + d.despachado, 0)
    cajasTodo += totalDespachadoSku

    if (lotes.length < 2 || totalDespachadoSku <= 5) continue
    cajasDespachadas += totalDespachadoSku

    for (let j = 0; j < info.length; j++) {
      const nv = info[j]
      if (nv.despachado <= 5) continue

      for (let a = 0; a < j; a++) {
        const ant = info[a]
        const antiguoConStock = ant.cajasFin > 5 || (ant.cajasIni > 5 && ant.despachado < ant.cajasIni)
        if (!antiguoConStock) continue

        if (nv.dias - ant.dias <= TOLERANCIA_DIAS) { nEmpates++; continue }

        // Dónde quedó el stock del antiguo, y de dónde salieron las cajas del nuevo
        const antAreas = ant.areasRestantes.size > 0 ? ant.areasRestantes : ant.areas
        const nvAreas  = nv.areasSalida.size   > 0 ? nv.areasSalida   : nv.areas

        const antSoloPicking  = [...antAreas].every(x => esPicking(x))
        const antTieneAlmacen = [...antAreas].some(x => esAlmacenamiento(x))
        const nvTieneAlmacen  = [...nvAreas].some(x => esAlmacenamiento(x))
        const nvSoloPicking   = [...nvAreas].every(x => esPicking(x))

        if (antSoloPicking && nvTieneAlmacen) {
          nPalletCompleto++          // pallet completo → cumplimiento
        } else if (antTieneAlmacen && !nvTieneAlmacen && nvSoloPicking) {
          nAbastecimiento++
        } else {
          nIncumple++
          cajasIncumplidas += nv.despachado
        }
        break
      }
    }
  }

  const cajasOK      = cajasDespachadas - cajasIncumplidas
  const cajasOKTodo  = cajasTodo - cajasIncumplidas
  const pctCajas     = cajasDespachadas > 0 ? cajasOK / cajasDespachadas * 100 : null
  const pctCajasTodo = cajasTodo > 0 ? cajasOKTodo / cajasTodo * 100 : null

  return {
    pctCajas, cajasOK, cajasDespachadas, cajasIncumplidas,
    pctCajasTodo, cajasOKTodo, cajasTodo,
    nIncumple, nAbastecimiento, nEmpates, nPalletCompleto,
  }
}

// Helper: clasificadores de área (mismo criterio que calcDiff)
function clasificadoresArea() {
  const ALM = ['ALMACENAMIENTO', 'VNA', 'CARPA', 'MIXTOS']
  const EXC = ['STAGE DESPACHO', 'STAGE RECEPCION', 'RETENCION']
  const esAlmacenamiento = (a) => ALM.some(p => a.toUpperCase().includes(p))
  const esExcluida = (a) => EXC.some(p => a.toUpperCase().includes(p))
  const esPicking = (a) => !esAlmacenamiento(a) && !esExcluida(a)
  return { esAlmacenamiento, esPicking }
}

// Agrupa snapshots por semana ISO y calcula cumplimiento semana vs semana anterior
export function calcCumplimientoSemanal(snapshots) {
  if (!snapshots || snapshots.length < 2) return []

  // Agrupar por semana, elegir representativo = más temprano de cada semana
  const porSemana = {}
  for (const snap of snapshots) {
    const sem = getSemanaISO(snap.date)
    if (!porSemana[sem] || parseFecha(snap.date) < parseFecha(porSemana[sem].date)) {
      porSemana[sem] = snap
    }
  }

  // Ordenar semanas cronológicamente
  const semanas = Object.keys(porSemana).sort()

  const resultado = []
  for (let i = 1; i < semanas.length; i++) {
    const semActual = semanas[i]
    const semPrev = semanas[i - 1]
    const repActual = porSemana[semActual]
    const repPrev = porSemana[semPrev]

    const c = calcCumplimientoCajas(repPrev.rows, repActual.rows)
    resultado.push({
      semana: semActual,
      lunes: lunesDeLaSemana(repActual.date),
      fechaRep: repActual.date,
      fechaRepPrev: repPrev.date,
      ...c,
    })
  }

  return resultado
}
