-- La migración original (20260821140136_whatsapp_citas.sql) creó whatsapp_grupos
-- con RLS pero sin GRANT explícito a service_role, bloqueando la lectura del
-- chat_id que hace /api/notificar-cita (vía supabaseAdmin) al crear/reprogramar
-- una reunión. Mismo patrón de bug que notificaciones_whatsapp (20261018172807).
grant select on public.whatsapp_grupos to service_role;
