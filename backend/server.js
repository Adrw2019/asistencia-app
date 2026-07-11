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

// Inicializar la base de datos PostgreSQL
initDB();

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

app.use('/public', express.static(path.join(__dirname, 'public')));

app.get('/descargar-app', (req, res) => {
  res.download(path.join(__dirname, 'public', 'app-release.apk'));
});

const port = process.env.PORT || 5000;
server.listen(port, '0.0.0.0', () => console.log(`Servidor funcionando en http://localhost:${port}`));
