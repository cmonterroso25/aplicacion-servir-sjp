-- La migración 20261022190000 otorgó permisos a 'authenticated' pero olvidó
-- 'service_role' (mismo patrón de bug que notificaciones_whatsapp/whatsapp_grupos).
-- service_role bypasea RLS pero sigue necesitando el GRANT a nivel de tabla.
grant select, insert, update, delete on public.asistencias to service_role;
