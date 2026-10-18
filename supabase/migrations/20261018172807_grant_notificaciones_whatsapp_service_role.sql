-- La migración original (20260821140136_whatsapp_citas.sql) creó la tabla
-- notificaciones_whatsapp con RLS pero sin otorgar privilegios explícitos a
-- service_role, lo que bloqueaba el insert de auditoría hecho por la Edge
-- Function whatsapp-enviar (que usa SUPABASE_SERVICE_ROLE_KEY).
grant select, insert, update on public.notificaciones_whatsapp to service_role;
