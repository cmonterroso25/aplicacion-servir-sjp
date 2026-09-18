-- Agrega politica de UPDATE para el rol pentagono en afiliados.
-- Hasta ahora pentagono solo tenia SELECT (ver "pentagono ve sus afiliados"),
-- por lo que cualquier UPDATE desde ese rol (ej. asignar Coordinador/Fiscal
-- en /afiliados) era bloqueado silenciosamente por RLS: 0 filas afectadas,
-- y el .select().single() posterior fallaba con
-- "Cannot coerce the result to a single JSON object".
--
-- Alcance: mismo criterio que la politica de SELECT ya existente
-- (afiliados.afiliado_por coincide con el nombre_completo/email del usuario
-- pentagono). USING y WITH CHECK son iguales para impedir que, al editar,
-- el usuario reasigne el afiliado a un afiliado_por distinto al suyo
-- (lo cual lo sacaria de su propio alcance de visibilidad).

CREATE POLICY "pentagono edita sus afiliados"
ON afiliados
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM perfiles p
    WHERE p.id = auth.uid()
      AND p.rol = 'pentagono'
      AND afiliados.afiliado_por = COALESCE(p.nombre_completo, p.email)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM perfiles p
    WHERE p.id = auth.uid()
      AND p.rol = 'pentagono'
      AND afiliados.afiliado_por = COALESCE(p.nombre_completo, p.email)
  )
);
