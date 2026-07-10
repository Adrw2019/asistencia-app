const db = require("../config/db");

const check = (req, res) => {
  db.query("SELECT 1 AS ok", (error) => {
    if (error) {
      return res.status(500).json({
        status: "error",
        database: "disconnected",
        message: error.message
      });
    }

    return res.json({
      status: "ok",
      database: "connected"
    });
  });
};

module.exports = {
  check
};
