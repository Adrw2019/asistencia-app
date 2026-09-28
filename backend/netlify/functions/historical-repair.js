const crypto = require('crypto');
const db = require('../../config/db');
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

function finiteNumber(value, fieldName) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`Valor numérico inválido en ${fieldName}: ${value}`);
  }
  return n;
}

function parseSafeNumeric(val, fieldName) {
  if (val === null || val === undefined || val === '') return 0;
  return finiteNumber(val, fieldName);
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

// -------------------------------------------------------------------
// Helper SQL - Not called automatically, provided for manual execution
// -------------------------------------------------------------------
function getMaintenanceTablesSQL() {
  return `
    CREATE TABLE IF NOT EXISTS reparaciones_log (
      backup_run_id UUID PRIMARY KEY,
      empresa_id INTEGER NOT NULL,
      anio INTEGER NOT NULL,
      mes INTEGER NOT NULL,
      estado VARCHAR(20) NOT NULL CHECK (estado IN ('PREPARADA', 'COMPLETADA', 'RESTAURADA', 'FALLIDA')),
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completado_en TIMESTAMP NULL,
      restaurado_en TIMESTAMP NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_unica_reparacion_exitosa 
    ON reparaciones_log (empresa_id, anio, mes) 
    WHERE estado = 'COMPLETADA';

    CREATE TABLE IF NOT EXISTS asistencias_reparacion_backup (
      backup_row_id BIGSERIAL PRIMARY KEY,
      backup_run_id UUID NOT NULL REFERENCES reparaciones_log(backup_run_id),
      asistencia_id INTEGER NOT NULL,
      empresa_id INTEGER NOT NULL,
      empleado_id INTEGER NOT NULL,
      fecha DATE NOT NULL,
      hora_entrada TIME NOT NULL,
      hora_salida TIME,
      horas_recargo_original DECIMAL(10,2),
      horas_extra_original DECIMAL(10,2),
      horas_nocturnas_original DECIMAL(10,2),
      valor_recargo_original INTEGER,
      valor_extra_original INTEGER,
      backup_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (backup_run_id, asistencia_id)
    );
  `;
}

// -------------------------------------------------------------------
// Core Logic: shared between preview and repair
// -------------------------------------------------------------------
async function buildRepairPlan(queryFn, empresaId, year, month, config) {
  const startMonth = String(month).padStart(2, '0');
  const startDate = `${year}-${startMonth}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  const rows = await queryFn(
    `SELECT a.id AS asistencia_id, a.empleado_id, a.fecha, a.hora_entrada, a.hora_salida,
            a.horas_recargo, a.horas_extra, a.horas_nocturnas,
            a.valor_recargo, a.valor_extra,
            e.nombre AS empleado, e.turno AS turno
     FROM asistencias a
     JOIN empleados e ON e.id = a.empleado_id AND e.empresa_id = a.empresa_id
     WHERE a.empresa_id = $1 AND a.fecha >= $2 AND a.fecha < $3 AND a.hora_entrada IS NOT NULL AND a.hora_salida IS NOT NULL
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
    detalles_afectados: [],
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
      const vrRaw = parseSafeNumeric(r.valor_recargo, 'valor_recargo');
      const veRaw = parseSafeNumeric(r.valor_extra, 'valor_extra');
      if (!Number.isInteger(vrRaw) || !Number.isInteger(veRaw)) {
        throw new Error('Valor monetario actual no es entero');
      }

      actual = {
        horas_recargo: parseSafeNumeric(r.horas_recargo, 'horas_recargo'),
        horas_extra: parseSafeNumeric(r.horas_extra, 'horas_extra'),
        horas_nocturnas: parseSafeNumeric(r.horas_nocturnas, 'horas_nocturnas'),
        valor_recargo: vrRaw,
        valor_extra: veRaw
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
      const cvrRaw = parseSafeNumeric(calculadoRaw.valor_recargo, 'calc_vr');
      const cveRaw = parseSafeNumeric(calculadoRaw.valor_extra, 'calc_ve');
      if (!Number.isInteger(cvrRaw) || !Number.isInteger(cveRaw)) {
        throw new Error('Cálculo produjo valores monetarios no enteros');
      }

      calculated = {
        horas_recargo: parseSafeNumeric(calculadoRaw.horas_recargo, 'calc_hr'),
        horas_extra: parseSafeNumeric(calculadoRaw.horas_extra, 'calc_he'),
        horas_nocturnas: parseSafeNumeric(calculadoRaw.horas_nocturnas, 'calc_hn'),
        valor_recargo: cvrRaw,
        valor_extra: cveRaw
      };
    } catch(e) {
      periodo_completo.requiere_revision++;
      continue;
    }

    const hasDifference = 
      Math.abs(actual.horas_recargo - calculated.horas_recargo) > tolerance ||
      Math.abs(actual.horas_extra - calculated.horas_extra) > tolerance ||
      Math.abs(actual.horas_nocturnas - calculated.horas_nocturnas) > tolerance ||
      actual.valor_recargo !== calculated.valor_recargo ||
      actual.valor_extra !== calculated.valor_extra;
    
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
      registros_a_cambiar.detalles_afectados.push({ originalRow: r, actual, calculated });
      
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

  return { periodo_completo, registros_a_cambiar };
}

// -------------------------------------------------------------------
// Repair Implementation (UNREACHABLE FROM HANDLER)
// -------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
async function executeRepair(empresaId, year, month, config) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    // 1. Advisory Lock
    const lockKey = `historical-repair:${empresaId}:${year}:${month}`;
    await client.query('SELECT pg_advisory_xact_lock(hashtext(?))', [lockKey]);

    // 2 & 3. Comprobar log
    const checkLog = await client.query(`SELECT 1 FROM reparaciones_log WHERE empresa_id=? AND anio=? AND mes=? AND estado='COMPLETADA'`, [empresaId, year, month]);
    if (checkLog.rowCount > 0) throw new Error('Ya existe una reparación completada para este período.');

    // 4. Construir plan 
    const queryFn = (sql, p) => client.query(sql, p).then(res => res.rows);
    const plan = await buildRepairPlan(queryFn, empresaId, year, month, config);

    // 5. Verificar requiere_revision
    if (plan.periodo_completo.requiere_revision > 0) throw new Error(`Existen ${plan.periodo_completo.requiere_revision} registros que requieren revisión (datos inválidos).`);

    // 6. Verificar registros_a_cambiar
    if (plan.periodo_completo.registros_a_cambiar === 0) throw new Error('No hay registros diferentes para reparar.');

    // Validar duplicados
    const affectedIds = plan.registros_a_cambiar.ids_afectados;
    if (new Set(affectedIds).size !== affectedIds.length) {
      throw new Error('Duplicados detectados en el conjunto de IDs a reparar.');
    }

    // 7 & 8. RunId y Log PREPARADA
    const runId = crypto.randomUUID();
    await client.query(`INSERT INTO reparaciones_log (backup_run_id, empresa_id, anio, mes, estado) VALUES (?, ?, ?, ?, 'PREPARADA')`, [runId, empresaId, year, month]);

    // 9. FOR UPDATE
    const lockedRowsRes = await client.query(
      `SELECT id, horas_recargo, horas_extra, horas_nocturnas, valor_recargo, valor_extra 
       FROM asistencias WHERE id = ANY(?::int[]) AND empresa_id=? FOR UPDATE`,
      [affectedIds, empresaId]
    );

    if (lockedRowsRes.rowCount !== affectedIds.length) throw new Error('No se pudieron bloquear todos los registros esperados (cantidad incorrecta).');
    
    const lockedIds = new Set(lockedRowsRes.rows.map(r => parseInt(r.id, 10)));
    for (const id of affectedIds) {
      if (!lockedIds.has(parseInt(id, 10))) throw new Error(`Registro ${id} no encontrado en el conjunto bloqueado.`);
    }

    const lockedMap = {};
    for (const lr of lockedRowsRes.rows) {
      const vr = parseSafeNumeric(lr.valor_recargo, 'vr');
      const ve = parseSafeNumeric(lr.valor_extra, 've');
      if (!Number.isInteger(vr) || !Number.isInteger(ve)) throw new Error(`Dinero no es entero en BD: ${lr.id}`);
      
      lockedMap[lr.id] = {
        horas_recargo: parseSafeNumeric(lr.horas_recargo, 'hr'),
        horas_extra: parseSafeNumeric(lr.horas_extra, 'he'),
        horas_nocturnas: parseSafeNumeric(lr.horas_nocturnas, 'hn'),
        valor_recargo: vr,
        valor_extra: ve
      };
    }

    const tolerance = 0.01;
    for (const d of plan.registros_a_cambiar.detalles_afectados) {
      const lr = lockedMap[d.originalRow.asistencia_id];
      if (!lr) throw new Error(`Registro ${d.originalRow.asistencia_id} no bloqueado.`);
      
      const diffHr = Math.abs(lr.horas_recargo - d.actual.horas_recargo);
      const diffHe = Math.abs(lr.horas_extra - d.actual.horas_extra);
      const diffHn = Math.abs(lr.horas_nocturnas - d.actual.horas_nocturnas);
      const diffVr = lr.valor_recargo !== d.actual.valor_recargo;
      const diffVe = lr.valor_extra !== d.actual.valor_extra;

      if (diffHr > tolerance || diffHe > tolerance || diffHn > tolerance || diffVr || diffVe) {
        throw new Error(`Registro ${d.originalRow.asistencia_id} cambió entre la lectura inicial y el bloqueo.`);
      }
    }

    // 10 & 11. Insertar backup
    let backupInserted = 0;
    for (const d of plan.registros_a_cambiar.detalles_afectados) {
      const row = d.originalRow;
      // Guardar el valor exacto de la base de datos (incluso si es NULL) para el backup
      const resBackup = await client.query(`
        INSERT INTO asistencias_reparacion_backup 
        (backup_run_id, asistencia_id, empresa_id, empleado_id, fecha, hora_entrada, hora_salida, 
         horas_recargo_original, horas_extra_original, horas_nocturnas_original, valor_recargo_original, valor_extra_original) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        runId, row.asistencia_id, empresaId, row.empleado_id, formatFechaSql(row.fecha), row.hora_entrada, row.hora_salida,
        row.horas_recargo, row.horas_extra, row.horas_nocturnas, row.valor_recargo, row.valor_extra
      ]);
      backupInserted += resBackup.rowCount;
    }
    
    if (backupInserted !== affectedIds.length) throw new Error('No se guardaron todos los backups.');
    
    const countCheck = await client.query(`SELECT COUNT(*) as c FROM asistencias_reparacion_backup WHERE backup_run_id=?`, [runId]);
    if (parseInt(countCheck.rows[0].c, 10) !== affectedIds.length) {
      throw new Error('Discrepancia en el conteo real de asistencias_reparacion_backup en SQL.');
    }

    // 12. Actualizar asistencias
    let updatedCount = 0;
    for (const d of plan.registros_a_cambiar.detalles_afectados) {
      const calc = d.calculated;
      const resUpdate = await client.query(`
        UPDATE asistencias 
        SET horas_recargo=?, horas_extra=?, horas_nocturnas=?, valor_recargo=?, valor_extra=? 
        WHERE id=? AND empresa_id=?
      `, [calc.horas_recargo, calc.horas_extra, calc.horas_nocturnas, calc.valor_recargo, calc.valor_extra, d.originalRow.asistencia_id, empresaId]);
      updatedCount += resUpdate.rowCount;
    }
    if (updatedCount !== backupInserted) throw new Error('Discrepancia entre backups y actualizaciones.');

    // 13. Validación individual post-UPDATE
    const postUpdateRowsRes = await client.query(
      `SELECT id, horas_recargo, horas_extra, horas_nocturnas, valor_recargo, valor_extra 
       FROM asistencias WHERE id = ANY(?::int[]) AND empresa_id=?`,
      [affectedIds, empresaId]
    );

    if (postUpdateRowsRes.rowCount !== affectedIds.length) {
      throw new Error('Discrepancia de cantidad en validación post-UPDATE individual.');
    }

    const postUpdateIds = new Set(postUpdateRowsRes.rows.map(r => parseInt(r.id, 10)));
    for (const id of affectedIds) {
      if (!postUpdateIds.has(parseInt(id, 10))) throw new Error(`Registro ${id} perdido en validación post-UPDATE.`);
    }

    const postUpdateMap = {};
    for (const r of postUpdateRowsRes.rows) {
      postUpdateMap[r.id] = r;
    }

    for (const d of plan.registros_a_cambiar.detalles_afectados) {
      const dbRow = postUpdateMap[d.originalRow.asistencia_id];
      const calc = d.calculated;

      const postHr = parseSafeNumeric(dbRow.horas_recargo, 'postHr');
      const postHe = parseSafeNumeric(dbRow.horas_extra, 'postHe');
      const postHn = parseSafeNumeric(dbRow.horas_nocturnas, 'postHn');
      
      const postVr = parseSafeNumeric(dbRow.valor_recargo, 'postVr');
      const postVe = parseSafeNumeric(dbRow.valor_extra, 'postVe');

      if (!Number.isInteger(postVr) || !Number.isInteger(postVe)) {
        throw new Error(`Dinero post-update no es entero en fila ${d.originalRow.asistencia_id}`);
      }

      const diffHr = Math.abs(postHr - calc.horas_recargo);
      const diffHe = Math.abs(postHe - calc.horas_extra);
      const diffHn = Math.abs(postHn - calc.horas_nocturnas);

      if (diffHr > tolerance || diffHe > tolerance || diffHn > tolerance) {
        throw new Error(`Fila ${d.originalRow.asistencia_id} falló validación individual de horas.`);
      }

      if (postVr !== calc.valor_recargo || postVe !== calc.valor_extra) {
        throw new Error(`Fila ${d.originalRow.asistencia_id} falló validación individual monetaria.`);
      }
    }

    // 14 & 15. Validación de totales post-UPDATE
    const startMonth = String(month).padStart(2, '0');
    const startDate = `${year}-${startMonth}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const finalTotalsRes = await client.query(
      `SELECT SUM(horas_recargo) as shr, SUM(horas_extra) as she, SUM(horas_nocturnas) as shn, 
              SUM(valor_recargo) as svr, SUM(valor_extra) as sve
       FROM asistencias 
       WHERE empresa_id=$1 AND fecha >= $2 AND fecha < $3 AND hora_entrada IS NOT NULL AND hora_salida IS NOT NULL`,
      [empresaId, startDate, endDate]
    );

    const finalRow = finalTotalsRes.rows[0];
    const postHr = parseSafeNumeric(finalRow.shr, 'shr');
    const postHe = parseSafeNumeric(finalRow.she, 'she');
    const postHn = parseSafeNumeric(finalRow.shn, 'shn');
    
    const postVr = parseSafeNumeric(finalRow.svr, 'svr');
    const postVe = parseSafeNumeric(finalRow.sve, 'sve');
    if (!Number.isInteger(postVr) || !Number.isInteger(postVe)) throw new Error('Post-Update dinero sum no es entero');

    const expectHr = plan.periodo_completo.totales_despues.horas_recargo;
    const expectHe = plan.periodo_completo.totales_despues.horas_extra;
    const expectHn = plan.periodo_completo.totales_despues.horas_nocturnas;
    const expectVr = plan.periodo_completo.totales_despues.valor_recargo;
    const expectVe = plan.periodo_completo.totales_despues.valor_extra;

    if (Math.abs(postHr - expectHr) > tolerance) throw new Error(`Discrepancia total HR: ${postHr} vs ${expectHr}`);
    if (Math.abs(postHe - expectHe) > tolerance) throw new Error(`Discrepancia total HE: ${postHe} vs ${expectHe}`);
    if (Math.abs(postHn - expectHn) > tolerance) throw new Error(`Discrepancia total HN: ${postHn} vs ${expectHn}`);
    if (postVr !== expectVr) throw new Error(`Discrepancia total VR: ${postVr} vs ${expectVr}`);
    if (postVe !== expectVe) throw new Error(`Discrepancia total VE: ${postVe} vs ${expectVe}`);

    // 17. Marcar COMPLETADA
    const completeRes = await client.query(
      `UPDATE reparaciones_log SET estado='COMPLETADA', completado_en=NOW() WHERE backup_run_id=? AND estado='PREPARADA'`, 
      [runId]
    );
    if (completeRes.rowCount !== 1) {
      throw new Error('Fallo al transicionar estado de PREPARADA a COMPLETADA');
    }
    
    // 18. COMMIT
    await client.query('COMMIT');
    return { success: true, runId, updatedCount };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// -------------------------------------------------------------------
// Restore Implementation (UNREACHABLE FROM HANDLER)
// -------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
async function executeRestore(runId) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    // 1. SIN FOR UPDATE consultar info de log para Lock determinista
    const logCheckRes = await client.query(`SELECT empresa_id, anio, mes, estado FROM reparaciones_log WHERE backup_run_id=?`, [runId]);
    if (logCheckRes.rowCount === 0) throw new Error('Reparación no encontrada.');
    let logRow = logCheckRes.rows[0];
    if (logRow.empresa_id !== 13) throw new Error('Solo empresa 13 permitida');

    const empresaId = logRow.empresa_id;
    const year = logRow.anio;
    const month = logRow.mes;

    // 2. EL MISMO LOCK QUE REPAIR
    const lockKey = `historical-repair:${empresaId}:${year}:${month}`;
    await client.query('SELECT pg_advisory_xact_lock(hashtext(?))', [lockKey]);

    // 3. Volver a consultar con FOR UPDATE para confirmar el estado atómicamente
    const logCheckUpdateRes = await client.query(`SELECT empresa_id, anio, mes, estado FROM reparaciones_log WHERE backup_run_id=? FOR UPDATE`, [runId]);
    if (logCheckUpdateRes.rowCount === 0) throw new Error('Log desaparecido.');
    logRow = logCheckUpdateRes.rows[0];
    if (logRow.empresa_id !== empresaId || logRow.anio !== year || logRow.mes !== month || logRow.estado !== 'COMPLETADA') {
      throw new Error('Estado o metadatos de la reparación cambiaron concurrentemente o no están listos para restore.');
    }

    const backups = await client.query(`SELECT * FROM asistencias_reparacion_backup WHERE backup_run_id=?`, [runId]);
    if (backups.rowCount === 0) throw new Error('No se encontraron registros de backup.');

    const affectedIds = backups.rows.map(b => b.asistencia_id);
    if (new Set(affectedIds).size !== affectedIds.length) {
      throw new Error('Duplicados detectados en el backup.');
    }

    const lockedRowsRes = await client.query(`SELECT id FROM asistencias WHERE id = ANY(?::int[]) AND empresa_id=? FOR UPDATE`, [affectedIds, empresaId]);
    if (lockedRowsRes.rowCount !== affectedIds.length) throw new Error('No se pudieron bloquear todas las asistencias a restaurar.');

    const lockedIds = new Set(lockedRowsRes.rows.map(r => parseInt(r.id, 10)));
    for (const id of affectedIds) {
      if (!lockedIds.has(parseInt(id, 10))) throw new Error(`Registro ${id} no bloqueado en restore.`);
    }

    let restoredCount = 0;
    for (const b of backups.rows) {
      const res = await client.query(`
        UPDATE asistencias 
        SET horas_recargo=?, horas_extra=?, horas_nocturnas=?, valor_recargo=?, valor_extra=?
        WHERE id=? AND empresa_id=?
      `, [b.horas_recargo_original, b.horas_extra_original, b.horas_nocturnas_original, b.valor_recargo_original, b.valor_extra_original, b.asistencia_id, empresaId]);
      restoredCount += res.rowCount;
    }

    if (restoredCount !== backups.rowCount) throw new Error('Discrepancia en la restauración');

    // Validación post-restore para verificar escritura exacta (con NULL support)
    const recheckedRows = await client.query(
      `SELECT id, horas_recargo, horas_extra, horas_nocturnas, valor_recargo, valor_extra 
       FROM asistencias WHERE id = ANY(?::int[]) AND empresa_id=?`,
      [affectedIds, empresaId]
    );

    const recheckedMap = {};
    for (const rr of recheckedRows.rows) {
      recheckedMap[rr.id] = rr;
    }

    const tolerance = 0.01;
    for (const b of backups.rows) {
      const post = recheckedMap[b.asistencia_id];
      if (!post) throw new Error(`Restore verificación: No se encontró id ${b.asistencia_id}`);

      // Helper check function para comparar nullable values
      const checkVal = (orig, curr, isMoney) => {
        if (orig === null && curr !== null) throw new Error('Se esperaba NULL y se obtuvo valor');
        if (orig !== null && curr === null) throw new Error('Se esperaba valor y se obtuvo NULL');
        if (orig === null && curr === null) return;
        
        const numOrig = finiteNumber(orig, 'orig');
        const numCurr = finiteNumber(curr, 'curr');

        if (isMoney) {
          if (!Number.isInteger(numOrig) || !Number.isInteger(numCurr)) throw new Error('Monto no entero en restore check');
          if (numOrig !== numCurr) throw new Error('Monto exacto no coincide en restore');
        } else {
          if (Math.abs(numOrig - numCurr) > tolerance) throw new Error('Horas no coinciden en restore');
        }
      };

      checkVal(b.horas_recargo_original, post.horas_recargo, false);
      checkVal(b.horas_extra_original, post.horas_extra, false);
      checkVal(b.horas_nocturnas_original, post.horas_nocturnas, false);
      checkVal(b.valor_recargo_original, post.valor_recargo, true);
      checkVal(b.valor_extra_original, post.valor_extra, true);
    }

    const restoreRes = await client.query(
      `UPDATE reparaciones_log SET estado='RESTAURADA', restaurado_en=NOW() WHERE backup_run_id=? AND estado='COMPLETADA'`, 
      [runId]
    );
    if (restoreRes.rowCount !== 1) {
      throw new Error('Fallo al transicionar estado de COMPLETADA a RESTAURADA');
    }
    await client.query('COMMIT');
    
    return { success: true, restoredCount };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// -------------------------------------------------------------------
// PUBLIC HANDLER
// -------------------------------------------------------------------
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

      const queryFn = (sql, p) => safeQuery(sql, p);
      const plan = await buildRepairPlan(queryFn, empresaId, year, month, config);

      delete plan.registros_a_cambiar.detalles_afectados;

      return { statusCode: 200, body: JSON.stringify({ success: true, preview: plan }) };
    }

    // STRICTLY ENFORCED: REPAIR AND RESTORE ARE BLOCKED
    if (action === 'repair' || action === 'restore') {
      return { statusCode: 403, body: JSON.stringify({ success: false, message: 'Feature not enabled yet. Security preview only.' }) };
    }

    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Invalid action' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ success: false, message: err.message }) };
  }
};
