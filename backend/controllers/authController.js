const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db');

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username, empresa_id: user.empresa_id }, process.env.JWT_SECRET || 'clave_secreta_cambiar', { expiresIn: '12h' });
}

exports.register = (req, res) => {
  const { username, email, password, empresa_id, empresa_nombre } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, message: 'Falta usuario o contraseña' });

  const crearUsuario = (empresaId) => {
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) return res.status(500).json({ success: false, message: 'Error al encriptar contraseña' });
      db.query('INSERT INTO usuarios (username,email,password,empresa_id) VALUES (?,?,?,?) RETURNING id', [username, email || null, hash, empresaId], (e) => {
        if (e) return res.status(500).json({ success: false, message: e.message });
        res.json({ success: true, message: 'Administrador registrado', empresa_id: empresaId });
      });
    });
  };

  if (empresa_id) return crearUsuario(empresa_id);
  db.query('INSERT INTO empresas (nombre, correo) VALUES (?,?) RETURNING id', [empresa_nombre || 'Empresa Principal', email || null], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    crearUsuario(result.insertId || (result[0] && result[0].id));
  });
};

exports.login = (req, res) => {
  const { username, email, password } = req.body;
  const userName = username || email;
  if (!userName || !password) return res.status(400).json({ success: false, message: 'Falta usuario y contraseña' });

  const sql = `SELECT u.*, e.nombre AS empresa_nombre FROM usuarios u LEFT JOIN empresas e ON e.id = u.empresa_id WHERE u.username = ? OR u.email = ? LIMIT 1`;
  db.query(sql, [userName, userName], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!rows.length) return res.status(401).json({ success: false, message: 'Usuario no encontrado' });
    const user = rows[0];
    const finish = (ok) => {
      if (!ok) return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
      const token = signToken(user);
      res.json({ success: true, token, user: { id: user.id, username: user.username, email: user.email, empresa_id: user.empresa_id, empresa_nombre: user.empresa_nombre } });
    };
    if ((user.password || '').startsWith('$2')) bcrypt.compare(password, user.password, (e, ok) => finish(!e && ok));
    else finish(password === user.password);
  });
};

exports.fix = (req, res) => {
  const db = require('../config/db');
  db.query("UPDATE usuarios SET password = ? WHERE username = 'admin'", ['$2b$10$Kx00svRA418M1ieQoWsD7Ozc7LnW3oNxXdkqe2WNqlMpyMnVzTUz6'], () => {
    res.json({done:true});
  });
};
