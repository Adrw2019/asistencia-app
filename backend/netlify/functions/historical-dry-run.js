const crypto = require('crypto');
const db = require('../../config/db');
const { _calcular } = require('../../controllers/asistenciaController');

/** Helper to ensure only SELECT statements are executed */
function safeQuery(sql, params) {
  const trimmed = sql.trim().toUpperCase();
  if (!trimmed.startsWith('SELECT')) {
    throw new Error('Only SELECT statements are allowed');
  }
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

/** Validate and parse integer query param */
function parseIntParam(value, name, min, max) {
  if (value === undefined) throw new Error(`${name} is required`);
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return num;
}

/** Secure token comparison */
function verifyToken(reqToken, envToken) {
  const tokenBuf = Buffer.from(reqToken);
  const envBuf = Buffer.from(envToken);
  if (tokenBuf.length !== envBuf.length) return false;
  return crypto.timingSafeEqual(tokenBuf, envBuf);
}

/** Format Date to SQL string (YYYY-MM-DD) */
function formatFechaSql(fechaVal) {
  if (!fechaVal) return '';
  if (fechaVal instanceof Date) {
    const year = fechaVal.getFullYear();
    const month = String(fechaVal.getMonth() + 1).padStart(2, '0');
    const day = String(fechaVal.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const str = String(fechaVal);
  if (str.includes('T')) return str.split('T')[0];
  if (str.includes(' ')) return str.split(' ')[0];
  return str;
}

/** Safely parse numeric fields */
function parseSafeNumeric(val, fieldName) {
  if (val === null || val === undefined || val === '') return 0;
  const num = Number(val);
  if (Number.isNaN(num)) {
    throw new Error(`Invalid numeric value in ${fieldName}: ${val}`);
  }
  return num;
}

/** Validate date and time fields */
function validateDateTime(fecha, entrada, salida) {
  if (!fecha) throw new Error('Missing fecha');
  if (!entrada) throw new Error('Missing hora_entrada');
  if (!salida) throw new Error('Missing hora_salida');
}

/** Netlify function entry point */
exports.handler = async function (event, context) {
  try {
    // Only allow GET
    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, body: JSON.stringify({ success: false, message: 'Method Not Allowed' }) };
    }

    const adminToken = process.env.HISTORICAL_ADMIN_TOKEN;
    if (!adminToken) {
      return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Server configuration error' }) };
    }

    const authHeader = event.headers['authorization'] || event.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { statusCode: 401, body: JSON.stringify({ success: false, message: 'Unauthorized' }) };
    }
    const providedToken = authHeader.slice('Bearer '.length).trim();
    if (!verifyToken(providedToken, adminToken)) {
      return { statusCode: 401, body: JSON.stringify({ success: false, message: 'Unauthorized' }) };
    }

    if (!process.env.DATABASE_URL) {
      return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Database not configured' }) };
    }

    const params = event.queryStringParameters || {};
    const action = params.action;
    if (!action) {
      return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Missing action' }) };
    }

    // Action: companies
    if (action === 'companies') {
      const rows = await safeQuery('SELECT id, nombre FROM empresas ORDER BY nombre', []);
      return { statusCode: 200, body: JSON.stringify({ success: true, companies: rows }) };
    }

    // Action: dry-run
    if (action === 'dry-run') {
      const empresaId = params.empresa_id;
      const year = parseIntParam(params.year, 'year', 2000, 2100);
      const month = parseIntParam(params.month, 'month', 1, 12);
      if (!empresaId) throw new Error('empresa_id is required');

      // Verify company exists and fetch config
      const companyRows = await safeQuery(
        'SELECT id, nombre, hora_entrada_esperada, hora_salida_esperada, valor_dia, paga_extras, descuenta_tarde, modo_calculo, requiere_gps, latitud, longitud FROM empresas WHERE id = ?',
        [empresaId]
      );
      if (!companyRows.length) {
        return { statusCode: 404, body: JSON.stringify({ success: false, message: 'Empresa no encontrada' }) };
      }
      const config = companyRows[0];

      // Compute start and end of month
      const startMonth = String(month).padStart(2, '0');
      const startDate = `${year}-${startMonth}-01`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

      // Fetch attendance records for period with required fields
      const rows = await safeQuery(
        `SELECT a.id AS asistencia_id, a.empleado_id, a.fecha, a.hora_entrada, a.hora_salida,
                a.horas_recargo, a.horas_extra, a.horas_nocturnas,
                a.valor_recargo, a.valor_extra,
                e.nombre AS empleado, e.turno AS turno
         FROM asistencias a
         JOIN empleados e ON e.id = a.empleado_id AND e.empresa_id = a.empresa_id
         WHERE a.empresa_id = ?
           AND a.fecha >= ?
           AND a.fecha < ?
           AND a.hora_entrada IS NOT NULL
           AND a.hora_salida IS NOT NULL
         ORDER BY a.empleado_id ASC, a.fecha ASC, a.hora_entrada ASC, a.id ASC`,
        [empresaId, startDate, endDate]
      );

      const result = {
        empresa: config.nombre || null,
        empresa_id: empresaId,
        periodo: `${year}-${String(month).padStart(2, '0')}`,
        total_registros: rows.length,
        sin_cambios: 0,
        diferencias_historicas: 0,
        requiere_revision: 0,
        totales_actuales: { horas_recargo: 0, horas_extra: 0, horas_nocturnas: 0, valor_recargo: 0, valor_extra: 0 },
        totales_recalculados: { horas_recargo: 0, horas_extra: 0, horas_nocturnas: 0, valor_recargo: 0, valor_extra: 0 },
        diferencias: [] // Will now only contain differences or revision items
      };

      const tolerance = 0.01;
      let lastEmpleadoFecha = '';

      for (const r of rows) {
        // Determine esPrimerTurno matching production logic
        const formattedFecha = formatFechaSql(r.fecha);
        const currentEmpleadoFecha = `${r.empleado_id}-${formattedFecha}`;
        const esPrimerTurno = (currentEmpleadoFecha !== lastEmpleadoFecha);
        lastEmpleadoFecha = currentEmpleadoFecha;

        let actual;
        try {
          actual = {
            horas_recargo: parseSafeNumeric(r.horas_recargo, 'horas_recargo'),
            horas_extra: parseSafeNumeric(r.horas_extra, 'horas_extra'),
            horas_nocturnas: parseSafeNumeric(r.horas_nocturnas, 'horas_nocturnas'),
            valor_recargo: parseSafeNumeric(r.valor_recargo, 'valor_recargo'),
            valor_extra: parseSafeNumeric(r.valor_extra, 'valor_extra')
          };
          
          validateDateTime(r.fecha, r.hora_entrada, r.hora_salida);
        } catch (e) {
          result.requiere_revision++;
          result.diferencias.push({
            asistencia_id: r.asistencia_id,
            empleado: r.empleado,
            fecha: formattedFecha,
            entrada: r.hora_entrada,
            salida: r.hora_salida,
            actual: { horas_recargo: r.horas_recargo, horas_extra: r.horas_extra, horas_nocturnas: r.horas_nocturnas, valor_recargo: r.valor_recargo, valor_extra: r.valor_extra },
            calculado: null,
            clasificacion: 'REQUIERE_REVISION',
            error: e.message
          });
          continue;
        }

        // Aggregate actual totals
        result.totales_actuales.horas_recargo += actual.horas_recargo;
        result.totales_actuales.horas_extra += actual.horas_extra;
        result.totales_actuales.horas_nocturnas += actual.horas_nocturnas;
        result.totales_actuales.valor_recargo += actual.valor_recargo;
        result.totales_actuales.valor_extra += actual.valor_extra;

        let calculadoRaw;
        try {
          calculadoRaw = _calcular(formattedFecha, r.hora_entrada, r.hora_salida, esPrimerTurno, config, r.turno);
        } catch (e) {
          result.requiere_revision++;
          result.diferencias.push({
            asistencia_id: r.asistencia_id,
            empleado: r.empleado,
            fecha: formattedFecha,
            entrada: r.hora_entrada,
            salida: r.hora_salida,
            actual,
            calculado: null,
            clasificacion: 'REQUIERE_REVISION',
            error: e.message
          });
          continue;
        }

        let calculated;
        try {
           calculated = {
            horas_recargo: parseSafeNumeric(calculadoRaw.horas_recargo, 'calculated_horas_recargo'),
            horas_extra: parseSafeNumeric(calculadoRaw.horas_extra, 'calculated_horas_extra'),
            horas_nocturnas: parseSafeNumeric(calculadoRaw.horas_nocturnas, 'calculated_horas_nocturnas'),
            valor_recargo: parseSafeNumeric(calculadoRaw.valor_recargo, 'calculated_valor_recargo'),
            valor_extra: parseSafeNumeric(calculadoRaw.valor_extra, 'calculated_valor_extra')
          };
        } catch (e) {
          result.requiere_revision++;
          result.diferencias.push({
            asistencia_id: r.asistencia_id,
            empleado: r.empleado,
            fecha: formattedFecha,
            entrada: r.hora_entrada,
            salida: r.hora_salida,
            actual,
            calculado: null,
            clasificacion: 'REQUIERE_REVISION',
            error: e.message
          });
          continue;
        }

        // Aggregate recalculated totals
        result.totales_recalculados.horas_recargo += calculated.horas_recargo;
        result.totales_recalculados.horas_extra += calculated.horas_extra;
        result.totales_recalculados.horas_nocturnas += calculated.horas_nocturnas;
        result.totales_recalculados.valor_recargo += calculated.valor_recargo;
        result.totales_recalculados.valor_extra += calculated.valor_extra;

        const diff = {
          horas_recargo: Math.abs(actual.horas_recargo - calculated.horas_recargo),
          horas_extra: Math.abs(actual.horas_extra - calculated.horas_extra),
          horas_nocturnas: Math.abs(actual.horas_nocturnas - calculated.horas_nocturnas),
          valor_recargo: Math.abs(actual.valor_recargo - calculated.valor_recargo),
          valor_extra: Math.abs(actual.valor_extra - calculated.valor_extra)
        };
        const hasDifference = Object.values(diff).some(d => d > tolerance);

        if (hasDifference) {
          result.diferencias_historicas++;
          result.diferencias.push({
            asistencia_id: r.asistencia_id,
            empleado: r.empleado,
            fecha: formattedFecha,
            entrada: r.hora_entrada,
            salida: r.hora_salida,
            actual,
            calculado: calculated,
            clasificacion: 'DIFERENCIA_HISTORICA'
          });
        } else {
          result.sin_cambios++;
          // Not adding SIN_CAMBIOS to the array
        }
      }

      return { statusCode: 200, body: JSON.stringify(result) };
    }

    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Invalid action' }) };
  } catch (err) {
    console.error('historical-dry-run error:', err);
    return { statusCode: 500, body: JSON.stringify({ success: false, message: err.message }) };
  }
};
