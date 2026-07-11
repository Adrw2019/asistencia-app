const db = require('../config/db');

exports.getConfig = (req, res) => {
  const empresaId = req.user.empresa_id;
  db.query('SELECT hora_entrada_esperada, hora_salida_esperada, valor_dia, paga_extras, descuenta_tarde FROM empresas WHERE id = ?', [empresaId], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!rows.length) return res.status(404).json({ success: false, message: 'Empresa no encontrada' });
    res.json({ success: true, data: rows[0] });
  });
};

exports.updateConfig = (req, res) => {
  const empresaId = req.user.empresa_id;
  const { hora_entrada, hora_salida, valor_dia, paga_extras, descuenta_tarde } = req.body;
  
  db.query(
    'UPDATE empresas SET hora_entrada_esperada = ?, hora_salida_esperada = ?, valor_dia = ?, paga_extras = ?, descuenta_tarde = ? WHERE id = ?',
    [hora_entrada, hora_salida, valor_dia, paga_extras, descuenta_tarde, empresaId],
    (err) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, message: 'Configuración actualizada' });
    }
  );
};
