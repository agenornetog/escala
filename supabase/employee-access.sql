-- Independent of schema.sql. Run once in Supabase SQL Editor for this feature.
-- Only the server's service_role can access credentials and published schedules.
begin;
create table public.escala_employee_access (
 workspace_id text not null,
 employee_id text not null,
 email text not null check (email = lower(trim(email))),
 password_hash text not null check (password_hash ~ '^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$'),
 enabled boolean not null default true,
 session_version uuid not null default gen_random_uuid(),
 schedule jsonb not null check (jsonb_typeof(schedule) = 'object' and schedule->'employee'->>'id' = employee_id),
 updated_at timestamptz not null default now(),
 primary key(workspace_id,employee_id),
 unique(workspace_id,email)
);
alter table public.escala_employee_access enable row level security;
revoke all on public.escala_employee_access from public,anon,authenticated;
grant select,insert,update,delete on public.escala_employee_access to service_role;
create table public.escala_employee_login_attempts (
 workspace_id text not null, key text not null,
 started_at timestamptz not null default now(), attempts integer not null,
 primary key(workspace_id,key)
);
alter table public.escala_employee_login_attempts enable row level security;
revoke all on public.escala_employee_login_attempts from public,anon,authenticated;
grant select,insert,update,delete on public.escala_employee_login_attempts to service_role;
create function public.escala_employee_login_allowed(p_workspace text,p_key text) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare counter integer;
begin
 delete from public.escala_employee_login_attempts where started_at < now()-interval '1 day';
 insert into public.escala_employee_login_attempts as a(workspace_id,key,attempts)
 values(p_workspace,p_key,1)
 on conflict(workspace_id,key) do update set
 attempts=case when a.started_at < now()-interval '15 minutes' then 1 else a.attempts+1 end,
 started_at=case when a.started_at < now()-interval '15 minutes' then now() else a.started_at end
 returning attempts into counter;
 return counter <= 20;
end;
$$;
create function public.escala_save_employee_access(p_workspace text,p_employee text,p_email text,p_password_hash text,p_enabled boolean,p_schedule jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
 -- Conflict handling preserves the old hash on publication without a new password.
 -- Rotation is atomic, including races between password resets and publication.
 insert into public.escala_employee_access as a(workspace_id,employee_id,email,password_hash,enabled,schedule)
 values(p_workspace,p_employee,p_email,coalesce(p_password_hash,(select password_hash from public.escala_employee_access where workspace_id=p_workspace and employee_id=p_employee)),p_enabled,p_schedule)
 on conflict(workspace_id,employee_id) do update set
 email=excluded.email,
 password_hash=coalesce(p_password_hash,a.password_hash),
 enabled=excluded.enabled,
 schedule=excluded.schedule,
 updated_at=now(),
 session_version=case when a.email<>excluded.email or a.enabled<>excluded.enabled or p_password_hash is not null then gen_random_uuid() else a.session_version end;
end;
$$;
revoke all on function public.escala_employee_login_allowed(text,text), public.escala_save_employee_access(text,text,text,text,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.escala_employee_login_allowed(text,text), public.escala_save_employee_access(text,text,text,text,boolean,jsonb) to service_role;
commit;
