create or replace function public.escala_employee_account_read(p_user uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'organization_id', account.organization_id, 'employee_id', account.employee_id,
    'allow_swaps', account.allow_swaps, 'schedule', jsonb_strip_nulls(jsonb_build_object(
      'employee', jsonb_build_object('id', employee.id, 'name', employee.data->>'name',
        'role', employee.data->>'role', 'regime', employee.data->>'regime',
        'weeklyTargetMinutes', employee.data->'weeklyTargetMinutes'),
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
