const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/asistencia',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

module.exports = {
  query: (text, params, callback) => {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }

    // Reemplazar ? por $1, $2, etc. de forma segura (sin regex complejas)
    let pgText = '';
    let paramIndex = 1;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '?') {
        pgText += '$' + paramIndex;
        paramIndex++;
      } else {
        pgText += text[i];
      }
    }

    pool.query(pgText, params, (err, res) => {
      if (err) return callback(err, null);
      
      // Mockear insertId para compatibilidad (se requiere RETURNING id en el SQL)
      if (res.command === 'INSERT' && res.rows.length > 0 && res.rows[0].id) {
        res.rows.insertId = res.rows[0].id;
      }
      
      callback(null, res.rows);
    });
  }
};
