-- 1. Nueva columna "Fiscal" en afiliados. NOT NULL + DEFAULT false asegura
--    que todos los registros existentes queden en "No" automáticamente.
ALTER TABLE public.afiliados
  ADD COLUMN es_fiscal boolean NOT NULL DEFAULT false;

-- 2. No existía ninguna política de DELETE para "afiliados". Sin esto, el
--    boton "Eliminar" en el frontend fallaria silenciosamente por RLS.
--    Solo el rol de perfil "admin" puede eliminar.
CREATE POLICY "admin elimina afiliados"
  ON public.afiliados
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfiles p
      WHERE p.id = auth.uid() AND p.rol = 'admin'
    )
  );

-- 3. Restringir "pentagono" a ver solo los afiliados donde "afiliado_por"
--    coincide con su propio nombre (mismo valor que se guarda al afiliar,
--    ver src/app/afiliados/nuevo/page.tsx: nombre_completo || email).
DROP POLICY IF EXISTS "pentagono ve todos los afiliados" ON public.afiliados;

CREATE POLICY "pentagono ve sus afiliados"
  ON public.afiliados
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM perfiles p
      WHERE p.id = auth.uid()
        AND p.rol = 'pentagono'
        AND afiliados.afiliado_por = COALESCE(p.nombre_completo, p.email)
    )
  );

NOTIFY pgrst, 'reload schema';
