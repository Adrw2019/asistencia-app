const db = require('../config/db');
const messaging = require('../firebase');

// Función auxiliar para enviar Push Notifications a todos los dispositivos de la empresa
function sendPushToEmpresa(empresaId, titulo, mensaje) {
  if (!messaging) return;
  db.query('SELECT token FROM fcm_tokens WHERE empresa_id = ?', [empresaId], (err, rows) => {
    if (err || !rows.length) return;
    const tokens = rows.map(r => r.token).filter(Boolean);
    if (!tokens.length) return;

    const payload = {
      notification: { title: titulo, body: mensaje },
      data: {
        titulo: titulo,
        mensaje: mensaje
      },
      webpush: {
        notification: {
          title: titulo,
          body: mensaje,
          icon: '/icons/Icon-192.png',
          badge: '/icons/Icon-192.png',
          requireInteraction: false
        },
        fcmOptions: {
          link: '/'
        }
      },
      tokens: tokens
    };

    messaging.sendEachForMulticast(payload).then((response) => {
      if (response && response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success && resp.error) {
            const code = resp.error.code;
            if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
              db.query('DELETE FROM fcm_tokens WHERE token = ?', [tokens[idx]]);
            }
          }
        });
      }
    }).catch(console.error);
  });
}

function guardarNotificacion({ empresa_id, empleado_id, tipo, titulo, mensaje, horas_trabajadas = null }) {
  db.query(
    'INSERT INTO notificaciones (empresa_id, empleado_id, tipo, titulo, mensaje, horas_trabajadas) VALUES (?, ?, ?, ?, ?, ?)',
    [empresa_id, empleado_id || null, tipo, titulo, mensaje, horas_trabajadas],
    (err) => {
      if (err) console.error('Error guardando notificación:', err);
    }
  );
}

function toDate(fecha, hora) { return new Date(`${fecha}T${hora}`); }
function hoursBetween(a, b) { return Math.max(0, (b - a) / 3600000); }
function money(n) { return Math.round(Number(n) || 0); }

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

function getOverlapHours(startDt, endDt, blockStartMins, blockEndMins) {
  let overlapMs = 0;
  let currentDt = new Date(startDt.getTime());
  while (currentDt < endDt) {
    const h = currentDt.getHours();
    const m = currentDt.getMinutes();
    const mins = h * 60 + m;
    const inBlock = (mins >= blockStartMins && mins < blockEndMins);
    
    const s = currentDt.getSeconds();
    const ms = currentDt.getMilliseconds();
    const remainingInMinute = 60000 - (s * 1000 + ms);
    const step = Math.min(remainingInMinute, endDt.getTime() - currentDt.getTime());
    
    if (inBlock) {
      overlapMs += step;
    }
    currentDt = new Date(currentDt.getTime() + step);
  }
  return overlapMs / 3600000;
}

function checkDebounce(empresaId, empleadoId, nowDt, callback) {
  db.query(
    'SELECT * FROM asistencias WHERE empresa_id = ? AND empleado_id = ? ORDER BY id DESC LIMIT 1',
    [empresaId, empleadoId],
    (err, rows) => {
      if (err) return callback(err, null);
      if (!rows.length) return callback(null, { blocked: false });

      const ultimo = rows[0];
      const uFecha = formatFechaSql(ultimo.fecha);

      if (ultimo.hora_salida) {
        const exitDt = toDate(uFecha, ultimo.hora_salida);
        const diffMs = nowDt.getTime() - exitDt.getTime();
        if (diffMs >= 0 && diffMs < 60000) {
          return callback(null, {
            blocked: true,
            tipo: 'salida',
            message: 'Ya registraste tu salida hace unos segundos. Por favor espera un momento.'
          });
        }
      } else if (ultimo.hora_entrada) {
        const entryDt = toDate(uFecha, ultimo.hora_entrada);
        const diffMs = nowDt.getTime() - entryDt.getTime();
        if (diffMs >= 0 && diffMs < 60000) {
          return callback(null, {
            blocked: true,
            tipo: 'entrada',
            message: 'Ya registraste tu entrada hace unos segundos. Por favor espera un momento.'
          });
        }
      }
      return callback(null, { blocked: false });
    }
  );
}

function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371e3; // Radio de la tierra en m
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; 
}

function calcular(fecha, entrada, salida, esPrimerTurno = true, config, turnoStr = '06:00') {
  const entradaDt = toDate(fecha, entrada);
  let salidaDt = toDate(fecha, salida);
  
  // Si la hora de salida es menor a la de entrada, significa que salió al día siguiente
  if (salidaDt < entradaDt) {
    salidaDt.setDate(salidaDt.getDate() + 1);
  }
  
  // Usar configuración de la empresa o defaults
  let inicioNormal = toDate(fecha, config?.hora_entrada_esperada || '08:00:00');
  let finNormal = toDate(fecha, config?.hora_salida_esperada || '17:00:00');
  
  if (config?.modo_calculo === 2) {
    const t = (turnoStr && turnoStr.length >= 5) ? turnoStr : '06:00';
    inicioNormal = toDate(fecha, t + ':00');
    finNormal = new Date(inicioNormal.getTime() + 8 * 3600000); // turno de 8h
  }
  const valorDia = config?.valor_dia || 60000;
  const pagaExtras = config?.paga_extras !== 0;
  const descuentaTarde = config?.descuenta_tarde !== 0;
  
  const horasJornada = Math.max(1, hoursBetween(inicioNormal, finNormal));
  const valorHora = valorDia / horasJornada;
  const recargoExtra = 1.5;

  const horasTrabajadas = hoursBetween(entradaDt, salidaDt);

  const r1 = getOverlapHours(entradaDt, salidaDt, 360, 480);
  const r2 = getOverlapHours(entradaDt, salidaDt, 1200, 1260);
  let horasRecargo = r1 + r2;
  let horasExtra = getOverlapHours(entradaDt, salidaDt, 1260, 1320);
  const horasNocturnas = getOverlapHours(entradaDt, salidaDt, 1320, 1380);

  if (!pagaExtras) {
    horasRecargo = 0;
    horasExtra = 0;
  }
  
  let minutosTarde = 0;
  let minutosSalidaAnticipada = 0;

  if (esPrimerTurno) {
    minutosTarde = entradaDt > inicioNormal ? Math.round((entradaDt - inicioNormal) / 60000) : 0;
    if (minutosTarde <= 5) minutosTarde = 0; // Tolerancia de 5 minutos
    minutosSalidaAnticipada = salidaDt < finNormal ? Math.round((finNormal - salidaDt) / 60000) : 0;
  }
  
  // Descuento solo si la empresa lo tiene activado
  let descuento = 0;
  if (descuentaTarde) {
    descuento = money(((minutosTarde + minutosSalidaAnticipada) / 60) * valorHora);
  }

  const valorRecargoTotal = money(horasRecargo * 2700);
  const valorExtraTotal = money(horasExtra * 14000);

  // Pago base hasta el valor del día, menos descuentos
  const pagoBase = Math.max(0, valorDia - descuento);
  const pagoExtras = valorRecargoTotal + valorExtraTotal;
  let pago = money(pagoBase + pagoExtras);
  
  if (config?.modo_calculo === 2) {
    descuento = 0;
    pago = 0;
  }

  return {
    horas_trabajadas: Number(horasTrabajadas.toFixed(2)),
    horas_extra: Number(horasExtra.toFixed(2)),
    horas_nocturnas: Number(horasNocturnas.toFixed(2)),
    horas_recargo: Number(horasRecargo.toFixed(2)),
    valor_recargo: valorRecargoTotal,
    valor_extra: valorExtraTotal,
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

  db.query('SELECT hora_entrada_esperada, hora_salida_esperada, valor_dia, paga_extras, descuenta_tarde, modo_calculo, requiere_gps, latitud, longitud FROM empresas WHERE id = ?', [empresaId], (errConf, confRows) => {
    if (errConf) return res.status(500).json({ success: false, message: errConf.message });
    const config = confRows.length ? confRows[0] : null;

    db.query('SELECT * FROM empleados WHERE empresa_id = ? AND cedula = ? AND estado = 1 LIMIT 1', [empresaId, cedula], (err, empRows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!empRows.length) return res.status(404).json({ success: false, message: 'Empleado no encontrado en esta empresa' });
    const empleado = empRows[0];

    const nowSql = new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' });
    const [fecha, hora] = nowSql.split(' ');
    const nowDt = toDate(fecha, hora);

    checkDebounce(empresaId, empleado.id, nowDt, (debErr, debResult) => {
      if (debErr) return res.status(500).json({ success: false, message: debErr.message });
      if (debResult && debResult.blocked) {
        return res.status(400).json({ success: false, message: debResult.message });
      }

      db.query(
        `SELECT * FROM asistencias WHERE empresa_id = ? AND empleado_id = ? AND hora_salida IS NULL AND fecha >= CURRENT_DATE - INTERVAL '1 DAY' ORDER BY id DESC LIMIT 1`,
        [empresaId, empleado.id],
        (e, openRows) => {
          if (e) return res.status(500).json({ success: false, message: e.message });

          // Si no hay turno abierto, crea nueva entrada. Esto permite doble turno ilimitado.
          if (!openRows.length) {
            db.query(
              'INSERT INTO asistencias (empresa_id, empleado_id, cedula, fecha, hora_entrada) VALUES (?,?,?,?,?) RETURNING id',
              [empresaId, empleado.id, cedula, fecha, hora],
              (insErr, result) => {
                if (insErr) return res.status(500).json({ success: false, message: insErr.message });
                const titulo = 'Nueva entrada registrada';
                const mensaje = `${empleado.nombre}\nEntrada: ${hora}`;
                sendPushToEmpresa(empresaId, titulo, mensaje);
                return res.json({ success: true, tipo: 'entrada', message: 'Entrada registrada', asistencia_id: result.insertId, empleado, fecha, hora_entrada: hora });
              }
            );
            return;
          }

          const abierta = openRows[0];
          const dateStr = formatFechaSql(abierta.fecha);
          const diffHours = hoursBetween(toDate(dateStr, abierta.hora_entrada), toDate(fecha, hora));

          if (diffHours > 16) {
            // Olvidó marcar salida. Cerramos el anterior (0 horas) y marcamos nueva entrada.
            db.query('UPDATE asistencias SET hora_salida=? WHERE id=? AND empresa_id=?', [abierta.hora_entrada, abierta.id, empresaId], () => {
              db.query('INSERT INTO asistencias (empresa_id, empleado_id, cedula, fecha, hora_entrada) VALUES (?,?,?,?,?) RETURNING id', [empresaId, empleado.id, cedula, fecha, hora], (insErr, result) => {
                if (insErr) return res.status(500).json({ success: false, message: insErr.message });
                const titulo = 'Nueva entrada registrada';
                const mensaje = `${empleado.nombre}\nEntrada: ${hora}`;
                sendPushToEmpresa(empresaId, titulo, mensaje);
                return res.json({ success: true, tipo: 'entrada', message: 'Entrada registrada (Turno anterior cerrado por olvido)', asistencia_id: result.insertId, empleado, fecha, hora_entrada: hora });
              });
            });
            return;
          }

          db.query(
            'SELECT COUNT(id) as count FROM asistencias WHERE empresa_id = ? AND empleado_id = ? AND fecha = ? AND id < ?',
            [empresaId, empleado.id, abierta.fecha, abierta.id],
            (cErr, cRows) => {
              if (cErr) return res.status(500).json({ success: false, message: cErr.message });
              
              const esPrimerTurno = cRows[0].count === 0;
              
              const calc = calcular(dateStr, abierta.hora_entrada, hora, esPrimerTurno, config, empleado.turno);
              
              db.query(
                `UPDATE asistencias SET hora_salida=?, pago=?, horas_trabajadas=?, horas_extra=?, horas_nocturnas=?, horas_recargo=?, valor_recargo=?, valor_extra=?, descuento=?, llego_tarde=?, minutos_tarde=?, minutos_salida_anticipada=? WHERE id=? AND empresa_id=?`,
                [hora, calc.pago, calc.horas_trabajadas, calc.horas_extra, calc.horas_nocturnas, calc.horas_recargo, calc.valor_recargo, calc.valor_extra, calc.descuento, calc.llego_tarde, calc.minutos_tarde, calc.minutos_salida_anticipada, abierta.id, empresaId],
                (upErr) => {
                  if (upErr) return res.status(500).json({ success: false, message: upErr.message });
                  const titulo = 'Salida registrada';
                  const mensaje = `${empleado.nombre}\nSalida: ${hora}\nHoras trabajadas: ${calc.horas_trabajadas} h`;
                  sendPushToEmpresa(empresaId, titulo, mensaje);
                  return res.json({ success: true, tipo: 'salida', message: 'Salida registrada', asistencia_id: abierta.id, empleado, fecha: dateStr, hora_entrada: abierta.hora_entrada, hora_salida: hora, calculos: calc });
                }
              );
            }
          );
        }
      );
    });
  });
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
  let sql = `SELECT e.cedula,e.nombre,COUNT(a.id) turnos,SUM(a.horas_trabajadas) horas,SUM(a.horas_extra) extras,SUM(a.horas_nocturnas) nocturnas,COALESCE(SUM(a.horas_recargo), 0) recargos,COALESCE(SUM(a.valor_recargo), 0) valor_recargos,COALESCE(SUM(a.valor_extra), 0) valor_extras,SUM(a.descuento) descuentos,SUM(a.pago) total FROM asistencias a INNER JOIN empleados e ON e.id=a.empleado_id WHERE a.empresa_id=? AND a.hora_salida IS NOT NULL`;
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
  const { empresa_id, cedula, nombre, lat, lng } = req.body;
  if (!empresa_id || !cedula || !nombre) return res.status(400).json({ success: false, message: 'Faltan datos requeridos' });

  // 0. Obtener config de empresa
  db.query('SELECT hora_entrada_esperada, hora_salida_esperada, valor_dia, paga_extras, descuenta_tarde, modo_calculo, requiere_gps, latitud, longitud FROM empresas WHERE id = ?', [empresa_id], (errConf, confRows) => {
    if (errConf) return res.status(500).json({ success: false, message: errConf.message });
    const config = confRows.length ? confRows[0] : null;

    if (config?.requiere_gps === 1) {
      if (!lat || !lng) {
        return res.status(400).json({ success: false, message: 'Se requiere ubicación GPS para registrar asistencia.' });
      }
      const distance = getDistanceFromLatLonInM(lat, lng, config.latitud, config.longitud);
      if (distance > 50) {
        return res.status(400).json({ success: false, message: `Estás fuera de la zona permitida (${Math.round(distance)}m de distancia).` });
      }
    }

    // 1. Buscar o crear empleado
    db.query('SELECT * FROM empleados WHERE empresa_id = ? AND cedula = ? LIMIT 1', [empresa_id, cedula], (err, empRows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    
    let empleado = empRows.length ? empRows[0] : null;
    
    const procesarAsistencia = (emp) => {
      const nowSql = new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' });
      const [fecha, hora] = nowSql.split(' ');
      const nowDt = toDate(fecha, hora);

      // Debounce: evitar doble registro dentro de 60 segundos por empleado
      checkDebounce(empresa_id, emp.id, nowDt, (debErr, debResult) => {
        if (debErr) return res.status(500).json({ success: false, message: debErr.message });
        if (debResult && debResult.blocked) {
          return res.status(400).json({ success: false, message: debResult.message });
        }

        // 2. Registrar asistencia
        db.query(
          `SELECT * FROM asistencias WHERE empresa_id = ? AND empleado_id = ? AND hora_salida IS NULL AND fecha >= CURRENT_DATE - INTERVAL '1 DAY' ORDER BY id DESC LIMIT 1`,
          [empresa_id, emp.id],
          (e, openRows) => {
            if (e) return res.status(500).json({ success: false, message: e.message });

            if (!openRows.length) {
              // ENTRADA
              let inicioNormal;
              if (config?.modo_calculo === 2) {
                const t = (emp.turno && emp.turno.length >= 5) ? emp.turno : '06:00';
                inicioNormal = toDate(String(fecha), t + ':00');
              } else {
                inicioNormal = toDate(String(fecha), config?.hora_entrada_esperada || '08:00:00');
              }
              const entradaDt = toDate(String(fecha), hora);
              let minutosTarde = entradaDt > inicioNormal ? Math.round((entradaDt - inicioNormal) / 60000) : 0;
              if (minutosTarde <= 5) minutosTarde = 0; // Tolerancia de 5 minutos
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
                  
                  // Guardar en tabla notificaciones
                  guardarNotificacion({
                    empresa_id,
                    empleado_id: emp.id,
                    tipo: 'entrada',
                    titulo: 'Nueva entrada',
                    mensaje: `${emp.nombre} - Entrada: ${hora}`
                  });

                  const titulo = '¡Nueva Entrada!';
                  const mensaje = `${emp.nombre} (C.C ${cedula}) ingresó a las ${hora}`;
                  
                  // EMITIR NOTIFICACION POR SOCKET
                  if(req.io) {
                    req.io.emit('nueva_asistencia', {
                      empresa_id: Number(empresa_id),
                      tipo: 'entrada',
                      titulo: titulo,
                      mensaje: mensaje,
                      hora: hora
                    });
                  }

                  // EMITIR NOTIFICACION POR PUSH MULTICAST
                  sendPushToEmpresa(empresa_id, titulo, mensaje);
                  
                  return res.json({ success: true, tipo: 'entrada', hora, advertencia });
                }
              );
            } else {
              // SALIDA
              const abierta = openRows[0];
              const dateStr = formatFechaSql(abierta.fecha);
              
              const diffHours = hoursBetween(toDate(dateStr, abierta.hora_entrada), toDate(fecha, hora));
              if (diffHours > 16) {
                // Olvidó marcar salida. Cerramos el anterior con 0 horas (hora_salida = hora_entrada).
                db.query('UPDATE asistencias SET hora_salida=? WHERE id=? AND empresa_id=?', [abierta.hora_entrada, abierta.id, empresa_id], () => {
                  procesarAsistencia(emp); // Volver a procesar para registrar como ENTRADA
                });
                return;
              }

              db.query(
                'SELECT COUNT(id) as count FROM asistencias WHERE empresa_id = ? AND empleado_id = ? AND fecha = ? AND id < ?',
                [empresa_id, emp.id, abierta.fecha, abierta.id],
                (cErr, cRows) => {
                  if (cErr) return res.status(500).json({ success: false, message: cErr.message });
                  try {
                    const esPrimerTurno = cRows[0].count === 0;
                    
                    const calc = calcular(dateStr, abierta.hora_entrada, hora, esPrimerTurno, config, emp.turno);
                    
                    db.query(
                      `UPDATE asistencias SET hora_salida=?, pago=?, horas_trabajadas=?, horas_extra=?, horas_nocturnas=?, horas_recargo=?, valor_recargo=?, valor_extra=?, descuento=?, llego_tarde=?, minutos_tarde=?, minutos_salida_anticipada=? WHERE id=? AND empresa_id=?`,
                      [hora, calc.pago, calc.horas_trabajadas, calc.horas_extra, calc.horas_nocturnas, calc.horas_recargo, calc.valor_recargo, calc.valor_extra, calc.descuento, calc.llego_tarde, calc.minutos_tarde, calc.minutos_salida_anticipada, abierta.id, empresa_id],
                      (upErr) => {
                        if (upErr) return res.status(500).json({ success: false, message: 'DB Error: ' + upErr.message });
                        
                        // Guardar en tabla notificaciones
                        guardarNotificacion({
                          empresa_id,
                          empleado_id: emp.id,
                          tipo: 'salida',
                          titulo: 'Nueva salida',
                          mensaje: `${emp.nombre} - Salida: ${hora} - Horas trabajadas: ${calc.horas_trabajadas} h`,
                          horas_trabajadas: calc.horas_trabajadas
                        });

                        const titulo = '¡Nueva Salida!';
                        const mensaje = `${emp.nombre} (C.C ${cedula}) salió a las ${hora}`;

                        // EMITIR NOTIFICACION POR SOCKET
                        if(req.io) {
                          req.io.emit('nueva_asistencia', {
                            empresa_id: Number(empresa_id),
                            tipo: 'salida',
                            titulo: titulo,
                            mensaje: mensaje,
                            hora: hora
                          });
                        }

                        // EMITIR NOTIFICACION POR PUSH MULTICAST
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
      });
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

exports.deleteMes = (req, res) => {
  const empresaId = req.user.empresa_id;
  const { desde, hasta } = req.query;
  
  if (!desde || !hasta) return res.status(400).json({ success: false, message: 'Faltan fechas desde y hasta' });

  db.query(
    'DELETE FROM asistencias WHERE empresa_id = ? AND fecha >= ? AND fecha <= ?',
    [empresaId, desde, hasta],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, message: `Se eliminaron ${result.affectedRows} registros del mes seleccionado.` });
    }
  );
};
