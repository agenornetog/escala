create table public.escala_platform_admins (
  user_id uuid primary key references auth.users on delete cascade
);
alter table public.escala_platform_admins enable row level security;
revoke all on public.escala_platform_admins from public, anon, authenticated;
grant select on public.escala_platform_admins to service_role;

insert into public.escala_platform_admins (user_id)
select id from auth.users where id = 'e842cdfb-7c34-48f6-b538-c8bc30f56eba'
  and email_confirmed_at is not null;

create function public.escala_provision_company(
  p_actor uuid, p_email text, p_name text, p_organization uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  account uuid;
  company uuid := p_organization;
begin
  perform 1 from public.escala_platform_admins where user_id = p_actor;
  if not found then raise insufficient_privilege; end if;
  select id into strict account from auth.users
    where lower(email) = lower(btrim(p_email)) and email_confirmed_at is not null and deleted_at is null;
  if company is null then
    insert into public.escala_organizations (name) values (btrim(p_name)) returning id into company;
  end if;
  insert into public.escala_memberships (organization_id, user_id, role)
  values (company, account, 'admin')
  on conflict (organization_id,user_id) do update set role = excluded.role;
  return company;
end;
$$;
revoke all on function public.escala_provision_company(uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.escala_provision_company(uuid,text,text,uuid) to service_role;
