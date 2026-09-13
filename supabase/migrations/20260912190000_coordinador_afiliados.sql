-- Renombrar el rol "Líder" a "Coordinador" en los datos existentes
UPDATE afiliados SET rol_afiliado = 'Coordinador' WHERE rol_afiliado = 'Líder';
UPDATE afiliados_legales SET rol_afiliado = 'Coordinador' WHERE rol_afiliado = 'Líder';

-- Nueva columna: coordinador_id, referencia a otro registro de afiliados
-- (el coordinador que atiende a este afiliado). Nace vacía para todos.
ALTER TABLE afiliados
  ADD COLUMN coordinador_id int8 NULL REFERENCES afiliados(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_afiliados_coordinador_id ON afiliados(coordinador_id);

-- Trigger de validación:
--   1. Solo admin/pentagono pueden cambiar coordinador_id.
--   2. El coordinador asignado debe tener rol_afiliado = 'Coordinador'.
--   3. El coordinador debe pertenecer al mismo "afiliado_por" que el afiliado editado.
--   4. Un afiliado no puede ser su propio coordinador.
CREATE OR REPLACE FUNCTION validar_coordinador_afiliado()
RETURNS trigger AS $$
DECLARE
  v_rol text;
  v_rol_coord text;
  v_afiliado_por_coord text;
BEGIN
  IF NEW.coordinador_id IS NOT DISTINCT FROM OLD.coordinador_id THEN
    RETURN NEW;
  END IF;

  SELECT rol INTO v_rol FROM perfiles WHERE id = auth.uid();
  IF v_rol IS DISTINCT FROM 'admin' AND v_rol IS DISTINCT FROM 'pentagono' THEN
    RAISE EXCEPTION 'Solo admin o pentagono pueden asignar el coordinador de un afiliado';
  END IF;

  IF NEW.coordinador_id IS NOT NULL THEN
    IF NEW.coordinador_id = NEW.id THEN
      RAISE EXCEPTION 'Un afiliado no puede ser su propio coordinador';
    END IF;

    SELECT rol_afiliado, afiliado_por INTO v_rol_coord, v_afiliado_por_coord
    FROM afiliados WHERE id = NEW.coordinador_id;

    IF v_rol_coord IS DISTINCT FROM 'Coordinador' THEN
      RAISE EXCEPTION 'El coordinador asignado debe tener rol Coordinador';
    END IF;

    IF v_afiliado_por_coord IS DISTINCT FROM NEW.afiliado_por THEN
      RAISE EXCEPTION 'El coordinador debe pertenecer al mismo Afiliado por';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_validar_coordinador_afiliado ON afiliados;
CREATE TRIGGER trg_validar_coordinador_afiliado
  BEFORE UPDATE ON afiliados
  FOR EACH ROW
  EXECUTE FUNCTION validar_coordinador_afiliado();
