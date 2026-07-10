const db = require("../config/db");

const findByUsername = (username, callback) => {
  const sql = "SELECT id, username FROM users WHERE username = ? LIMIT 1";
  db.query(sql, [username], callback);
};

module.exports = {
  findByUsername
};
