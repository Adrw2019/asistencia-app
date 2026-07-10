CREATE DATABASE IF NOT EXISTS asistencia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE asistencia;

DROP TABLE IF EXISTS asistencias;
DROP TABLE IF EXISTS fcm_tokens;
DROP TABLE IF EXISTS empleados;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS empresas;

CREATE TABLE empresas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  nit VARCHAR(50),
  telefono VARCHAR(50),
  correo VARCHAR(150),
  estado TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100),
  password VARCHAR(255) NOT NULL,
  reset_token VARCHAR(255),
  reset_expires BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_usuario_empresa (empresa_id, username),
  CONSTRAINT fk_usuarios_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE empleados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  cedula VARCHAR(20) NOT NULL,
  cargo VARCHAR(50),
  celular VARCHAR(20),
  estado TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_empleado_empresa (empresa_id, cedula),
  CONSTRAINT fk_empleados_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE asistencias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  empleado_id INT NOT NULL,
  cedula VARCHAR(20) NOT NULL,
  fecha DATE NOT NULL,
  hora_entrada TIME NOT NULL,
  hora_salida TIME NULL,
  pago INT DEFAULT 0,
  horas_trabajadas DECIMAL(10,2) DEFAULT 0.00,
  horas_extra DECIMAL(10,2) DEFAULT 0.00,
  descuento INT DEFAULT 0,
  llego_tarde TINYINT(1) DEFAULT 0,
  minutos_tarde INT DEFAULT 0,
  minutos_salida_anticipada INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_asistencia_empresa_fecha (empresa_id, fecha),
  INDEX idx_asistencia_abierta (empresa_id, empleado_id, hora_salida),
  CONSTRAINT fk_asistencias_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  CONSTRAINT fk_asistencias_empleado FOREIGN KEY (empleado_id) REFERENCES empleados(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE fcm_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NULL,
  token VARCHAR(512) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fcm_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO empresas (id, nombre, nit, telefono, correo)
VALUES (1, 'Empresa Principal', '000000000', '3005279465', 'andrw6382@gmail.com');

-- Usuario de prueba. Contraseña: 1234
INSERT INTO usuarios (empresa_id, username, email, password)
VALUES (1, 'admin', 'andrw6382@gmail.com', '1234');

INSERT INTO empleados (empresa_id, nombre, cedula, cargo, celular)
VALUES (1, 'Empleado de prueba', '80770763', 'Operario', '3005279465');
