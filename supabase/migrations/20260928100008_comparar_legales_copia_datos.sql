drop function if exists comparar_afiliados_legales();

create or replace function comparar_afiliados_legales()
returns table (
  vinculados_nuevos integer,
  datos_completados integer,
  es_legal_actualizados integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vinculados integer;
  v_datos integer;
  v_es_legal integer;
begin
  if not exists (
    select 1 from perfiles p
    where p.id = auth.uid() and p.rol in ('admin', 'pentagono')
  ) then
    raise exception 'No autorizado';
  end if;

  -- 1) Vincular pendientes por DPI (ignorando espacios)
  update afiliados_legales al
  set afiliado_id = m.afiliado_id,
      vinculado = true
  from (
    select min(a.id) as afiliado_id,
           regexp_replace(a.dpi, '\s+', '', 'g') as dpi_norm
    from afiliados a
    where a.dpi is not null and trim(a.dpi) <> ''
    group by regexp_replace(a.dpi, '\s+', '', 'g')
  ) m
  where al.vinculado = false
    and al.dpi is not null
    and regexp_replace(al.dpi, '\s+', '', 'g') = m.dpi_norm;
  get diagnostics v_vinculados = row_count;

  -- 2) Completar datos de TODOS los vinculados con lo que tenga el afiliado.
  --    Solo rellena campos vacios: no pisa lo que ya se haya editado a mano
  --    en afiliados_legales.
  update afiliados_legales al
  set telefono         = coalesce(nullif(al.telefono, ''), a.telefono),
      fecha_nacimiento = coalesce(al.fecha_nacimiento, a.fecha_nacimiento),
      sector_id        = coalesce(al.sector_id, a.sector_id),
      encargado_id     = coalesce(al.encargado_id, a.encargado_id),
      tipo_ubicacion   = coalesce(nullif(al.tipo_ubicacion, ''), a.tipo_ubicacion),
      nombre_ubicacion = coalesce(nullif(al.nombre_ubicacion, ''), a.nombre_ubicacion),
      vota_en_pinula   = coalesce(al.vota_en_pinula, a.vota_en_pinula),
      genero           = coalesce(nullif(al.genero, ''), a.genero),
      edad             = coalesce(nullif(al.edad, ''), a.edad),
      afiliado_por     = coalesce(nullif(al.afiliado_por, ''), a.afiliado_por),
      rol_afiliado     = coalesce(nullif(al.rol_afiliado, ''), a.rol_afiliado),
      direccion        = coalesce(nullif(al.direccion, ''), a.direccion)
  from afiliados a
  where al.afiliado_id = a.id
    and (
      (nullif(al.telefono, '') is null and nullif(a.telefono, '') is not null) or
      (al.fecha_nacimiento is null and a.fecha_nacimiento is not null) or
      (al.sector_id is null and a.sector_id is not null) or
      (al.encargado_id is null and a.encargado_id is not null) or
      (nullif(al.tipo_ubicacion, '') is null and nullif(a.tipo_ubicacion, '') is not null) or
      (nullif(al.nombre_ubicacion, '') is null and nullif(a.nombre_ubicacion, '') is not null) or
      (al.vota_en_pinula is null and a.vota_en_pinula is not null) or
      (nullif(al.genero, '') is null and nullif(a.genero, '') is not null) or
      (nullif(al.edad, '') is null and nullif(a.edad, '') is not null) or
      (nullif(al.afiliado_por, '') is null and nullif(a.afiliado_por, '') is not null) or
      (nullif(al.rol_afiliado, '') is null and nullif(a.rol_afiliado, '') is not null) or
      (nullif(al.direccion, '') is null and nullif(a.direccion, '') is not null)
    );
  get diagnostics v_datos = row_count;

  -- 3) Marcar es_legal en afiliados
  update afiliados a
  set es_legal = true
  where a.es_legal = false
    and a.dpi is not null
    and exists (
      select 1 from afiliados_legales al
      where al.dpi is not null
        and regexp_replace(al.dpi, '\s+', '', 'g') = regexp_replace(a.dpi, '\s+', '', 'g')
    );
  get diagnostics v_es_legal = row_count;

  return query select v_vinculados, v_datos, v_es_legal;
end;
$$;

revoke all on function comparar_afiliados_legales() from public;
grant execute on function comparar_afiliados_legales() to authenticated;
