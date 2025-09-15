-- Optional seed data for ConnectHire
-- Run after supabase_schema.sql and supabase_policies.sql

-- Seed skills
insert into public.skills (name, category)
values
  ('JavaScript', 'Programming'),
  ('TypeScript', 'Programming'),
  ('React', 'Frontend'),
  ('Node.js', 'Backend'),
  ('Express', 'Backend'),
  ('PostgreSQL', 'Database'),
  ('Tailwind CSS', 'Frontend'),
  ('AWS', 'Cloud')
ON CONFLICT (name) DO NOTHING;

-- Example users (emails only). Remove if using Supabase Auth separately.
insert into public.users (email)
values
  ('dev@example.com'),
  ('hr@example.com')
ON CONFLICT (email) DO NOTHING;

-- Example minimal profiles (will fail if users not present)
-- Developer profile
insert into public.developer_profiles (user_id, name, skills, experience, location, short_description)
select id, 'Sample Developer', array['JavaScript','React'], 'junior', 'Remote', 'Front-end developer'
from public.users where email = 'dev@example.com'
ON CONFLICT (user_id) DO NOTHING;

-- Employer profile
insert into public.employer_profiles (user_id, name, company_name, company_location)
select id, 'HR Lead', 'Acme Corp', 'Remote'
from public.users where email = 'hr@example.com'
ON CONFLICT (user_id) DO NOTHING;
