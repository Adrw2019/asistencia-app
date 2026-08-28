const db = require('./config/db');

const initDB = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS empresas (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(150) NOT NULL,
      nit VARCHAR(50),
      telefono VARCHAR(50),
      correo VARCHAR(150),
      estado SMALLINT DEFAULT 1,
      hora_entrada_esperada TIME DEFAULT '08:00:00',
      hora_salida_esperada TIME DEFAULT '17:00:00',
      valor_dia INTEGER DEFAULT 60000,
      paga_extras SMALLINT DEFAULT 1,
      descuenta_tarde SMALLINT DEFAULT 1,
      modo_calculo SMALLINT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS empleados (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER NOT NULL REFERENCES empresas(id),
      nombre VARCHAR(100) NOT NULL,
      cedula VARCHAR(20) NOT NULL,
      cargo VARCHAR(50),
      celular VARCHAR(20),
      turno VARCHAR(10) DEFAULT '06:00',
      estado SMALLINT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (empresa_id, cedula)
    );

    CREATE TABLE IF NOT EXISTS asistencias (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER NOT NULL REFERENCES empresas(id),
      empleado_id INTEGER NOT NULL REFERENCES empleados(id),
      cedula VARCHAR(20) NOT NULL,
      fecha DATE NOT NULL,
      hora_entrada TIME NOT NULL,
      hora_salida TIME,
      pago INTEGER DEFAULT 0,
      horas_trabajadas DECIMAL(10,2) DEFAULT 0.00,
      horas_extra DECIMAL(10,2) DEFAULT 0.00,
      horas_nocturnas DECIMAL(10,2) DEFAULT 0.00,
      descuento INTEGER DEFAULT 0,
      llego_tarde SMALLINT DEFAULT 0,
      minutos_tarde INTEGER DEFAULT 0,
      minutos_salida_anticipada INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fcm_tokens (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER REFERENCES empresas(id),
      token VARCHAR(512) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      empresa_id INTEGER NOT NULL REFERENCES empresas(id),
      username VARCHAR(50) NOT NULL,
      email VARCHAR(100),
      password VARCHAR(255) NOT NULL,
      reset_token VARCHAR(255),
      reset_expires BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (empresa_id, username)
    );
  `;

  try {
    await new Promise((resolve, reject) => {
      db.query(query, [], (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
    });
    
    // Migraciones de esquema seguras. IF NOT EXISTS evita errores y conserva los datos existentes.
    try {
      await new Promise(r => db.query("ALTER TABLE empresas ADD COLUMN IF NOT EXISTS hora_entrada_esperada TIME DEFAULT '08:00:00'", [], r));
      await new Promise(r => db.query("ALTER TABLE empresas ADD COLUMN IF NOT EXISTS hora_salida_esperada TIME DEFAULT '17:00:00'", [], r));
      await new Promise(r => db.query("ALTER TABLE empresas ADD COLUMN IF NOT EXISTS valor_dia INTEGER DEFAULT 60000", [], r));
      await new Promise(r => db.query("ALTER TABLE empresas ADD COLUMN IF NOT EXISTS paga_extras SMALLINT DEFAULT 1", [], r));
      await new Promise(r => db.query("ALTER TABLE empresas ADD COLUMN IF NOT EXISTS descuenta_tarde SMALLINT DEFAULT 1", [], r));
      await new Promise(r => db.query("ALTER TABLE empresas ADD COLUMN IF NOT EXISTS modo_calculo SMALLINT DEFAULT 1", [], r));
      await new Promise(r => db.query("ALTER TABLE empleados ADD COLUMN IF NOT EXISTS turno VARCHAR(10) DEFAULT '06:00'", [], r));
      await new Promise(r => db.query("ALTER TABLE empresas ADD COLUMN IF NOT EXISTS requiere_gps SMALLINT DEFAULT 0", [], r));
      await new Promise(r => db.query("ALTER TABLE empresas ADD COLUMN IF NOT EXISTS latitud DECIMAL(10,8)", [], r));
      await new Promise(r => db.query("ALTER TABLE empresas ADD COLUMN IF NOT EXISTS longitud DECIMAL(11,8)", [], r));
      await new Promise(r => db.query("ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS horas_nocturnas DECIMAL(10,2) DEFAULT 0.00", [], r));
    } catch(e) {
      console.error('Error ejecutando migraciones seguras:', e);
    }

    console.log('Base de datos Postgres inicializada correctamente.');
    
    // No se limpian datos de empleados ni asistencias durante el arranque.
  } catch (error) {
    console.error('Error inicializando BD:', error);
  }
};

module.exports = initDB;
