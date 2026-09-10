/**
 * Ritmo BYS — lee la hoja y expone los datos como JSON.
 *
 * Despliegue: Implementar › Nueva implementación › Aplicación web
 *   Ejecutar como:        Yo
 *   Quién tiene acceso:   Cualquier usuario con el vínculo
 *
 * A diferencia de la hoja de Rivera, aquí cada mes es una PESTAÑA y el mes se
 * saca del nombre de la pestaña ("Daily control Marzo 2026"), no de una celda:
 * dentro de las hojas hay encabezados mal copiados que dicen otro mes.
 */

const SHEET_ID     = '1x3KB9xD0y3jkq1C7Rdb5dhmCh5pHg4REv3tJuRxjL_U';
const META_MENSUAL = 100000000;
const CACHE_SEG    = 600;

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

/** Fila del bloque -> nombre con el que la guardamos. */
const FILAS = {
  'acumulado total':     'ventas',   // ya viene acumulada
  'total leads':         'leads',    // diaria
  'total agendamientos': 'agend'     // diaria
};

const norm = s => String(s).toLowerCase().trim()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');

function leerHoja() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const out = {};

  ss.getSheets().forEach(function (sheet) {
    // El mes sale del nombre de la pestaña. Las que no nombran un mes
    // ("Reporte semanal Overview", "OVERVIEW GENERAL 2026") se ignoran solas.
    const nom = norm(sheet.getName());
    const mes = MESES.find(function (m) { return nom.indexOf(norm(m)) !== -1; });
    if (!mes) return;

    const v = sheet.getDataRange().getValues();

    // Ancla: la celda que dice exactamente "Ventas".
    let fila = -1, col = -1;
    for (let r = 0; r < v.length && fila < 0; r++) {
      for (let c = 0; c < v[r].length; c++) {
        if (norm(v[r][c]) === 'ventas') { fila = r; col = c; break; }
      }
    }
    if (fila < 0) return;

    // Columnas de día. Se corta sola en "Acumulado mes", que no es un número.
    let fin = col + 1;
    while (fin < v[fila].length) {
      const x = v[fila][fin];
      const n = typeof x === 'number' ? x : parseInt(String(x), 10);
      if (isNaN(n) || n < 1 || n > 31) break;
      fin++;
    }
    const nDias = fin - col - 1;
    if (nDias < 5) return; // el reporte semanal también tiene "Ventas", pero sin días

    out[mes] = {};
    for (let r = fila + 1; r < v.length; r++) {
      const campo = FILAS[norm(v[r][col])];
      if (!campo) continue;
      out[mes][campo] = v[r].slice(col + 1, fin).map(function (x) {
        if (typeof x === 'number') return x;
        if (x === '' || x === null) return null;
        const s = String(x).replace(/[^0-9-]/g, '');
        if (s === '' || s === '-') return null;
        const n = Number(s);
        return isNaN(n) ? null : n;
      });
    }
  });

  return out;
}

/**
 * Arrastra los días sin cargar en una serie ACUMULADA.
 * Los "$ -" de la hoja llegan como 0. Un acumulado nunca baja, así que un 0
 * después de un valor positivo es un día sin cargar. Los ceros del arranque sí valen.
 */
function ffill(a) {
  let last = 0;
  return (a || []).map(function (x) {
    if (x === null || x === undefined || (x === 0 && last > 0)) return last;
    last = x;
    return x;
  });
}
function acum(a) {
  let s = 0;
  return (a || []).map(function (x) { s += (x || 0); return s; });
}

function construirPayload() {
  const raw = leerHoja();
  const meses = MESES.filter(function (m) { return raw[m] && raw[m].ventas; });
  if (!meses.length) throw new Error('No se encontró ninguna pestaña de mes con fila "Acumulado Total".');

  // Último día realmente cargado: las pestañas traen 30-31 columnas siempre,
  // pero el mes en curso solo tiene llenas las primeras.
  const ultimoDia = function (serie) {
    let i = serie.length;
    while (i > 0 && (serie[i-1] === null || serie[i-1] === undefined || serie[i-1] === 0)) i--;
    return Math.max(i, 1);
  };

  const data = { ventas: {}, leads: {}, agend: {} };
  const corte = {};
  meses.forEach(function (m) {
    corte[m] = ultimoDia(raw[m].ventas);
    data.ventas[m] = ffill(raw[m].ventas).slice(0, corte[m]);
    if (raw[m].leads) data.leads[m] = acum(raw[m].leads).slice(0, corte[m]);
    if (raw[m].agend) data.agend[m] = acum(raw[m].agend).slice(0, corte[m]);
  });

  const actual = meses[meses.length - 1];
  const hoy = corte[actual];
  const previos = meses.slice(0, -1);
  const alDia = {};
  meses.forEach(function (m) { alDia[m] = data.ventas[m][hoy - 1]; });

  const mejor = previos.reduce(function (a, b) { return alDia[a] > alDia[b] ? a : b; }, previos[0]);
  const prom  = previos.reduce(function (s, m) { return s + alDia[m]; }, 0) / previos.length;
  const puesto = meses.slice().sort(function (a, b) { return alDia[b] - alDia[a]; }).indexOf(actual) + 1;

  const fracs = previos.map(function (m) {
    const c = data.ventas[m][data.ventas[m].length - 1];
    return c ? alDia[m] / c : 0;
  }).filter(function (f) { return f > 0; });
  const fracProm = fracs.reduce(function (a, b) { return a + b; }, 0) / fracs.length;

  return {
    data: data, meses: meses, actual: actual, hoy: hoy, alDia: alDia,
    meta: META_MENSUAL, mejor: mejor, promedio: prom, puesto: puesto,
    proyLineal: alDia[actual] / hoy * 30,
    proyCurva: alDia[actual] / fracProm,
    fracProm: fracProm,
    generado: (function () {
      const b = Utilities.formatDate(new Date(), 'America/Bogota', 'd|M|yyyy|HH:mm').split('|');
      return b[0] + ' de ' + MESES[Number(b[1]) - 1].toLowerCase() + ' ' + b[2] + ', ' + b[3];
    })()
  };
}

function payloadCacheado() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('bys');
  if (hit) return JSON.parse(hit);
  const p = construirPayload();
  try { cache.put('bys', JSON.stringify(p), CACHE_SEG); } catch (e) {}
  return p;
}

function doGet(e) {
  if (e && e.parameter && e.parameter.format === 'json') {
    return ContentService.createTextOutput(JSON.stringify(payloadCacheado()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput('Agregá ?format=json a la URL.')
    .setMimeType(ContentService.MimeType.TEXT);
}

/** Corré esto antes de desplegar para confirmar que lee bien. */
function probar() {
  const p = construirPayload();
  Logger.log('Meses: ' + p.meses.join(', '));
  Logger.log('Mes en curso: ' + p.actual + ' — día ' + p.hoy);
  Logger.log('Acumulado hoy: ' + p.alDia[p.actual].toLocaleString('es-CO'));
  Logger.log('Mejor al mismo día: ' + p.mejor + ' (' + p.alDia[p.mejor].toLocaleString('es-CO') + ')');
  Logger.log('Puesto: ' + p.puesto + ' de ' + p.meses.length);
  Logger.log('Proyección de cierre: ' + Math.round(p.proyCurva).toLocaleString('es-CO'));
  p.meses.forEach(function (m) {
    const s = p.data.ventas[m];
    Logger.log('  ' + m + ': ' + s.length + ' días, cierre ' + s[s.length-1].toLocaleString('es-CO'));
  });
}
