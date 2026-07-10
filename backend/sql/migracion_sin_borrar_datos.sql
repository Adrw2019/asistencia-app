USE asistencia;

CREATE TABLE IF NOT EXISTS empresas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  nit VARCHAR(50),
  telefono VARCHAR(50),
  correo VARCHAR(150),
  estado TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO empresas (id, nombre, nit, telefono, correo)
SELECT 1, 'Empresa Principal', '000000000', '3005279465', 'andrw6382@gmail.com'
WHERE NOT EXISTS (SELECT 1 FROM empresas WHERE id = 1);

ALTER TABLE usuarios ENGINE=InnoDB;
ALTER TABLE empleados ENGINE=InnoDB;
ALTER TABLE asistencias ENGINE=InnoDB;
ALTER TABLE fcm_tokens ENGINE=InnoDB;

ALTER TABLE usuarios ADD COLUMN empresa_id INT NULL;
ALTER TABLE empleados ADD COLUMN empresa_id INT NULL;
ALTER TABLE asistencias ADD COLUMN empresa_id INT NULL;
ALTER TABLE fcm_tokens ADD COLUMN empresa_id INT NULL;

ALTER TABLE asistencias ADD COLUMN empleado_id INT NULL;
ALTER TABLE asistencias ADD COLUMN minutos_tarde INT DEFAULT 0;
ALTER TABLE asistencias ADD COLUMN minutos_salida_anticipada INT DEFAULT 0;

UPDATE usuarios SET empresa_id = 1 WHERE empresa_id IS NULL;
UPDATE empleados SET empresa_id = 1 WHERE empresa_id IS NULL;
UPDATE asistencias SET empresa_id = 1 WHERE empresa_id IS NULL;
UPDATE fcm_tokens SET empresa_id = 1 WHERE empresa_id IS NULL;
UPDATE asistencias a INNER JOIN empleados e ON e.cedula = a.cedula AND e.empresa_id = a.empresa_id SET a.empleado_id = e.id WHERE a.empleado_id IS NULL;
