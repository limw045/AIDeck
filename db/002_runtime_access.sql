-- Apply as a database owner. Set a strong password and LOGIN separately in the
-- deployment secret manager; this migration never contains credentials.
begin;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'aideck_runtime') then
    create role aideck_runtime nologin noinherit;
  end if;
end $$;

grant usage on schema aideck, public, signora, gtjbticketing to aideck_runtime;
grant select, insert, update on aideck.members, aideck.assignments, aideck.applications to aideck_runtime;
grant select, insert on aideck.audit_events to aideck_runtime;
grant usage on sequence aideck.audit_events_id_seq to aideck_runtime;

grant select, insert on public.profiles to aideck_runtime;
grant select on signora.organizations to aideck_runtime;
grant select, insert, update on signora.users to aideck_runtime;
grant select on gtjbticketing.departments to aideck_runtime;
grant select, insert, update on gtjbticketing.profiles to aideck_runtime;

create policy aideck_runtime_access on aideck.members
  for all to aideck_runtime using (true) with check (true);
create policy aideck_runtime_access on aideck.assignments
  for all to aideck_runtime using (true) with check (true);
create policy aideck_runtime_access on aideck.applications
  for all to aideck_runtime using (true) with check (true);
create policy aideck_runtime_access on aideck.audit_events
  for all to aideck_runtime using (true) with check (true);

create policy aideck_runtime_access on public.profiles
  for all to aideck_runtime using (true) with check (true);
create policy aideck_runtime_read on signora.organizations
  for select to aideck_runtime using (true);
create policy aideck_runtime_access on signora.users
  for all to aideck_runtime using (true) with check (true);
create policy aideck_runtime_read on gtjbticketing.departments
  for select to aideck_runtime using (true);
create policy aideck_runtime_access on gtjbticketing.profiles
  for all to aideck_runtime using (true) with check (true);

commit;
