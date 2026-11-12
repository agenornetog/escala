create or replace function public.escala_read_planning(p_organization uuid, p_actor uuid) returns jsonb
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
  where o.id = p_organization and m.user_id = p_actor and m.active;
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
  select coalesce(jsonb_agg(id order by id), '[]'::jsonb) into items
    from public.escala_sectors where organization_id = p_organization;
  return jsonb_build_object('revision', current_revision, 'store', state || jsonb_build_object('teams', items));
end;
$$;

create or replace function public.escala_write_planning(
  p_organization uuid, p_actor uuid, p_revision integer, p_store jsonb
) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  current_revision integer;
begin
  perform 1 from public.escala_organizations where id = p_organization for update;
  perform 1 from public.escala_memberships
    where organization_id = p_organization and user_id = p_actor and active for share;
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

  -- The membership check above scopes all changes to this organization.
  if p_store ? 'teams' then
    if jsonb_typeof(p_store->'teams') <> 'array' or jsonb_array_length(p_store->'teams') > 200 then
      raise invalid_parameter_value using message = 'Invalid teams';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_store->'teams') as entries(item)
      where jsonb_typeof(item) <> 'string'
        or length(item #>> '{}') not between 1 and 60
        or btrim(item #>> '{}') <> (item #>> '{}')
        or (item #>> '{}') ~ '[[:cntrl:]]'
        or lower(item #>> '{}') = 'todas as equipes'
    ) then raise invalid_parameter_value using message = 'Invalid team name'; end if;
    insert into public.escala_sectors (organization_id, id)
      select p_organization, team from jsonb_array_elements_text(p_store->'teams') as entries(team)
    on conflict (organization_id, id) do nothing;
  end if;

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
     from jsonb_each(p_store - 'workspaceLocation' - 'teams')))
  on conflict (organization_id) do update set data = excluded.data;

  if p_store ? 'workspaceLocation' then
    insert into public.escala_workspace_locations (organization_id, data)
      values (p_organization, p_store->'workspaceLocation');
  end if;
  return current_revision;
end;
$$;
