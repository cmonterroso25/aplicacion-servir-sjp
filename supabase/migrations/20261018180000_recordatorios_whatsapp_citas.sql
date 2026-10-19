-- Recordatorios automáticos de reuniones (24h y 3h antes) vía WhatsApp.

-- Extensiones necesarias para programar el cron que procesa recordatorios pendientes.
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- Columna para envíos programados a futuro. NULL = envío inmediato (comportamiento existente).
alter table public.notificaciones_whatsapp
  add column if not exists programado_para timestamptz;

-- Índice parcial para que el cron solo escanee las filas pendientes.
create index if not exists idx_notificaciones_whatsapp_pendientes
  on public.notificaciones_whatsapp (programado_para)
  where enviado = false and programado_para is not null;

-- La migración 20261018172807 otorgó select/insert/update a service_role pero
-- faltó delete, necesario para cancelar recordatorios pendientes cuando una
-- reunión se reprograma o se elimina.
grant delete on public.notificaciones_whatsapp to service_role;

-- Cron: cada 10 minutos invoca la Edge Function que envía los recordatorios
-- vencidos. El secreto se lee de Vault en tiempo de ejecución (no vive en
-- este archivo ni en el historial de git).
select cron.schedule(
  'procesar-recordatorios-whatsapp',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://zedccthxoqetbzklkpld.supabase.co/functions/v1/whatsapp-procesar-recordatorios',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notificacion-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'whatsapp_function_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
