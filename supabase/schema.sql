-- Future persistence foundation. Run in a fresh Supabase project after reviewing
-- the README. This schema alone does not connect the local demonstration app.
begin;
create table public.organizations (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) > 0),
 created_at timestamptz not null default now()
);
create table public.memberships (
 organization_id uuid not null references public.organizations on delete cascade,
 user_id uuid not null references auth.users on delete cascade,
 role text not null check (role in ('admin','supervisor','employee')),
 primary key (organization_id,user_id)
);
create function public.is_member(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.memberships where organization_id=org and user_id=(select auth.uid()));
$$;
create function public.can_manage(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.memberships where organization_id=org and user_id=(select auth.uid()) and role in ('admin','supervisor'));
$$;
revoke all on function public.is_member(uuid) from public;
revoke all on function public.can_manage(uuid) from public;
grant execute on function public.is_member(uuid), public.can_manage(uuid) to authenticated;
create table public.employees (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations on delete cascade,
 name text not null, role text not null,
 team text not null check (team in ('Campo','Suporte','Atendimento')),
 regime text not null check (regime in ('5x2','6x1')),
 sunday_every smallint not null default 3 check (sunday_every between 2 and 5),
 unique(organization_id,id)
);
create table public.schedule_rules (
 organization_id uuid primary key references public.organizations on delete cascade,
 daily_hours numeric not null default 8 check (daily_hours between 1 and 12),
 weekly_hours numeric not null default 44 check (weekly_hours between 1 and 60),
 intershift_hours numeric not null default 11 check (intershift_hours between 11 and 48),
 weekly_rest_hours numeric not null default 35 check (weekly_rest_hours between 35 and 72),
 max_consecutive_days smallint not null default 6 check (max_consecutive_days between 1 and 6),
 long_break_minutes smallint not null default 60 check (long_break_minutes between 30 and 120),
 coverage smallint not null default 4 check (coverage between 1 and 100)
);
create table public.shifts (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations on delete cascade,
 employee_id uuid not null,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 break_minutes smallint not null check (break_minutes between 0 and 120),
 foreign key (organization_id,employee_id) references public.employees(organization_id,id),
 check (ends_at > starts_at and ends_at <= starts_at + interval '24 hours'),
 check (extract(epoch from ends_at - starts_at) > break_minutes * 60),
 unique(organization_id,id)
);
create index shifts_employee_time on public.shifts(organization_id,employee_id,starts_at);
create table public.shift_swaps (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations on delete cascade,
 from_shift_id uuid not null, to_shift_id uuid not null,
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 foreign key (organization_id,from_shift_id) references public.shifts(organization_id,id),
 foreign key (organization_id,to_shift_id) references public.shifts(organization_id,id),
 check (from_shift_id <> to_shift_id)
);
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.employees enable row level security;
alter table public.schedule_rules enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_swaps enable row level security;
create policy organizations_read on public.organizations for select to authenticated using(public.is_member(id));
create policy memberships_read on public.memberships for select to authenticated using(public.is_member(organization_id));
create policy employees_read on public.employees for select to authenticated using(public.is_member(organization_id));
create policy employees_manage on public.employees for all to authenticated using(public.can_manage(organization_id)) with check(public.can_manage(organization_id));
create policy rules_read on public.schedule_rules for select to authenticated using(public.is_member(organization_id));
create policy rules_manage on public.schedule_rules for all to authenticated using(public.can_manage(organization_id)) with check(public.can_manage(organization_id));
create policy shifts_read on public.shifts for select to authenticated using(public.is_member(organization_id));
create policy swaps_read on public.shift_swaps for select to authenticated using(public.is_member(organization_id));
-- No direct shift/swap write grants or write RLS policies: enable writes only via
-- a future authenticated transactional RPC with tenant checks, locking, and the
-- complete rule engine. RLS alone does not validate CLT rules or prevent races.
revoke all on public.shifts, public.shift_swaps from anon, authenticated;
grant select on public.shifts, public.shift_swaps to authenticated;
-- Organization + initial admin membership must be provisioned through a trusted
-- administrative process. Never expose a service-role key to the browser.
commit;
