const express = require('express');
const router = express.Router();
const auth = require('../config/authMiddleware');
const c = require('../controllers/EmployeeController');
router.get('/', auth, c.getAll);
router.post('/register', auth, c.create);
router.get('/:cedula', auth, c.getByCedula);
module.exports = router;
