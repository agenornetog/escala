create function public.escala_company_users(
  p_organization uuid, p_actor uuid, p_email text default null,
  p_role text default null, p_remove uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  target_id uuid;
begin
  if p_email is not null or p_remove is not null then
    perform 1 from public.escala_organizations where id = p_organization for update;
  end if;
  perform 1 from public.escala_memberships
    where organization_id = p_organization and user_id = p_actor and role = 'admin'
    for share;
  if not found then raise insufficient_privilege; end if;

  if p_email is not null then
    if p_remove is not null or p_role is null or p_role not in ('admin', 'manager') then
      raise invalid_parameter_value;
    end if;
    select id into strict target_id from auth.users
      where lower(email) = lower(btrim(p_email)) and email_confirmed_at is not null and deleted_at is null;
    if target_id = p_actor then raise invalid_parameter_value using message = 'Cannot change own access'; end if;
    insert into public.escala_memberships (organization_id, user_id, role)
      values (p_organization, target_id, p_role)
    on conflict (organization_id, user_id) do update set role = excluded.role;
  elsif p_remove is not null then
    if p_remove = p_actor then raise invalid_parameter_value using message = 'Cannot remove own access'; end if;
    delete from public.escala_memberships where organization_id = p_organization and user_id = p_remove;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object('id', u.id, 'email', u.email, 'role', m.role, 'self', u.id = p_actor) order by u.email)
    from public.escala_memberships m join auth.users u on u.id = m.user_id
    where m.organization_id = p_organization and u.deleted_at is null
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.escala_company_users(uuid,uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.escala_company_users(uuid,uuid,text,text,uuid) to service_role;
