const crypto = require('crypto');
const db = require('../../config/db'); // Currently DOES NOT EXPORT pool.connect()
const { _calcular } = require('../../controllers/asistenciaController');

function verifyToken(reqToken, envToken) {
  const tokenBuf = Buffer.from(reqToken);
  const envBuf = Buffer.from(envToken);
  if (tokenBuf.length !== envBuf.length) return false;
  return crypto.timingSafeEqual(tokenBuf, envBuf);
}

function parseIntParam(value, name, min, max) {
  if (value === undefined) throw new Error(`${name} is required`);
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return num;
}

function parseSafeNumeric(val, fieldName) {
  if (val === null || val === undefined || val === '') return 0;
  const num = Number(val);
  if (!Number.isFinite(num)) {
    throw new Error(`Invalid or non-finite numeric value in ${fieldName}: ${val}`);
  }
  return num;
}

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

function safeQuery(sql, params) {
  const trimmed = sql.trim().toUpperCase();
  if (!trimmed.startsWith('SELECT')) {
    throw new Error('Only SELECT statements are allowed in preview mode');
  }
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

exports.handler = async function (event, context) {
  try {
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ success: false, message: 'Method Not Allowed' }) };
    }

    const adminToken = process.env.HISTORICAL_ADMIN_TOKEN;
    if (!adminToken) return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Server configuration error' }) };

    const authHeader = event.headers['authorization'] || event.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return { statusCode: 401, body: JSON.stringify({ success: false, message: 'Unauthorized' }) };
    const providedToken = authHeader.slice('Bearer '.length).trim();
    if (!verifyToken(providedToken, adminToken)) return { statusCode: 401, body: JSON.stringify({ success: false, message: 'Unauthorized' }) };

    if (!process.env.DATABASE_URL) {
      return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Database not configured' }) };
    }

    const params = event.queryStringParameters || {};
    const action = params.action;
    
    if (action === 'preview') {
      const empresaId = parseIntParam(params.empresa_id, 'empresa_id', 13, 13);
      const year = parseIntParam(params.year, 'year', 2026, 2026);
      const month = parseIntParam(params.month, 'month', 8, 9);
      
      const companyRows = await safeQuery('SELECT id, nombre, hora_entrada_esperada, hora_salida_esperada, valor_dia, paga_extras, descuenta_tarde, modo_calculo, requiere_gps, latitud, longitud FROM empresas WHERE id = ?', [empresaId]);
      if (!companyRows.length) return { statusCode: 404, body: JSON.stringify({ success: false, message: 'Empresa no encontrada' }) };
      const config = companyRows[0];

      const startMonth = String(month).padStart(2, '0');
      const startDate = `${year}-${startMonth}-01`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

      const rows = await safeQuery(
        `SELECT a.id AS asistencia_id, a.empleado_id, a.fecha, a.hora_entrada, a.hora_salida,
                a.horas_recargo, a.horas_extra, a.horas_nocturnas,
                a.valor_recargo, a.valor_extra,
                e.nombre AS empleado, e.turno AS turno
         FROM asistencias a
         JOIN empleados e ON e.id = a.empleado_id AND e.empresa_id = a.empresa_id
         WHERE a.empresa_id = ? AND a.fecha >= ? AND a.fecha < ? AND a.hora_entrada IS NOT NULL AND a.hora_salida IS NOT NULL
         ORDER BY a.empleado_id ASC, a.fecha ASC, a.hora_entrada ASC, a.id ASC`,
        [empresaId, startDate, endDate]
      );

      const periodo_completo = {
        total_registros: rows.length,
        sin_cambios: 0,
        registros_a_cambiar: 0,
        requiere_revision: 0,
        totales_antes: { horas_recargo: 0, horas_extra: 0, horas_nocturnas: 0, valor_recargo: 0, valor_extra: 0 },
        totales_despues: { horas_recargo: 0, horas_extra: 0, horas_nocturnas: 0, valor_recargo: 0, valor_extra: 0 }
      };

      const registros_a_cambiar = {
        cantidad_afectados: 0,
        ids_afectados: [],
        totales_afectados_antes: { horas_recargo: 0, horas_extra: 0, horas_nocturnas: 0, valor_recargo: 0, valor_extra: 0 },
        totales_afectados_despues: { horas_recargo: 0, horas_extra: 0, horas_nocturnas: 0, valor_recargo: 0, valor_extra: 0 }
      };

      const tolerance = 0.01;
      let lastEmpleadoFecha = '';

      for (const r of rows) {
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
        } catch(e) {
          periodo_completo.requiere_revision++;
          continue;
        }
        
        let calculadoRaw;
        try {
          calculadoRaw = _calcular(formattedFecha, r.hora_entrada, r.hora_salida, esPrimerTurno, config, r.turno);
        } catch(e) {
          periodo_completo.requiere_revision++;
          continue; 
        } 

        let calculated;
        try {
          calculated = {
            horas_recargo: parseSafeNumeric(calculadoRaw.horas_recargo, 'calc'),
            horas_extra: parseSafeNumeric(calculadoRaw.horas_extra, 'calc'),
            horas_nocturnas: parseSafeNumeric(calculadoRaw.horas_nocturnas, 'calc'),
            valor_recargo: parseSafeNumeric(calculadoRaw.valor_recargo, 'calc'),
            valor_extra: parseSafeNumeric(calculadoRaw.valor_extra, 'calc')
          };
        } catch(e) {
          periodo_completo.requiere_revision++;
          continue;
        }

        const diff = {
          horas_recargo: Math.abs(actual.horas_recargo - calculated.horas_recargo),
          horas_extra: Math.abs(actual.horas_extra - calculated.horas_extra),
          horas_nocturnas: Math.abs(actual.horas_nocturnas - calculated.horas_nocturnas),
          valor_recargo: Math.abs(actual.valor_recargo - calculated.valor_recargo),
          valor_extra: Math.abs(actual.valor_extra - calculated.valor_extra)
        };
        
        const hasDifference = Object.values(diff).some(d => d > tolerance);
        
        // Acumular siempre para periodo completo
        periodo_completo.totales_antes.horas_recargo += actual.horas_recargo;
        periodo_completo.totales_antes.horas_extra += actual.horas_extra;
        periodo_completo.totales_antes.horas_nocturnas += actual.horas_nocturnas;
        periodo_completo.totales_antes.valor_recargo += actual.valor_recargo;
        periodo_completo.totales_antes.valor_extra += actual.valor_extra;

        periodo_completo.totales_despues.horas_recargo += calculated.horas_recargo;
        periodo_completo.totales_despues.horas_extra += calculated.horas_extra;
        periodo_completo.totales_despues.horas_nocturnas += calculated.horas_nocturnas;
        periodo_completo.totales_despues.valor_recargo += calculated.valor_recargo;
        periodo_completo.totales_despues.valor_extra += calculated.valor_extra;

        if (hasDifference) {
          periodo_completo.registros_a_cambiar++;
          
          registros_a_cambiar.cantidad_afectados++;
          registros_a_cambiar.ids_afectados.push(r.asistencia_id);
          
          registros_a_cambiar.totales_afectados_antes.horas_recargo += actual.horas_recargo;
          registros_a_cambiar.totales_afectados_antes.horas_extra += actual.horas_extra;
          registros_a_cambiar.totales_afectados_antes.horas_nocturnas += actual.horas_nocturnas;
          registros_a_cambiar.totales_afectados_antes.valor_recargo += actual.valor_recargo;
          registros_a_cambiar.totales_afectados_antes.valor_extra += actual.valor_extra;
          
          registros_a_cambiar.totales_afectados_despues.horas_recargo += calculated.horas_recargo;
          registros_a_cambiar.totales_afectados_despues.horas_extra += calculated.horas_extra;
          registros_a_cambiar.totales_afectados_despues.horas_nocturnas += calculated.horas_nocturnas;
          registros_a_cambiar.totales_afectados_despues.valor_recargo += calculated.valor_recargo;
          registros_a_cambiar.totales_afectados_despues.valor_extra += calculated.valor_extra;
        } else {
          periodo_completo.sin_cambios++;
        }
      }

      return { statusCode: 200, body: JSON.stringify({ success: true, periodo_completo, registros_a_cambiar }) };
    }

    if (action === 'repair' || action === 'restore') {
      return { statusCode: 403, body: JSON.stringify({ success: false, message: 'Feature not enabled yet. Security preview only.' }) };
    }

    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Invalid action' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ success: false, message: err.message }) };
  }
};
