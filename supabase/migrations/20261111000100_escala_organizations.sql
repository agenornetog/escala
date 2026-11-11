create table public.escala_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  revision integer not null default 0 check (revision >= 0)
);

create table public.escala_memberships (
  organization_id uuid not null references public.escala_organizations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('admin', 'manager')),
  primary key (organization_id, user_id)
);
create index escala_memberships_user on public.escala_memberships (user_id);

create table public.escala_sectors (
  organization_id uuid not null references public.escala_organizations on delete cascade,
  id text not null,
  primary key (organization_id, id)
);

create function public.escala_seed_sectors() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.escala_sectors (organization_id, id)
  values (new.id, 'Campo'), (new.id, 'Suporte'), (new.id, 'Atendimento');
  return new;
end;
$$;
revoke all on function public.escala_seed_sectors() from public, anon, authenticated;
grant execute on function public.escala_seed_sectors() to service_role;
create trigger escala_seed_sectors after insert on public.escala_organizations
for each row execute function public.escala_seed_sectors();

create table public.escala_employees (
  organization_id uuid not null references public.escala_organizations on delete cascade,
  id text not null,
  sector_id text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  primary key (organization_id, id),
  foreign key (organization_id, sector_id) references public.escala_sectors
);

create table public.escala_shifts (
  organization_id uuid not null,
  id text not null,
  employee_id text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  primary key (organization_id, id),
  foreign key (organization_id, employee_id) references public.escala_employees on delete cascade
);
create index escala_shifts_employee on public.escala_shifts (organization_id, employee_id);

create table public.escala_days_off (
  organization_id uuid not null,
  id text not null,
  employee_id text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  primary key (organization_id, id),
  foreign key (organization_id, employee_id) references public.escala_employees on delete cascade
);
create index escala_days_off_employee on public.escala_days_off (organization_id, employee_id);

create table public.escala_absences (
  organization_id uuid not null,
  id text not null,
  employee_id text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  primary key (organization_id, id),
  foreign key (organization_id, employee_id) references public.escala_employees on delete cascade
);
create index escala_absences_employee on public.escala_absences (organization_id, employee_id);

create table public.escala_swaps (
  organization_id uuid not null,
  id text not null,
  from_shift_id text not null,
  to_shift_id text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  primary key (organization_id, id),
  foreign key (organization_id, from_shift_id) references public.escala_shifts on delete cascade,
  foreign key (organization_id, to_shift_id) references public.escala_shifts on delete cascade
);
create index escala_swaps_from_shift on public.escala_swaps (organization_id, from_shift_id);
create index escala_swaps_to_shift on public.escala_swaps (organization_id, to_shift_id);

create table public.escala_holidays (
  organization_id uuid not null references public.escala_organizations on delete cascade,
  id text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  primary key (organization_id, id)
);

create table public.escala_labor_instruments (
  organization_id uuid not null references public.escala_organizations on delete cascade,
  id text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  primary key (organization_id, id)
);

create table public.escala_schedule_rules (
  organization_id uuid not null references public.escala_organizations on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  primary key (organization_id)
);

create table public.escala_workspace_locations (
  organization_id uuid not null references public.escala_organizations on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  primary key (organization_id)
);

alter table public.escala_organizations enable row level security;
revoke all on public.escala_organizations from public, anon, authenticated;
grant select, insert, update, delete on public.escala_organizations to service_role;
alter table public.escala_memberships enable row level security;
revoke all on public.escala_memberships from public, anon, authenticated;
grant select, insert, update, delete on public.escala_memberships to service_role;
alter table public.escala_sectors enable row level security;
revoke all on public.escala_sectors from public, anon, authenticated;
grant select, insert, update, delete on public.escala_sectors to service_role;
alter table public.escala_employees enable row level security;
revoke all on public.escala_employees from public, anon, authenticated;
grant select, insert, update, delete on public.escala_employees to service_role;
alter table public.escala_shifts enable row level security;
revoke all on public.escala_shifts from public, anon, authenticated;
grant select, insert, update, delete on public.escala_shifts to service_role;
alter table public.escala_days_off enable row level security;
revoke all on public.escala_days_off from public, anon, authenticated;
grant select, insert, update, delete on public.escala_days_off to service_role;
alter table public.escala_absences enable row level security;
revoke all on public.escala_absences from public, anon, authenticated;
grant select, insert, update, delete on public.escala_absences to service_role;
alter table public.escala_swaps enable row level security;
revoke all on public.escala_swaps from public, anon, authenticated;
grant select, insert, update, delete on public.escala_swaps to service_role;
alter table public.escala_holidays enable row level security;
revoke all on public.escala_holidays from public, anon, authenticated;
grant select, insert, update, delete on public.escala_holidays to service_role;
alter table public.escala_labor_instruments enable row level security;
revoke all on public.escala_labor_instruments from public, anon, authenticated;
grant select, insert, update, delete on public.escala_labor_instruments to service_role;
alter table public.escala_schedule_rules enable row level security;
revoke all on public.escala_schedule_rules from public, anon, authenticated;
grant select, insert, update, delete on public.escala_schedule_rules to service_role;
alter table public.escala_workspace_locations enable row level security;
revoke all on public.escala_workspace_locations from public, anon, authenticated;
grant select, insert, update, delete on public.escala_workspace_locations to service_role;

alter table public.escala_employees add column position bigint not null default 0;
alter table public.escala_shifts add column position bigint not null default 0;
alter table public.escala_swaps add column position bigint not null default 0;
alter table public.escala_days_off add column position bigint not null default 0;
alter table public.escala_absences add column position bigint not null default 0;
alter table public.escala_holidays add column position bigint not null default 0;
alter table public.escala_labor_instruments add column position bigint not null default 0;

create function public.escala_read_planning(p_organization uuid, p_actor uuid) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  current_revision integer;
  state jsonb;
  items jsonb;
  location jsonb;
begin
  select o.revision into current_revision
  from public.escala_organizations o
  join public.escala_memberships m on m.organization_id = o.id
  where o.id = p_organization and m.user_id = p_actor;
  if not found then raise insufficient_privilege; end if;

  select data into state from public.escala_schedule_rules where organization_id = p_organization;
  if not found then return jsonb_build_object('revision', current_revision, 'store', null); end if;
  select coalesce(jsonb_agg(data order by position, id), '[]'::jsonb) into items
    from public.escala_employees where organization_id = p_organization;
  if state ? 'employees' then state := jsonb_set(state, '{employees}', items); end if;
  select coalesce(jsonb_agg(data order by position, id), '[]'::jsonb) into items
    from public.escala_shifts where organization_id = p_organization;
  if state ? 'shifts' then state := jsonb_set(state, '{shifts}', items); end if;
  select coalesce(jsonb_agg(data order by position, id), '[]'::jsonb) into items
    from public.escala_swaps where organization_id = p_organization;
  if state ? 'swaps' then state := jsonb_set(state, '{swaps}', items); end if;
  select coalesce(jsonb_agg(data order by position, id), '[]'::jsonb) into items
    from public.escala_days_off where organization_id = p_organization;
  if state ? 'dayOffs' then state := jsonb_set(state, '{dayOffs}', items); end if;
  select coalesce(jsonb_agg(data order by position, id), '[]'::jsonb) into items
    from public.escala_absences where organization_id = p_organization;
  if state ? 'absences' then state := jsonb_set(state, '{absences}', items); end if;
  select coalesce(jsonb_agg(data order by position, id), '[]'::jsonb) into items
    from public.escala_holidays where organization_id = p_organization;
  if state ? 'holidays' then state := jsonb_set(state, '{holidays}', items); end if;
  select coalesce(jsonb_agg(data order by position, id), '[]'::jsonb) into items
    from public.escala_labor_instruments where organization_id = p_organization;
  if state ? 'labor' then state := jsonb_set(state, '{labor,instruments}', items); end if;
  select data into location from public.escala_workspace_locations where organization_id = p_organization;
  if found then state := state || jsonb_build_object('workspaceLocation', location); end if;
  return jsonb_build_object('revision', current_revision, 'store', state);
end;
$$;

create function public.escala_write_planning(
  p_organization uuid, p_actor uuid, p_revision integer, p_store jsonb
) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  current_revision integer;
begin
  perform 1 from public.escala_memberships
    where organization_id = p_organization and user_id = p_actor for share;
  if not found then raise insufficient_privilege; end if;

  update public.escala_organizations set revision = revision + 1
    where id = p_organization and revision = p_revision returning revision into current_revision;
  if not found then raise serialization_failure using message = 'Planning revision changed'; end if;

  if (p_store->'version') is distinct from '1'::jsonb
    or jsonb_typeof(p_store->'rules') is distinct from 'object'
    or jsonb_typeof(p_store->'employees') is distinct from 'array'
    or jsonb_typeof(p_store->'shifts') is distinct from 'array'
    or jsonb_typeof(p_store->'swaps') is distinct from 'array'
  then raise invalid_parameter_value using message = 'Invalid planning store'; end if;

  -- Employee deletion cascades to shifts, swaps, days off and absences.
  delete from public.escala_employees where organization_id = p_organization;
  delete from public.escala_holidays where organization_id = p_organization;
  delete from public.escala_labor_instruments where organization_id = p_organization;
  delete from public.escala_workspace_locations where organization_id = p_organization;

  insert into public.escala_employees (organization_id, id, sector_id, data, position)
    select p_organization, item->>'id', item->>'team', item, ordinal
    from jsonb_array_elements(p_store->'employees') with ordinality as entries(item, ordinal);
  insert into public.escala_shifts (organization_id, id, employee_id, data, position)
    select p_organization, item->>'id', item->>'employeeId', item, ordinal
    from jsonb_array_elements(p_store->'shifts') with ordinality as entries(item, ordinal);
  insert into public.escala_swaps (organization_id, id, from_shift_id, to_shift_id, data, position)
    select p_organization, item->>'id', item->>'fromShiftId', item->>'toShiftId', item, ordinal
    from jsonb_array_elements(p_store->'swaps') with ordinality as entries(item, ordinal);
  insert into public.escala_days_off (organization_id, id, employee_id, data, position)
    select p_organization, item->>'id', item->>'employeeId', item, ordinal
    from jsonb_array_elements(p_store->'dayOffs') with ordinality as entries(item, ordinal);
  insert into public.escala_absences (organization_id, id, employee_id, data, position)
    select p_organization, item->>'id', item->>'employeeId', item, ordinal
    from jsonb_array_elements(p_store->'absences') with ordinality as entries(item, ordinal);
  insert into public.escala_holidays (organization_id, id, data, position)
    select p_organization, item->>'id', item, ordinal
    from jsonb_array_elements(p_store->'holidays') with ordinality as entries(item, ordinal);
  insert into public.escala_labor_instruments (organization_id, id, data, position)
    select p_organization, item->>'id', item, ordinal
    from jsonb_array_elements(p_store #> '{labor,instruments}') with ordinality as entries(item, ordinal);
  insert into public.escala_schedule_rules (organization_id, data)
  values (p_organization,
    (select jsonb_object_agg(key, case
      when key = 'labor' then value - 'instruments'
      when key in ('employees','shifts','swaps','dayOffs','absences','holidays') then '[]'::jsonb
      else value end)
     from jsonb_each(p_store - 'workspaceLocation')))
  on conflict (organization_id) do update set data = excluded.data;

  if p_store ? 'workspaceLocation' then
    insert into public.escala_workspace_locations (organization_id, data)
      values (p_organization, p_store->'workspaceLocation');
  end if;
  return current_revision;
end;
$$;

revoke all on function public.escala_read_planning(uuid, uuid),
  public.escala_write_planning(uuid, uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.escala_read_planning(uuid, uuid),
  public.escala_write_planning(uuid, uuid, integer, jsonb) to service_role;
