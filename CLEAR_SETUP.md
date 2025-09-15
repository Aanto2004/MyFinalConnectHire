### ConnectHire - Clear Setup and Functionality Guide

- **Overview**: Job portal connecting developers and employers with OTP-based authentication.

- **Features**:
  - OTP email auth (signup/signin)
  - Developer and employer profiles
  - Post and browse jobs
  - Apply to jobs and review applications
  - Skills lookup and basic notifications

- **Requirements**:
  - Node.js 16+
  - Supabase project (free tier is fine)
  - SMTP credentials (Gmail or your provider)

- **Configure**:
  - Open `config.js` and set:
    - `supabase.url`, `supabase.anonKey`
    - `smtp.host`, `smtp.port`, `smtp.secure`, `smtp.user`, `smtp.password`
  - Optional: set `PORT` and `NODE_ENV` environment variables

- **Install & Run**:
  - Install deps: `npm install`
  - Start server: `npm start`
  - Visit: `http://localhost:3000`

- **Database Setup (Supabase)**:
  - Open Supabase SQL editor
  - Run files in order:
    1. `supabase_schema.sql`
    2. `supabase_policies.sql`
    3. `supabase_seed.sql` (optional)

- **OTP Flow**:
  - Request code: `POST /api/send-otp` with `{ email, purpose: 'signup'|'signin' }`
  - Verify code: `POST /api/verify-otp` with `{ email, otp, purpose }`
  - Server writes to `otp_verification` and creates a user on signup

- **Key Endpoints**:
  - Auth: `/api/send-otp`, `/api/verify-otp`, `/api/auth/status`, `/api/auth/logout`
  - Profiles: `/api/developer-profile`, `/api/employer-profile`, and respective `GET` routes
  - Jobs: `GET /api/jobs`, `POST /api/jobs`, `GET /api/jobs/:jobId`, `GET /api/jobs/employer/:employerId`
  - Applications: `POST /api/applications`, employer/developer application listing routes
  - Utilities: `/api/skills`, `/api/health`, `/api/test-db`, `/api/test-otp`

- **SQL References**:
  - Tables: `users`, `developer_profiles`, `employer_profiles`, `jobs`, `applications`, `skills`, `otp_verification`, `notifications`
  - Indexes and triggers included in `supabase_schema.sql`
  - RLS policies in `supabase_policies.sql` are permissive for server-side access

- **Mobile UI Tip**:
  - Dashboard tabs use compact icons in mobile view for faster access.

- **Troubleshooting**:
  - SMTP: check credentials; in `development` the OTP may be returned in the response if email fails
  - Supabase: verify `supabase.url` and `anonKey`
  - Health checks: `/api/health`, `/api/test-db`, `/api/test-otp`

- **Cleaning & Optimization**:
  - Comments removed from backend config and server for clarity
  - Frontend nav optimized for mobile with single-line icon tabs
