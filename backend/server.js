require('dotenv').config();
const express = require('express');
const initDB = require('./initDB');
const cors = require('cors');
const db = require('./config/db');
const path = require('path');
const QRCode = require('qrcode');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Inicializar la base de datos PostgreSQL si se ejecuta directamente
if (require.main === module) {
  initDB();
}

app.use((req, res, next) => {
  req.io = io;
  next();
});
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => res.json({ ok: true, app: 'Asistencia Multiempresa' }));
app.get('/api/health', (req, res) => {
  db.query('SELECT 1 AS ok', (err) => {
    if (err) return res.status(500).json({ success: false, database: 'error', message: err.message });
    res.json({ success: true, database: 'ok' });
  });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/employees', require('./routes/employeeRoutes'));
app.use('/api/asistencias', require('./routes/asistenciaRoutes'));
app.use('/api/empresas', require('./routes/empresaRoutes'));

app.use('/public', express.static(path.join(__dirname, 'public')));

app.get('/descargar-app', (req, res) => {
  res.download(path.join(__dirname, 'public', 'app-release.apk'));
});

app.get('/imprimir-qr', async (req, res) => {
  try {
    const empresaId = req.query.empresa_id;
    if (!empresaId) return res.status(400).send('Falta empresa_id');
    const baseUrl = process.env.APP_URL || 'https://asistencia-app-92to.onrender.com';
    const url = `${baseUrl}/public/formulario.html?empresa=${empresaId}`;
    const qrImage = await QRCode.toBuffer(url, { width: 500, margin: 2 });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'attachment; filename="qr_empleados.png"');
    res.send(qrImage);
  } catch (err) {
    res.status(500).send('Error generando QR');
  }
});

if (require.main === module) {
  const port = process.env.PORT || 5000;
  server.listen(port, '0.0.0.0', () => console.log(`Servidor funcionando en http://localhost:${port}`));
}

module.exports = app;
module.exports.server = server;
module.exports.io = io;
