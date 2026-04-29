drop table if exists security_events;

create table security_events (
  id uuid default gen_random_uuid() primary key,
  event_type text not null,
  description text,
  path text not null,
  user_email text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table security_events enable row level security;

-- Allow anyone to insert events
create policy "Enable insert for all" on security_events for insert with check (true);

-- Only allow System Admins to view the logs
create policy "Enable read for admins" on security_events for select 
using (
  (select role from profiles where id = auth.uid()) = 'system_admin'
);
