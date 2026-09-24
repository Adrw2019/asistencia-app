const express = require('express');
const router = express.Router();
const auth = require('../config/authMiddleware');
const c = require('../controllers/notificacionController');

router.get('/no-leidas', auth, c.getNoLeidas);
router.get('/', auth, c.getNotificaciones);
router.patch('/marcar-todas', auth, c.marcarTodasLeidas);
router.patch('/:id/leida', auth, c.marcarLeida);

module.exports = router;
