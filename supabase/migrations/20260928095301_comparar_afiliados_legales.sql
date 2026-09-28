create or replace function comparar_afiliados_legales()
returns table (vinculados_nuevos integer, es_legal_actualizados integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vinculados integer;
  v_es_legal integer;
begin
  if not exists (
    select 1 from perfiles p
    where p.id = auth.uid() and p.rol in ('admin', 'pentagono')
  ) then
    raise exception 'No autorizado';
  end if;

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

  return query select v_vinculados, v_es_legal;
end;
$$;

revoke all on function comparar_afiliados_legales() from public;
grant execute on function comparar_afiliados_legales() to authenticated;
