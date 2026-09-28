const { Pool } = require('pg');
require('dotenv').config();

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
console.log('DATABASE_URL presente:', hasDatabaseUrl);
console.log('Entorno:', process.env.NETLIFY ? 'Netlify' : 'otro');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no está configurada');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function normalizeQuery(text) {
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

  return pgText;
}

module.exports = {
  query: (text, params, callback) => {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }

    const pgText = normalizeQuery(text);

    pool.query(pgText, params, (err, res) => {
      if (typeof callback !== 'function') {
        callback = () => {};
      }

      if (err) return callback(err, null);
      
      const rows = res ? (Array.isArray(res) ? res[res.length - 1].rows : res.rows) : [];
      
      if (res && !Array.isArray(res) && res.command === 'INSERT' && rows && rows.length > 0 && rows[0].id) {
        rows.insertId = rows[0].id;
      }
      
      callback(null, rows);
    });
  },

  getClient: async () => {
    const client = await pool.connect();

    return {
      query: (text, params = []) => {
        const pgText = normalizeQuery(text);
        return client.query(pgText, params);
      },

      release: () => client.release()
    };
  }
};
