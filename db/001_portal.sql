-- Run with a database owner after reviewing the target Supabase project.
create schema if not exists aideck;

create table if not exists aideck.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  department text not null,
  employee_type text not null check (employee_type in ('full_time', 'intern', 'contractor')),
  ticketing_department_id uuid,
  kind text not null check (kind in ('staff', 'client')),
  status text not null default 'invited' check (status in ('invited', 'active', 'suspended')),
  is_superadmin boolean not null default false,
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists aideck.applications (
  key text primary key,
  name text not null,
  description text not null default '',
  kind text not null check (kind in ('web', 'download', 'upcoming')),
  url text,
  enabled boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists aideck.assignments (
  user_id uuid not null references aideck.members(user_id) on delete cascade,
  app_key text not null references aideck.applications(key),
  site_role text,
  organization_id text,
  can_manage boolean not null default false,
  visible boolean not null default true,
  provision_status text not null default 'pending' check (provision_status in ('pending', 'ready', 'failed')),
  provision_error text,
  updated_at timestamptz not null default now(),
  primary key (user_id, app_key)
);

create table if not exists aideck.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid,
  target_id uuid,
  app_key text,
  action text not null,
  outcome text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table aideck.members enable row level security;
alter table aideck.applications enable row level security;
alter table aideck.assignments enable row level security;
alter table aideck.audit_events enable row level security;

revoke all on schema aideck from public, anon, authenticated;
revoke all on all tables in schema aideck from public, anon, authenticated;
revoke all on all sequences in schema aideck from public, anon, authenticated;

insert into aideck.applications (key, name, description, kind, url, sort_order)
values
  ('signora', 'Signora', 'Document signing', 'web', 'https://signora-web.vercel.app', 10),
  ('ticketing', 'GT AI Ticketing', 'Department support desk', 'web', 'https://gt-ai-ticketing.vercel.app', 20),
  ('riskscreen', 'RiskScreen', 'Windows installer', 'download', null, 30),
  ('sessiontrack', 'Session Track', 'Integration is upcoming', 'upcoming', 'https://session-track-f.vercel.app', 40)
on conflict (key) do nothing;
