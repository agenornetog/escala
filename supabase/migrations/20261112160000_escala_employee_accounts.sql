create table public.escala_employee_accounts (
  organization_id uuid not null references public.escala_organizations on delete cascade,
  employee_id text not null,
  user_id uuid not null references auth.users on delete cascade,
  email text not null,
  allow_swaps boolean not null default false,
  schedule jsonb,
  published_at timestamptz,
  primary key (organization_id, employee_id),
  unique (organization_id, user_id)
);
create index escala_employee_accounts_user_idx on public.escala_employee_accounts (user_id);
-- Planning saves recreate employee rows. Access checks join the current employee instead of cascading those saves.
alter table public.escala_employee_accounts enable row level security;

create table public.escala_employee_swap_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.escala_organizations on delete cascade,
  employee_id text not null,
  shift jsonb not null,
  reason text not null check (length(btrim(reason)) between 1 and 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decision text check (length(decision) <= 500),
  created_at timestamptz not null default now()
);
create index escala_employee_swap_history_idx
  on public.escala_employee_swap_requests (organization_id, employee_id, created_at desc);
create unique index escala_employee_swap_pending_idx
  on public.escala_employee_swap_requests (organization_id, employee_id, (shift->>'id')) where status = 'pending';
alter table public.escala_employee_swap_requests enable row level security;

revoke all on public.escala_employee_accounts, public.escala_employee_swap_requests from public, anon, authenticated;
grant select, insert, update, delete on public.escala_employee_accounts, public.escala_employee_swap_requests to service_role;

create function public.escala_employee_account_link(
  p_organization uuid, p_actor uuid, p_employee text, p_email text, p_allow_swaps boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare target uuid;
declare confirmed boolean;
begin
  perform 1 from public.escala_organizations where id = p_organization for update;
  perform 1 from public.escala_memberships
    where organization_id = p_organization and user_id = p_actor and active for share;
  if not found then raise insufficient_privilege; end if;
  if not exists (select 1 from public.escala_employees where organization_id = p_organization and id = p_employee)
    then raise no_data_found; end if;
  select id, email_confirmed_at is not null into target, confirmed from auth.users where lower(email) = p_email;
  if target is null then return null; end if;
  insert into public.escala_employee_accounts as account (organization_id, employee_id, user_id, email, allow_swaps)
    values (p_organization, p_employee, target, p_email, p_allow_swaps)
  on conflict (organization_id, employee_id) do update set
    email = excluded.email, allow_swaps = excluded.allow_swaps
    where account.user_id = excluded.user_id;
  if not found then raise unique_violation; end if;
  return jsonb_build_object('confirmed', confirmed);
end;
$$;

create function public.escala_employee_account_read(p_user uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'organization_id', account.organization_id, 'employee_id', account.employee_id,
    'allow_swaps', account.allow_swaps, 'schedule', account.schedule, 'published_at', account.published_at,
    'company', jsonb_build_object('name', organization.name),
    'employee', jsonb_build_object('id', employee.id, 'name', employee.data->>'name',
      'role', employee.data->>'role', 'regime', employee.data->>'regime')
  ) order by organization.name, organization.id), '[]'::jsonb)
  from public.escala_employee_accounts as account
  join public.escala_employees as employee on employee.organization_id = account.organization_id and employee.id = account.employee_id
  join public.escala_organizations as organization on organization.id = account.organization_id
  where account.user_id = p_user;
$$;

create function public.escala_employee_publish(
  p_organization uuid, p_actor uuid, p_revision integer, p_schedules jsonb
) returns void
language plpgsql security invoker set search_path = '' as $$
declare current_revision integer;
begin
  select revision into current_revision from public.escala_organizations where id = p_organization for update;
  perform 1 from public.escala_memberships
    where organization_id = p_organization and user_id = p_actor and active for share;
  if not found then raise insufficient_privilege; end if;
  if current_revision is distinct from p_revision then raise serialization_failure; end if;
  update public.escala_employee_accounts as account
    set schedule = item.value, published_at = now()
    from jsonb_each(p_schedules) as item
    where account.organization_id = p_organization and account.employee_id = item.key;
  if not found then raise no_data_found; end if;
end;
$$;

create function public.escala_employee_swap_submit(
  p_organization uuid, p_user uuid, p_shift text, p_reason text
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare employee text;
declare published_shift jsonb;
declare request_id uuid;
begin
  perform 1 from public.escala_organizations where id = p_organization for update;
  select account.employee_id, item into employee, published_shift
    from public.escala_employee_accounts as account
    join public.escala_employees as e on e.organization_id = account.organization_id and e.id = account.employee_id
    cross join lateral jsonb_array_elements(account.schedule->'shifts') as item
    where account.organization_id = p_organization and account.user_id = p_user and account.allow_swaps
      and item->>'id' = p_shift and item->>'employeeId' = account.employee_id
      and (item->>'date')::date >= (now() at time zone 'America/Sao_Paulo')::date;
  if not found then raise insufficient_privilege; end if;
  insert into public.escala_employee_swap_requests (organization_id, employee_id, shift, reason)
    values (p_organization, employee, published_shift, p_reason) returning id into request_id;
  return request_id;
end;
$$;

create function public.escala_employee_swap_decide(
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
    perform public.escala_employee_publish(p_organization, p_actor, next_revision, p_schedules);
  end if;
  return next_revision;
end;
$$;

revoke all on function public.escala_employee_account_link(uuid,uuid,text,text,boolean),
  public.escala_employee_account_read(uuid),
  public.escala_employee_publish(uuid,uuid,integer,jsonb),
  public.escala_employee_swap_submit(uuid,uuid,text,text),
  public.escala_employee_swap_decide(uuid,uuid,uuid,text,integer,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.escala_employee_account_link(uuid,uuid,text,text,boolean),
  public.escala_employee_account_read(uuid),
  public.escala_employee_publish(uuid,uuid,integer,jsonb),
  public.escala_employee_swap_submit(uuid,uuid,text,text),
  public.escala_employee_swap_decide(uuid,uuid,uuid,text,integer,jsonb,jsonb) to service_role;
