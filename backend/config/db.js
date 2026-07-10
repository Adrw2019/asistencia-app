const mysql = require('mysql');
require('dotenv').config();

const db = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'asistencia',
  charset: 'utf8mb4'
});

module.exports = db;
