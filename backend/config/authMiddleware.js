const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: 'Token requerido' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'clave_secreta_cambiar');
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Token inválido' });
  }
};
