const db = require('../config/db');

const JORNADA = {
  lunes_sabado: { entrada: '08:00:00', salida: '17:30:00', horas: 9.5 },
  domingo: { entrada: '09:00:00', salida: '14:00:00', horas: 5 }
};
const VALOR_DIA = 60000;
const RECARGO_EXTRA = 1.5;

function toDate(fecha, hora) { return new Date(`${fecha}T${hora}`); }
function hoursBetween(a, b) { return Math.max(0, (b - a) / 3600000); }
function money(n) { return Math.round(Number(n) || 0); }
function horario(fecha) {
  const d = new Date(`${fecha}T12:00:00`);
  return d.getDay() === 0 ? JORNADA.domingo : JORNADA.lunes_sabado;
}

function calcular(fecha, entrada, salida, esPrimerTurno = true) {
  const h = horario(fecha);
  const entradaDt = toDate(fecha, entrada);
  const salidaDt = toDate(fecha, salida);
  const inicioNormal = toDate(fecha, h.entrada);
  const finNormal = toDate(fecha, h.salida);
  const valorHora = VALOR_DIA / h.horas;

  const horasTrabajadas = hoursBetween(entradaDt, salidaDt);
  
  let minutosTarde = 0;
  let minutosSalidaAnticipada = 0;

  if (esPrimerTurno) {
    minutosTarde = entradaDt > inicioNormal ? Math.round((entradaDt - inicioNormal) / 60000) : 0;
    minutosSalidaAnticipada = salidaDt < finNormal ? Math.round((finNormal - salidaDt) / 60000) : 0;
  }
  
  const extraAntes = entradaDt < inicioNormal ? hoursBetween(entradaDt, inicioNormal) : 0;
  const extraDespues = salidaDt > finNormal ? hoursBetween(finNormal, salidaDt) : 0;
  const horasExtra = extraAntes + extraDespues;

  // Descuento solo por tiempo que faltó dentro de la jornada normal: llegada tarde + salida anticipada.
  const descuento = money(((minutosTarde + minutosSalidaAnticipada) / 60) * valorHora);

  // Pago normal proporcional máximo hasta 1 día, menos descuentos, más extras al 150%.
  const pagoBase = Math.max(0, VALOR_DIA - descuento);
  const pagoExtras = horasExtra * valorHora * RECARGO_EXTRA;
  const pago = money(pagoBase + pagoExtras);

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
      'SELECT * FROM asistencias WHERE empresa_id = ? AND empleado_id = ? AND hora_salida IS NULL AND fecha >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) ORDER BY id DESC LIMIT 1',
      [empresaId, empleado.id],
      (e, openRows) => {
        if (e) return res.status(500).json({ success: false, message: e.message });
        const nowSql = new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' });
        const [fecha, hora] = nowSql.split(' ');

        // Si no hay turno abierto, crea nueva entrada. Esto permite doble turno ilimitado.
        if (!openRows.length) {
          db.query(
            'INSERT INTO asistencias (empresa_id, empleado_id, cedula, fecha, hora_entrada) VALUES (?,?,?,?,?)',
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
            const calc = calcular(String(abierta.fecha).slice(0, 10), abierta.hora_entrada, hora, esPrimerTurno);
            
            db.query(
              `UPDATE asistencias SET hora_salida=?, pago=?, horas_trabajadas=?, horas_extra=?, descuento=?, llego_tarde=?, minutos_tarde=?, minutos_salida_anticipada=? WHERE id=? AND empresa_id=?`,
              [hora, calc.pago, calc.horas_trabajadas, calc.horas_extra, calc.descuento, calc.llego_tarde, calc.minutos_tarde, calc.minutos_salida_anticipada, abierta.id, empresaId],
              (upErr) => {
                if (upErr) return res.status(500).json({ success: false, message: upErr.message });
                return res.json({ success: true, tipo: 'salida', message: 'Salida registrada', asistencia_id: abierta.id, empleado, fecha: String(abierta.fecha).slice(0, 10), hora_entrada: abierta.hora_entrada, hora_salida: hora, calculos: calc });
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
