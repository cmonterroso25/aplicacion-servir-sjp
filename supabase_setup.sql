-- ============================================================
-- SCRIPT DE CONFIGURACIÓN SUPABASE
-- Herramienta de Consulta de Empadronados — San José Pinula
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. CREAR TABLA
CREATE TABLE IF NOT EXISTS empadronados (
  id              BIGSERIAL PRIMARY KEY,
  dpi             TEXT NOT NULL,
  primer_nombre   TEXT NOT NULL,
  segundo_nombre  TEXT,
  primer_apellido TEXT NOT NULL,
  segundo_apellido TEXT,
  genero          TEXT,
  edad            INTEGER,
  departamento    TEXT,
  municipio       TEXT,
  direccion       TEXT
);

-- 2. ÍNDICES PARA BÚSQUEDA RÁPIDA

-- Búsqueda exacta por DPI
CREATE INDEX IF NOT EXISTS idx_dpi 
ON empadronados(dpi);

-- Búsqueda por apellido exacto
CREATE INDEX IF NOT EXISTS idx_primer_apellido 
ON empadronados(primer_apellido);

-- Búsqueda de texto parcial (requiere extensión pg_trgm)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_primer_nombre_trgm 
ON empadronados USING gin(primer_nombre gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_primer_apellido_trgm 
ON empadronados USING gin(primer_apellido gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_segundo_apellido_trgm 
ON empadronados USING gin(segundo_apellido gin_trgm_ops);

-- 3. SEGURIDAD — Row Level Security

-- Activar RLS
ALTER TABLE empadronados ENABLE ROW LEVEL SECURITY;

-- Solo usuarios autenticados pueden leer
CREATE POLICY "Solo usuarios autenticados pueden leer"
ON empadronados
FOR SELECT
TO authenticated
USING (true);

-- Nadie puede insertar/editar/borrar desde la app
-- (los datos solo se modifican desde el panel de Supabase por el admin)

-- 4. VERIFICAR QUE TODO ESTÁ CORRECTO
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'empadronados';
