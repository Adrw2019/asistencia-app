const db = require('../config/db');

exports.create = (req, res) => {
  const empresaId = req.user.empresa_id;
  const { cedula, nombre, celular, cargo } = req.body;
  if (!cedula || !nombre) return res.status(400).json({ success: false, message: 'Cédula y nombre son obligatorios' });
  db.query(
    'INSERT INTO empleados (empresa_id, cedula, nombre, celular, cargo, estado) VALUES (?,?,?,?,?,1) RETURNING id',
    [empresaId, cedula, nombre, celular || null, cargo || null],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, message: 'Empleado registrado', id: result.insertId });
    }
  );
};

exports.getAll = (req, res) => {
  db.query('SELECT * FROM empleados WHERE empresa_id = ? AND estado = 1 ORDER BY nombre', [req.user.empresa_id], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, data: rows });
  });
};

exports.getByCedula = (req, res) => {
  db.query('SELECT * FROM empleados WHERE empresa_id = ? AND cedula = ? LIMIT 1', [req.user.empresa_id, req.params.cedula], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!rows.length) return res.status(404).json({ success: false, message: 'Empleado no encontrado' });
    res.json({ success: true, data: rows[0] });
  });
};

exports.delete = (req, res) => {
  db.query(
    'UPDATE empleados SET estado = 0 WHERE id = ? AND empresa_id = ?',
    [req.params.id, req.user.empresa_id],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, message: 'Empleado eliminado' });
    }
  );
};
