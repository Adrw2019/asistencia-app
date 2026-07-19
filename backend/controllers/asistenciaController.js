const db = require('../config/db');
const messaging = require('../firebase');

// Función auxiliar para enviar Push Notifications a todos los dispositivos de la empresa
function sendPushToEmpresa(empresaId, titulo, mensaje) {
  if (!messaging) return;
  db.query('SELECT token FROM fcm_tokens WHERE empresa_id = ?', [empresaId], (err, rows) => {
    if (err || !rows.length) return;
    const tokens = rows.map(r => r.token);
    const payload = {
      notification: { title: titulo, body: mensaje },
      tokens: tokens
    };
    messaging.sendEachForMulticast(payload).catch(console.error);
  });
}

function toDate(fecha, hora) { return new Date(`${fecha}T${hora}`); }
function hoursBetween(a, b) { return Math.max(0, (b - a) / 3600000); }
function money(n) { return Math.round(Number(n) || 0); }

function calcular(fecha, entrada, salida, esPrimerTurno = true, config) {
  const entradaDt = toDate(fecha, entrada);
  const salidaDt = toDate(fecha, salida);
  
  // Usar configuración de la empresa o defaults
  let inicioNormal = toDate(fecha, config?.hora_entrada_esperada || '08:00:00');
  let finNormal = toDate(fecha, config?.hora_salida_esperada || '17:00:00');
  
  if (config?.modo_calculo === 2) {
    const timeInHours = entradaDt.getHours() + (entradaDt.getMinutes() / 60);
    const shifts = [6, 7, 14, 15];
    let closest = 6;
    let minDiff = 24;
    for (let s of shifts) {
      if (Math.abs(timeInHours - s) < minDiff) {
        minDiff = Math.abs(timeInHours - s);
        closest = s;
      }
    }
    const closestStr = String(closest).padStart(2, '0') + ':00:00';
    inicioNormal = toDate(fecha, closestStr);
    finNormal = new Date(inicioNormal.getTime() + 8 * 3600000); // turno de 8h
  }
  const valorDia = config?.valor_dia || 60000;
  const pagaExtras = config?.paga_extras !== 0;
  const descuentaTarde = config?.descuenta_tarde !== 0;
  
  const horasJornada = Math.max(1, hoursBetween(inicioNormal, finNormal));
  const valorHora = valorDia / horasJornada;
  const recargoExtra = 1.5;

  const horasTrabajadas = hoursBetween(entradaDt, salidaDt);
  
  let minutosTarde = 0;
  let minutosSalidaAnticipada = 0;

  if (esPrimerTurno) {
    minutosTarde = entradaDt > inicioNormal ? Math.round((entradaDt - inicioNormal) / 60000) : 0;
    minutosSalidaAnticipada = salidaDt < finNormal ? Math.round((finNormal - salidaDt) / 60000) : 0;
  }
  
  const extraAntes = entradaDt < inicioNormal ? hoursBetween(entradaDt, inicioNormal) : 0;
  const extraDespues = salidaDt > finNormal ? hoursBetween(finNormal, salidaDt) : 0;
  const horasExtra = pagaExtras ? (extraAntes + extraDespues) : 0;

  // Descuento solo si la empresa lo tiene activado
  let descuento = 0;
  if (descuentaTarde) {
    descuento = money(((minutosTarde + minutosSalidaAnticipada) / 60) * valorHora);
  }

  // Pago base hasta el valor del día, menos descuentos
  const pagoBase = Math.max(0, valorDia - descuento);
  const pagoExtras = horasExtra * valorHora * recargoExtra;
  let pago = money(pagoBase + pagoExtras);
  
  if (config?.modo_calculo === 2) {
    descuento = 0;
    pago = 0;
  }

  return {
    horas_trabajadas: Number(horasTrabajadas.toFixed(2)),
    horas_extra: Number(horasExtra.toFixed(2)),
    descuento,
    pago,
    llego_tarde: minutosTarde > 0 ? 1 : 0,
    minutos_tarde: minutosTarde,
    minutos_salida_anticipada: minutosSalidaAnticipada,
    valor_hora: Number(valorHora.toFixed(2))
  };
}

exports.scan = (req, res) => {
  const empresaId = req.user.empresa_id;
  const { cedula } = req.body;
  if (!cedula) return res.status(400).json({ success: false, message: 'Falta cédula' });

  db.query('SELECT * FROM empleados WHERE empresa_id = ? AND cedula = ? AND estado = 1 LIMIT 1', [empresaId, cedula], (err, empRows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!empRows.length) return res.status(404).json({ success: false, message: 'Empleado no encontrado en esta empresa' });
    const empleado = empRows[0];

    db.query(
      `SELECT * FROM asistencias WHERE empresa_id = $1 AND empleado_id = $2 AND hora_salida IS NULL AND fecha >= CURRENT_DATE - INTERVAL '1 DAY' ORDER BY id DESC LIMIT 1`,
      [empresaId, empleado.id],
      (e, openRows) => {
        if (e) return res.status(500).json({ success: false, message: e.message });
        const nowSql = new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' });
        const [fecha, hora] = nowSql.split(' ');

        // Si no hay turno abierto, crea nueva entrada. Esto permite doble turno ilimitado.
        if (!openRows.length) {
          db.query(
            'INSERT INTO asistencias (empresa_id, empleado_id, cedula, fecha, hora_entrada) VALUES (?,?,?,?,?) RETURNING id',
            [empresaId, empleado.id, cedula, fecha, hora],
            (insErr, result) => {
              if (insErr) return res.status(500).json({ success: false, message: insErr.message });
              return res.json({ success: true, tipo: 'entrada', message: 'Entrada registrada', asistencia_id: result.insertId, empleado, fecha, hora_entrada: hora });
            }
          );
          return;
        }

        const abierta = openRows[0];
        
        db.query(
          'SELECT COUNT(id) as count FROM asistencias WHERE empresa_id = ? AND empleado_id = ? AND fecha = ? AND id < ?',
          [empresaId, empleado.id, abierta.fecha, abierta.id],
          (cErr, cRows) => {
            if (cErr) return res.status(500).json({ success: false, message: cErr.message });
            
            const esPrimerTurno = cRows[0].count === 0;
            const d = new Date(abierta.fecha);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            
            const calc = calcular(dateStr, abierta.hora_entrada, hora, esPrimerTurno);
            
            db.query(
              `UPDATE asistencias SET hora_salida=?, pago=?, horas_trabajadas=?, horas_extra=?, descuento=?, llego_tarde=?, minutos_tarde=?, minutos_salida_anticipada=? WHERE id=? AND empresa_id=?`,
              [hora, calc.pago, calc.horas_trabajadas, calc.horas_extra, calc.descuento, calc.llego_tarde, calc.minutos_tarde, calc.minutos_salida_anticipada, abierta.id, empresaId],
              (upErr) => {
                if (upErr) return res.status(500).json({ success: false, message: upErr.message });
                return res.json({ success: true, tipo: 'salida', message: 'Salida registrada', asistencia_id: abierta.id, empleado, fecha: dateStr, hora_entrada: abierta.hora_entrada, hora_salida: hora, calculos: calc });
              }
            );
          }
        );
      }
    );
  });
};

exports.historial = (req, res) => {
  const empresaId = req.user.empresa_id;
  const { cedula, desde, hasta } = req.query;
  const params = [empresaId];
  let sql = `SELECT a.*, e.nombre, e.cargo FROM asistencias a INNER JOIN empleados e ON e.id=a.empleado_id WHERE a.empresa_id=?`;
  if (cedula) { sql += ' AND a.cedula=?'; params.push(cedula); }
  if (desde) { sql += ' AND a.fecha>=?'; params.push(desde); }
  if (hasta) { sql += ' AND a.fecha<=?'; params.push(hasta); }
  sql += ' ORDER BY a.fecha DESC, a.id DESC';
  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, data: rows });
  });
};

exports.resumen = (req, res) => {
  const empresaId = req.user.empresa_id;
  const { desde, hasta } = req.query;
  const params = [empresaId];
  let sql = `SELECT e.cedula,e.nombre,COUNT(a.id) turnos,SUM(a.horas_trabajadas) horas,SUM(a.horas_extra) extras,SUM(a.descuento) descuentos,SUM(a.pago) total FROM asistencias a INNER JOIN empleados e ON e.id=a.empleado_id WHERE a.empresa_id=? AND a.hora_salida IS NOT NULL`;
  if (desde) { sql += ' AND a.fecha>=?'; params.push(desde); }
  if (hasta) { sql += ' AND a.fecha<=?'; params.push(hasta); }
  sql += ' GROUP BY e.id,e.cedula,e.nombre ORDER BY e.nombre';
  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, data: rows });
  });
};

exports._calcular = calcular;

exports.webScan = (req, res) => {
  const { empresa_id, cedula, nombre } = req.body;
  if (!empresa_id || !cedula || !nombre) return res.status(400).json({ success: false, message: 'Faltan datos requeridos' });

  // 0. Obtener config de empresa
  db.query('SELECT hora_entrada_esperada, hora_salida_esperada, valor_dia, paga_extras, descuenta_tarde, modo_calculo FROM empresas WHERE id = ?', [empresa_id], (errConf, confRows) => {
    if (errConf) return res.status(500).json({ success: false, message: errConf.message });
    const config = confRows.length ? confRows[0] : null;

    // 1. Buscar o crear empleado
    db.query('SELECT * FROM empleados WHERE empresa_id = ? AND cedula = ? LIMIT 1', [empresa_id, cedula], (err, empRows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    
    let empleado = empRows.length ? empRows[0] : null;
    
    const procesarAsistencia = (emp) => {
      // 2. Registrar asistencia
      db.query(
        `SELECT * FROM asistencias WHERE empresa_id = $1 AND empleado_id = $2 AND hora_salida IS NULL AND fecha >= CURRENT_DATE - INTERVAL '1 DAY' ORDER BY id DESC LIMIT 1`,
        [empresa_id, emp.id],
        (e, openRows) => {
          if (e) return res.status(500).json({ success: false, message: e.message });
          const nowSql = new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' });
          const [fecha, hora] = nowSql.split(' ');

          if (!openRows.length) {
            // ENTRADA
            const inicioNormal = toDate(String(fecha), config?.hora_entrada_esperada || '08:00:00');
            const entradaDt = toDate(String(fecha), hora);
            const minutosTarde = entradaDt > inicioNormal ? Math.round((entradaDt - inicioNormal) / 60000) : 0;
            const descuentaTarde = config?.descuenta_tarde !== 0;
            
            let advertencia = null;
            if (minutosTarde > 0 && descuentaTarde) {
               if (config?.modo_calculo === 2) {
                 advertencia = { minutos: minutosTarde, descuento: 0 };
               } else {
                 const valorDia = config?.valor_dia || 60000;
                 const finNormal = toDate(String(fecha), config?.hora_salida_esperada || '17:00:00');
                 const horasJornada = Math.max(1, (finNormal - inicioNormal) / 3600000);
                 const valorHora = valorDia / horasJornada;
                 const descuento = Math.round((minutosTarde / 60) * valorHora);
                 advertencia = { minutos: minutosTarde, descuento };
               }
            }

            db.query(
              'INSERT INTO asistencias (empresa_id, empleado_id, cedula, fecha, hora_entrada) VALUES (?,?,?,?,?) RETURNING id',
              [empresa_id, emp.id, cedula, fecha, hora],
              (insErr, result) => {
                if (insErr) return res.status(500).json({ success: false, message: insErr.message });
                
                // EMITIR NOTIFICACION POR SOCKET
                const titulo = '¡Nueva Entrada!';
                const mensaje = `${emp.nombre} (C.C ${cedula}) ingresó a las ${hora}`;
                if(req.io) {
                  req.io.emit('nueva_asistencia', {
                    empresa_id: Number(empresa_id),
                    tipo: 'entrada',
                    titulo: titulo,
                    mensaje: mensaje,
                    hora: hora
                  });
                }
                sendPushToEmpresa(empresa_id, titulo, mensaje);
                
                return res.json({ success: true, tipo: 'entrada', hora, advertencia });
              }
            );
          } else {
            // SALIDA
            const abierta = openRows[0];
            db.query(
              'SELECT COUNT(id) as count FROM asistencias WHERE empresa_id = ? AND empleado_id = ? AND fecha = ? AND id < ?',
              [empresa_id, emp.id, abierta.fecha, abierta.id],
              (cErr, cRows) => {
                if (cErr) return res.status(500).json({ success: false, message: cErr.message });
                try {
                  const esPrimerTurno = cRows[0].count === 0;
                  // Parse date correctly from Date object or string
                  const d = new Date(abierta.fecha);
                  const year = d.getFullYear();
                  const month = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  const dateStr = `${year}-${month}-${day}`;
                  
                  const calc = calcular(dateStr, abierta.hora_entrada, hora, esPrimerTurno, config);
                  
                  db.query(
                    `UPDATE asistencias SET hora_salida=?, pago=?, horas_trabajadas=?, horas_extra=?, descuento=?, llego_tarde=?, minutos_tarde=?, minutos_salida_anticipada=? WHERE id=? AND empresa_id=?`,
                    [hora, calc.pago, calc.horas_trabajadas, calc.horas_extra, calc.descuento, calc.llego_tarde, calc.minutos_tarde, calc.minutos_salida_anticipada, abierta.id, empresa_id],
                    (upErr) => {
                      if (upErr) return res.status(500).json({ success: false, message: 'DB Error: ' + upErr.message });
                      
                      // EMITIR NOTIFICACION POR SOCKET
                      const titulo = '¡Nueva Salida!';
                      const mensaje = `${emp.nombre} (C.C ${cedula}) salió a las ${hora}`;
                      if(req.io) {
                        req.io.emit('nueva_asistencia', {
                          empresa_id: Number(empresa_id),
                          tipo: 'salida',
                          titulo: titulo,
                          mensaje: mensaje,
                          hora: hora
                        });
                      }
                      sendPushToEmpresa(empresa_id, titulo, mensaje);
                      
                      return res.json({ success: true, tipo: 'salida', hora, calculos: calc });
                    }
                  );
                } catch (calcError) {
                  console.error('Calculation Error:', calcError);
                  return res.status(500).json({ success: false, message: 'Calc Error: ' + calcError.message + ' | Stack: ' + calcError.stack });
                }
              }
            );
          }
        }
      );
    };

    if (empleado) {
      if (empleado.estado === 0) return res.status(400).json({ success: false, message: 'Empleado inactivo' });
      procesarAsistencia(empleado);
    } else {
      // Crear empleado si no existe
      db.query(
        'INSERT INTO empleados (empresa_id, cedula, nombre, estado) VALUES (?, ?, ?, 1) RETURNING id',
        [empresa_id, cedula, nombre],
        (insEmpErr, insEmpRes) => {
          if (insEmpErr) return res.status(500).json({ success: false, message: insEmpErr.message });
          procesarAsistencia({ id: insEmpRes.insertId, empresa_id, cedula, nombre });
        }
      );
    }
  });
  }); // fin db.query config
};

exports.delete = (req, res) => {
  db.query(
    'DELETE FROM asistencias WHERE id = ? AND empresa_id = ?',
    [req.params.id, req.user.empresa_id],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, message: 'Registro de asistencia eliminado' });
    }
  );
};
