create or replace function public.escala_employee_account_read(p_user uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'organization_id', account.organization_id, 'employee_id', account.employee_id,
    'allow_swaps', account.allow_swaps, 'schedule', jsonb_strip_nulls(jsonb_build_object(
      'employee', jsonb_build_object('id', employee.id, 'name', employee.data->>'name',
        'role', employee.data->>'role', 'regime', employee.data->>'regime'),
      'shifts', (select coalesce(jsonb_agg(shift.data order by shift.position, shift.id), '[]'::jsonb)
        from public.escala_shifts as shift where shift.organization_id = account.organization_id and shift.employee_id = account.employee_id),
      'dayOffs', (select coalesce(jsonb_agg(day_off.data order by day_off.position, day_off.id), '[]'::jsonb)
        from public.escala_days_off as day_off where day_off.organization_id = account.organization_id and day_off.employee_id = account.employee_id),
      'absences', (select coalesce(jsonb_agg(absence.data order by absence.position, absence.id), '[]'::jsonb)
        from public.escala_absences as absence where absence.organization_id = account.organization_id and absence.employee_id = account.employee_id),
      'holidays', (select coalesce(jsonb_agg(holiday.data order by holiday.position, holiday.id), '[]'::jsonb)
        from public.escala_holidays as holiday where holiday.organization_id = account.organization_id),
      'workspaceLocation', (select location.data from public.escala_workspace_locations as location
        where location.organization_id = account.organization_id)
    )), 'published_at', account.published_at,
    'company', jsonb_build_object('name', organization.name),
    'employee', jsonb_build_object('id', employee.id, 'name', employee.data->>'name',
      'role', employee.data->>'role', 'regime', employee.data->>'regime')
  ) order by organization.name, organization.id), '[]'::jsonb)
  from public.escala_employee_accounts as account
  join public.escala_employees as employee on employee.organization_id = account.organization_id and employee.id = account.employee_id
  join public.escala_organizations as organization on organization.id = account.organization_id
  where account.user_id = p_user;
$$;

create or replace function public.escala_employee_swap_submit(
  p_organization uuid, p_user uuid, p_shift text, p_reason text
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare employee text;
declare current_shift jsonb;
declare request_id uuid;
begin
  perform 1 from public.escala_organizations where id = p_organization for update;
  select account.employee_id, shift.data into employee, current_shift
    from public.escala_employee_accounts as account
    join public.escala_shifts as shift on shift.organization_id = account.organization_id and shift.employee_id = account.employee_id
    where account.organization_id = p_organization and account.user_id = p_user and account.allow_swaps
      and shift.id = p_shift
      and (shift.data->>'date')::date >= (now() at time zone 'America/Sao_Paulo')::date;
  if not found then raise insufficient_privilege; end if;
  insert into public.escala_employee_swap_requests (organization_id, employee_id, shift, reason)
    values (p_organization, employee, current_shift, p_reason) returning id into request_id;
  return request_id;
end;
$$;

create or replace function public.escala_employee_swap_decide(
  p_organization uuid, p_actor uuid, p_request uuid, p_decision text,
  p_revision integer, p_store jsonb, p_schedules jsonb
) returns integer
language plpgsql security invoker set search_path = '' as $$
declare next_revision integer;
begin
  perform 1 from public.escala_organizations where id = p_organization for update;
  perform 1 from public.escala_memberships
    where organization_id = p_organization and user_id = p_actor and active for share;
  if not found then raise insufficient_privilege; end if;
  update public.escala_employee_swap_requests
    set status = case when p_store is null then 'rejected' else 'approved' end, decision = p_decision
    where organization_id = p_organization and id = p_request and status = 'pending';
  if not found then raise serialization_failure; end if;
  if p_store is not null then
    next_revision := public.escala_write_planning(p_organization, p_actor, p_revision, p_store);
  end if;
  return next_revision;
end;
$$;
