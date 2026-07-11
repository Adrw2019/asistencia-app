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
      if (typeof callback !== 'function') {
        callback = () => {};
      }

      if (err) return callback(err, null);
      
      // Manejar el caso donde res es un array (múltiples sentencias) o undefined
      const rows = res ? (Array.isArray(res) ? res[res.length - 1].rows : res.rows) : [];
      
      // Mockear insertId para compatibilidad (se requiere RETURNING id en el SQL)
      if (res && !Array.isArray(res) && res.command === 'INSERT' && rows && rows.length > 0 && rows[0].id) {
        rows.insertId = rows[0].id;
      }
      
      callback(null, rows);
    });
  }
};
