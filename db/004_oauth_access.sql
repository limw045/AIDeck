begin;

create table aideck.oauth_clients (
  app_key text primary key references aideck.applications(key),
  client_id text unique not null,
  redirect_uri text unique not null,
  allowed_scopes text[] not null,
  enabled boolean not null default false
);
alter table aideck.oauth_clients enable row level security;
revoke all on aideck.oauth_clients from public, anon, authenticated;
grant select on aideck.oauth_clients to aideck_runtime;
create policy aideck_runtime_read on aideck.oauth_clients
  for select to aideck_runtime using (true);

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'aideck_authz') then
    create role aideck_authz nologin noinherit;
  end if;
end $$;
grant usage on schema aideck to aideck_authz;
grant aideck_authz to current_user;
grant create on schema public to aideck_authz;
grant select on aideck.members, aideck.applications, aideck.assignments, aideck.oauth_clients to aideck_authz;
create policy aideck_authz_read on aideck.members for select to aideck_authz using (true);
create policy aideck_authz_read on aideck.applications for select to aideck_authz using (true);
create policy aideck_authz_read on aideck.assignments for select to aideck_authz using (true);
create policy aideck_authz_read on aideck.oauth_clients for select to aideck_authz using (true);

create function public.aideck_can_access_app(app_key text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  -- Custom roles cannot receive auth schema grants; use the same verified request claims as auth.uid().
  with claims as (select nullif(current_setting('request.jwt.claims', true), '')::jsonb as jwt)
  select exists (
    select 1
    from aideck.members m
    join aideck.assignments g on g.user_id = m.user_id
    join aideck.applications a on a.key = g.app_key
    join aideck.oauth_clients c on c.app_key = a.key
    where m.user_id = (select jwt->>'sub' from claims)::uuid and m.status = 'active'
      and a.key = $1 and a.enabled and c.enabled
      and g.visible and g.provision_status = 'ready'
      and ((select jwt->>'client_id' from claims) is null
        or c.client_id = (select jwt->>'client_id' from claims))
  );
$$;
revoke all on function public.aideck_can_access_app(text) from public, anon, authenticated;
grant execute on function public.aideck_can_access_app(text) to authenticated;
alter function public.aideck_can_access_app(text) owner to aideck_authz;
revoke create on schema public from aideck_authz;
revoke aideck_authz from current_user;

notify pgrst, 'reload schema';
commit;
