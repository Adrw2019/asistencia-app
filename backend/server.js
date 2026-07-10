require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
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

app.get('/qr', async (req, res) => {
  try {
    const host = req.get('host');
    const protocol = req.protocol;
    const isRender = host.includes('onrender.com');
    const baseUrl = isRender ? `https://${host}` : `${protocol}://${host}`;
    const url = `${baseUrl}/descargar-app`;
    
    const qrImage = await QRCode.toDataURL(url);
    res.send(`
      <div style="text-align:center; margin-top: 50px; font-family: sans-serif;">
        <h2>Escanea este código para descargar la App de Asistencia</h2>
        <img src="${qrImage}" style="width: 300px; height: 300px; border: 1px solid #ccc; padding: 10px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);" />
        <br/><br/>
        <a href="/descargar-app" style="text-decoration:none; padding: 10px 20px; background-color: #4CAF50; color: white; border-radius: 5px;">Descargar Directamente</a>
      </div>
    `);
  } catch (err) {
    res.status(500).send('Error generando código QR');
  }
});

const port = process.env.PORT || 5000;
app.listen(port, '0.0.0.0', () => console.log(`Servidor funcionando en http://localhost:${port}`));
