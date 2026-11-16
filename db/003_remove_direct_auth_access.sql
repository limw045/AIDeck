-- Auth identity lookup uses the Supabase Admin API, so the portal database
-- login has no need to read auth.users directly.
begin;
revoke select (id, email, created_at) on auth.users from aideck_runtime;
revoke usage on schema auth from aideck_runtime;
drop policy if exists aideck_runtime_read on auth.users;
commit;
