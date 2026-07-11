const express = require('express');
const router = express.Router();
const empresa = require('../controllers/empresaController');
const auth = require('../middlewares/auth');

router.get('/config', auth, empresa.getConfig);
router.post('/config', auth, empresa.updateConfig);

module.exports = router;
