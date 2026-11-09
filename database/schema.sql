-- ============================================================================
-- ANIMALGUARD - ESQUEMA RELACIONAL Y SEGURIDAD RLS (SUPABASE / POSTGRESQL)
-- Corredor Bogotá D.C. - Soacha | Cumplimiento Ley 1581/2012 y Ley 2455/2025
-- ============================================================================

-- 1. Tabla de Roles
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(30) UNIQUE NOT NULL -- 'ciudadano', 'albergue', 'admin'
);
INSERT INTO roles (nombre) VALUES ('ciudadano'), ('albergue'), ('admin');

-- 2. Tabla de Usuarios (vinculada a auth.users de Supabase)
CREATE TABLE usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre_completo VARCHAR(120) NOT NULL,
    telefono VARCHAR(20),
    municipio VARCHAR(30) CHECK (municipio IN ('Bogotá D.C.', 'Soacha')),
    rol_id INTEGER REFERENCES roles(id) DEFAULT 1,
    acepta_habeas_data BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_consentimiento TIMESTAMPTZ DEFAULT NOW(),
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de Reportes de Maltrato Animal
CREATE TABLE reportes_maltrato (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    radicado_interno VARCHAR(25) UNIQUE NOT NULL,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    reserva_identidad BOOLEAN DEFAULT TRUE,
    declaracion_veracidad BOOLEAN NOT NULL DEFAULT TRUE,
    tipo_maltrato VARCHAR(50) NOT NULL CHECK (tipo_maltrato IN (
        'Abandono en vía pública',
        'Negligencia (sin agua/alimento/salud)',
        'Agresión física activa / Sevicia',
        'Encierro o condiciones insalubres'
    )),
    nivel_urgencia VARCHAR(20) NOT NULL CHECK (nivel_urgencia IN ('Alta', 'Media', 'Baja')),
    descripcion TEXT NOT NULL,
    latitud NUMERIC(10, 7) NOT NULL,
    longitud NUMERIC(10, 7) NOT NULL,
    precision_gps_metros NUMERIC(6, 2),
    municipio_detectado VARCHAR(30) NOT NULL CHECK (municipio_detectado IN ('Bogotá D.C.', 'Soacha')),
    entidad_competente VARCHAR(180) NOT NULL,
    estado VARCHAR(30) DEFAULT 'Recibido - En orientación' CHECK (estado IN (
        'Recibido - En orientación',
        'Remitido a canal oficial',
        'En verificación comunitaria',
        'Cerrado / Descartado'
    )),
    fecha_hechos_utc TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'utc'),
    fecha_expiracion_datos TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '180 days')
);

-- 4. Tabla de Evidencias Multimedia (Sin EXIF)
CREATE TABLE evidencias_multimedia (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reporte_id UUID REFERENCES reportes_maltrato(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    tipo_archivo VARCHAR(20) DEFAULT 'image/jpeg',
    exif_eliminado BOOLEAN DEFAULT TRUE,
    fecha_carga_utc TIMESTAMPTZ DEFAULT (NOW() AT TIME ZONE 'utc')
);

-- 5. Tabla de Albergues Comunitarios
CREATE TABLE albergues (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    responsable_id UUID REFERENCES usuarios(id),
    nombre_albergue VARCHAR(120) NOT NULL,
    municipio VARCHAR(30) NOT NULL CHECK (municipio IN ('Bogotá D.C.', 'Soacha')),
    localidad_barrio VARCHAR(80),
    telefono_contacto VARCHAR(20),
    verificado BOOLEAN DEFAULT TRUE
);

-- 6. Tabla de Animales en Adopción
CREATE TABLE animales_adopcion (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    albergue_id UUID REFERENCES albergues(id) ON DELETE CASCADE,
    nombre VARCHAR(60) NOT NULL,
    especie VARCHAR(20) CHECK (especie IN ('Perro', 'Gato')),
    edad_aproximada VARCHAR(30),
    talla VARCHAR(20),
    estado_salud TEXT,
    esterilizado BOOLEAN DEFAULT TRUE,
    vacunado BOOLEAN DEFAULT TRUE,
    historia_resumen TEXT,
    foto_url TEXT,
    estado_adopcion VARCHAR(30) DEFAULT 'Disponible' CHECK (estado_adopcion IN ('Disponible', 'En proceso', 'Adoptado'))
);

-- 7. Tabla de Solicitudes de Adopción (Con filtro Ley Ángel 2455/2025)
CREATE TABLE solicitudes_adopcion (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    animal_id UUID REFERENCES animales_adopcion(id) ON DELETE CASCADE,
    postulante_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo_vivienda VARCHAR(40) NOT NULL,
    vivienda_propia_o_autorizada BOOLEAN NOT NULL,
    compromiso_cinco_libertades BOOLEAN NOT NULL DEFAULT TRUE,
    declaracion_sin_inhabilidad_ley2455 BOOLEAN NOT NULL DEFAULT TRUE,
    motivo_adopcion TEXT NOT NULL,
    estado_solicitud VARCHAR(30) DEFAULT 'Pendiente revisión albergue' CHECK (estado_solicitud IN (
        'Pendiente revisión albergue',
        'Aprobada',
        'Rechazada'
    )),
    observaciones_albergue TEXT,
    fecha_solicitud TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Tabla de Seguimiento Posadopción (15, 30 y 90 días)
CREATE TABLE seguimiento_posadopcion (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    solicitud_id UUID REFERENCES solicitudes_adopcion(id) ON DELETE CASCADE,
    hito_control VARCHAR(30) NOT NULL CHECK (hito_control IN ('Día 15', 'Día 30', 'Día 90')),
    estado_animal TEXT NOT NULL,
    foto_seguimiento_path TEXT,
    estado_cumplimiento VARCHAR(30) DEFAULT 'Al día' CHECK (estado_cumplimiento IN (
        'Al día',
        'Pendiente',
        'Alerta de Incumplimiento'
    )),
    observacion_albergue TEXT,
    fecha_registro TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Tabla de Contenidos Educativos
CREATE TABLE contenidos_educativos (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(150) NOT NULL,
    norma_referencia VARCHAR(80) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    resumen_practico TEXT NOT NULL,
    puntos_clave TEXT NOT NULL
);

-- Datos semilla para demostración inmediata del prototipo
INSERT INTO contenidos_educativos (titulo, norma_referencia, categoria, resumen_practico, puntos_clave) VALUES
('Ley Ángel: Penas más severas y atención en 24 horas', 'Ley 2455 de 2025', 'Marco Penal y Policivo',
 'Fortalece la lucha contra el maltrato animal, agrava penas cuando ocurre con sevicia o en vía pública y obliga a Policía e Inspectores a atender quejas en máximo 24 horas.',
 '• Inhabilidad para tener animales a condenados.\n• Atención policiva obligatoria en 24h.\n• Agravante por abandono o maltrato en espacio público.'),
('Animales como Seres Sintientes', 'Ley 1774 de 2016', 'Derechos y Protección',
 'Reconoce que los animales no son cosas sino seres sintientes que sienten dolor y estrés, tipificando delitos contra su vida e integridad en el Código Penal (Art. 339A).',
 '• Multas de 5 a 60 SMLMV.\n• Prisión de 12 a 36 meses por menoscabo grave.\n• Solidaridad social para impedir actos de crueldad.'),
('Protección de tus Datos al Denunciar', 'Ley Estatutaria 1581 de 2012', 'Habeas Data y Privacidad',
 'AnimalGuard protege tu identidad frente a terceros eliminando metadatos EXIF de tus fotos y restringiendo el acceso público a tus datos personales.',
 '• Limpieza automática de metadatos EXIF.\n• Reserva de identidad frente al público.\n• Uso exclusivo para orientación territorial.');