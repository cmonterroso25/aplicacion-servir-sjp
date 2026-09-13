-- Tabla de configuración de grupos de WhatsApp (single-tenant, no requiere organization_id)
create table public.whatsapp_grupos (
  grupo text primary key,
  chat_id text not null,
  actualizado_en timestamptz not null default now()
);

alter table public.whatsapp_grupos enable row level security;

create policy "admin_pentagono_select_whatsapp_grupos"
on public.whatsapp_grupos for select
to authenticated
using (exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('admin','pentagono')));

create policy "admin_insert_whatsapp_grupos"
on public.whatsapp_grupos for insert
to authenticated
with check (exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'admin'));

create policy "admin_update_whatsapp_grupos"
on public.whatsapp_grupos for update
to authenticated
using (exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'admin'))
with check (exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'admin'));

-- Auditoría de notificaciones enviadas (paralelo a la de crm_monce, sin organization_id/contacto_id
-- porque reuniones no tiene esa relación)
create table public.notificaciones_whatsapp (
  id uuid primary key default gen_random_uuid(),
  reunion_id int8 references public.reuniones(id) on delete set null,
  chat_id text,
  mensaje text not null,
  tipo_notificacion text not null,
  enviado boolean not null default false,
  enviado_en timestamptz,
  creado_en timestamptz not null default now()
);

alter table public.notificaciones_whatsapp enable row level security;

create policy "admin_pentagono_select_notificaciones_whatsapp"
on public.notificaciones_whatsapp for select
to authenticated
using (exists (select 1 from perfiles p where p.id = auth.uid() and p.rol in ('admin','pentagono')));

-- Nota: no hay policy de insert/update para 'authenticated' a propósito.
-- Solo el edge function (service role key) escribe en esta tabla, que
-- bypassea RLS. Así el cliente nunca puede falsificar un registro "enviado".
