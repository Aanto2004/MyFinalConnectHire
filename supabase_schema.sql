-- Supabase schema for ConnectHire
-- Run this in the Supabase SQL editor (in order):
-- 1) supabase_schema.sql
-- 2) supabase_policies.sql
-- 3) (optional) supabase_seed.sql

-- Extensions
create extension if not exists pgcrypto;

-- Enum-like constraints (kept as text for flexibility)
-- salary_type: hourly | monthly | yearly | project
-- job_type: full_time | part_time | contract | freelance | internship
-- experience_level: entry | junior | mid | senior | lead
-- application_status: pending | reviewed | shortlisted | accepted | rejected

-- users
create table if not exists public.users (
	id uuid primary key default gen_random_uuid(),
	email text not null unique,
	created_at timestamptz not null default now()
);

-- developer_profiles
create table if not exists public.developer_profiles (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null unique references public.users(id) on delete cascade,
	name text,
	age integer,
	photo_url text,
	resume_url text,
	skills text[] not null default '{}',
	experience text,
	location text,
	preferred_job_location text,
	short_description text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

-- employer_profiles
create table if not exists public.employer_profiles (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null unique references public.users(id) on delete cascade,
	name text,
	company_name text,
	company_location text,
	company_logo_url text,
	company_description text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

-- jobs
create table if not exists public.jobs (
	id uuid primary key default gen_random_uuid(),
	employer_id uuid not null references public.employer_profiles(id) on delete cascade,
	role text,
	description text,
	location text,
	skills_required text[] not null default '{}',
	salary_min numeric,
	salary_max numeric,
	salary_type text,
	job_type text,
	experience_level text,
	is_remote boolean default false,
	status text default 'active',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

-- applications
create table if not exists public.applications (
	id uuid primary key default gen_random_uuid(),
	job_id uuid not null references public.jobs(id) on delete cascade,
	developer_id uuid not null references public.developer_profiles(id) on delete cascade,
	cover_letter text,
	status text not null default 'pending',
	notes text,
	reviewed_at timestamptz,
	applied_at timestamptz not null default now(),
	unique (job_id, developer_id)
);

-- otp_verification
create table if not exists public.otp_verification (
	id uuid primary key default gen_random_uuid(),
	email text not null,
	otp_code text not null,
	purpose text not null, -- signup | signin
	expires_at timestamptz not null,
	is_used boolean not null default false,
	created_at timestamptz not null default now()
);

-- skills (lookup)
create table if not exists public.skills (
	id serial primary key,
	name text not null unique,
	category text,
	created_at timestamptz not null default now()
);

-- notifications (optional utility)
create table if not exists public.notifications (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references public.users(id) on delete cascade,
	title text not null,
	body text,
	is_read boolean not null default false,
	created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_users_email on public.users (email);

create index if not exists idx_dev_profiles_user_id on public.developer_profiles (user_id);
create index if not exists idx_dev_profiles_skills_gin on public.developer_profiles using gin (skills);
create index if not exists idx_dev_profiles_created_at on public.developer_profiles (created_at);

create index if not exists idx_emp_profiles_user_id on public.employer_profiles (user_id);
create index if not exists idx_emp_profiles_created_at on public.employer_profiles (created_at);

create index if not exists idx_jobs_employer_id on public.jobs (employer_id);
create index if not exists idx_jobs_location on public.jobs (location);
create index if not exists idx_jobs_skills_required_gin on public.jobs using gin (skills_required);
create index if not exists idx_jobs_created_at on public.jobs (created_at);

create index if not exists idx_applications_job_id on public.applications (job_id);
create index if not exists idx_applications_developer_id on public.applications (developer_id);
create index if not exists idx_applications_applied_at on public.applications (applied_at);

create index if not exists idx_otp_email on public.otp_verification (email);
create index if not exists idx_otp_created_at on public.otp_verification (created_at);
create index if not exists idx_otp_lookup on public.otp_verification (email, otp_code, purpose, is_used);

-- Triggers to update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

-- Attach triggers where column exists
-- developer_profiles
create trigger if not exists trg_dev_profiles_updated
before update on public.developer_profiles
for each row execute function public.set_updated_at();

-- employer_profiles
create trigger if not exists trg_emp_profiles_updated
before update on public.employer_profiles
for each row execute function public.set_updated_at();

-- jobs
create trigger if not exists trg_jobs_updated
before update on public.jobs
for each row execute function public.set_updated_at();
