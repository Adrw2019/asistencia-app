const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
router.post('/register', auth.register);
router.post('/login', auth.login);
const authMiddleware = require('../config/authMiddleware');
router.post('/fcm-token', authMiddleware, auth.updateFCMToken);
module.exports = router;
