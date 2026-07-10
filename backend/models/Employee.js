const db = require('../config/database');

const Employee = {
  create: (data, callback) => {
    const { cedula, nombre, celular, cargo } = data;
    const query = 'INSERT INTO empleados (cedula, nombre, celular, cargo) VALUES (?, ?, ?, ?)';
    db.query(query, [cedula, nombre, celular, cargo], callback);
  },

  getAll: (callback) => {
    db.query('SELECT * FROM empleados', callback);
  },

  getByCedula: (cedula, callback) => {
    db.query('SELECT * FROM empleados WHERE cedula = ?', [cedula], callback);
  }
};

module.exports = Employee;