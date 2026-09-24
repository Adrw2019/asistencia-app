const db = require('../config/db');

exports.getNoLeidas = (req, res) => {
  const empresaId = req.user?.empresa_id;
  if (!empresaId) return res.status(401).json({ success: false, message: 'No autorizado' });

  db.query('SELECT COUNT(id) AS count FROM notificaciones WHERE empresa_id = ? AND leida = 0', [empresaId], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    const count = rows && rows.length ? parseInt(rows[0].count, 10) || 0 : 0;
    res.json({ success: true, count });
  });
};

exports.getNotificaciones = (req, res) => {
  const empresaId = req.user?.empresa_id;
  if (!empresaId) return res.status(401).json({ success: false, message: 'No autorizado' });

  const sql = `
    SELECT n.*, e.nombre AS empleado_nombre 
    FROM notificaciones n 
    LEFT JOIN empleados e ON e.id = n.empleado_id 
    WHERE n.empresa_id = ? 
    ORDER BY n.created_at DESC, n.id DESC 
    LIMIT 30
  `;

  db.query(sql, [empresaId], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, data: rows || [] });
  });
};

exports.marcarLeida = (req, res) => {
  const empresaId = req.user?.empresa_id;
  const notificacionId = req.params.id;
  if (!empresaId) return res.status(401).json({ success: false, message: 'No autorizado' });
  if (!notificacionId) return res.status(400).json({ success: false, message: 'Falta ID de notificación' });

  db.query('UPDATE notificaciones SET leida = 1 WHERE id = ? AND empresa_id = ?', [notificacionId, empresaId], (err) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, message: 'Notificación marcada como leída' });
  });
};

exports.marcarTodasLeidas = (req, res) => {
  const empresaId = req.user?.empresa_id;
  if (!empresaId) return res.status(401).json({ success: false, message: 'No autorizado' });

  db.query('UPDATE notificaciones SET leida = 1 WHERE empresa_id = ? AND leida = 0', [empresaId], (err) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, message: 'Todas las notificaciones fueron marcadas como leídas' });
  });
};
