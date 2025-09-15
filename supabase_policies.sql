-- RLS policies for ConnectHire
-- Run after supabase_schema.sql

-- Enable RLS
alter table public.users enable row level security;
alter table public.developer_profiles enable row level security;
alter table public.employer_profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.otp_verification enable row level security;
alter table public.skills enable row level security;
alter table public.notifications enable row level security;

-- NOTE: This backend uses service role via server-side key. For simplicity, we create permissive policies for anon usage.
-- Adjust for production with auth.uid() once you integrate Supabase Auth.

-- users: allow read by anyone, insert/update via service role only
create policy if not exists users_select for select on public.users using (true);
create policy if not exists users_insert for insert on public.users with check (true);
create policy if not exists users_update for update on public.users using (true) with check (true);

-- developer_profiles: public read; owner write (simulated via user_id passed by server)
create policy if not exists dev_profiles_select for select on public.developer_profiles using (true);
create policy if not exists dev_profiles_insert for insert on public.developer_profiles with check (true);
create policy if not exists dev_profiles_update for update on public.developer_profiles using (true) with check (true);

-- employer_profiles: public read; owner write
create policy if not exists emp_profiles_select for select on public.employer_profiles using (true);
create policy if not exists emp_profiles_insert for insert on public.employer_profiles with check (true);
create policy if not exists emp_profiles_update for update on public.employer_profiles using (true) with check (true);

-- jobs: public read; employer write
create policy if not exists jobs_select for select on public.jobs using (true);
create policy if not exists jobs_insert for insert on public.jobs with check (true);
create policy if not exists jobs_update for update on public.jobs using (true) with check (true);

-- applications: public read; owner/employer write
create policy if not exists applications_select for select on public.applications using (true);
create policy if not exists applications_insert for insert on public.applications with check (true);
create policy if not exists applications_update for update on public.applications using (true) with check (true);

-- otp_verification: server writes; reads allowed for verification flows
create policy if not exists otp_select for select on public.otp_verification using (true);
create policy if not exists otp_insert for insert on public.otp_verification with check (true);
create policy if not exists otp_update for update on public.otp_verification using (true) with check (true);

-- skills: public read
create policy if not exists skills_select for select on public.skills using (true);
create policy if not exists skills_insert for insert on public.skills with check (true);

-- notifications: read by user; write via server
create policy if not exists notifications_select for select on public.notifications using (true);
create policy if not exists notifications_insert for insert on public.notifications with check (true);
create policy if not exists notifications_update for update on public.notifications using (true) with check (true);
