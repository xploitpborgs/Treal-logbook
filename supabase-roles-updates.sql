-- 1. Create Supervisor Updates Table
create table if not exists supervisor_updates (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  author_id uuid references auth.users(id) not null,
  department text not null,
  shift text not null,
  body text not null
);

alter table supervisor_updates enable row level security;

create policy "Enable read for Supervisors, GM, HR, Admin" on supervisor_updates for select
using (
  (select role from profiles where id = auth.uid()) in ('supervisor', 'gm', 'hr', 'system_admin')
);

create policy "Enable insert for Supervisors" on supervisor_updates for insert
with check (
  (select role from profiles where id = auth.uid()) = 'supervisor'
);

create policy "Enable update for own updates" on supervisor_updates for update
using (
  auth.uid() = author_id
);


-- 2. Create HR Updates Table
create table if not exists hr_updates (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  author_id uuid references auth.users(id) not null,
  title text not null,
  body text not null
);

alter table hr_updates enable row level security;

create policy "Enable read for Supervisors, GM, HR, Admin" on hr_updates for select
using (
  (select role from profiles where id = auth.uid()) in ('supervisor', 'gm', 'hr', 'system_admin')
);

create policy "Enable insert for HR" on hr_updates for insert
with check (
  (select role from profiles where id = auth.uid()) = 'hr'
);

create policy "Enable update for own updates" on hr_updates for update
using (
  auth.uid() = author_id
);

-- Note: We also need to ensure the 'profiles' table allows 'hr' as a role and handles the 'escalated' status in 'log_entries'.
-- Supabase handles text columns flexibly unless restricted by a check constraint.
