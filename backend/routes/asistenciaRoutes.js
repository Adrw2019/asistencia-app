const express = require('express');
const router = express.Router();
const auth = require('../config/authMiddleware');
const c = require('../controllers/asistenciaController');
router.post('/scan', auth, c.scan);
router.get('/historial', auth, c.historial);
router.get('/resumen', auth, c.resumen);
module.exports = router;
