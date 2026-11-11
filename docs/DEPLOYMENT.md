# RESTO OS - Production Deployment Guide

## 1. Hosting Architecture
- **Frontend:** Vercel (or Cloudflare Pages, Netlify)
  - Framework: Vite / React SPA
  - Build Command: `npm run build`
  - Output Directory: `dist`
  - Single Page App rewrites in `vercel.json`
- **Backend & Database:** Supabase (Managed PostgreSQL)
  - PostgreSQL Database with Row Level Security (RLS)
  - Realtime WebSocket publication on `orders`, `kitchen_tickets`, `waiter_calls`, `notifications`, `repeat_scan_requests`
  - Supabase Storage for menu photography and restaurant logos
  - Supabase Scheduled Edge Function or pg_cron for Daily QR generation at 00:00:01

## 2. Step-by-Step Deployment

### 2.1 Database Setup (Supabase)
1. Create a new Supabase Project.
2. In the Supabase SQL Editor, run the migrations in order:
   - `supabase/migrations/20261111000001_initial_schema.sql`
   - `supabase/migrations/20261111000002_rls_and_security.sql`
   - `supabase/migrations/20261111000003_functions_and_triggers.sql`
3. Run the seed data script:
   - `supabase/seed.sql`
4. Copy the Project URL and Anon API Key from `Project Settings > API`.

### 2.2 Frontend Deployment (Vercel)
1. Push the repository to GitHub.
2. In Vercel, import the repository.
3. Configure the following environment variables:
   - `VITE_SUPABASE_URL` = `https://<your-project>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `<your-anon-key>`
   - `VITE_DEFAULT_RESTAURANT_ID` = `rest-001-main`
   - `VITE_RESTAURANT_TIMEZONE` = `Asia/Kolkata`
   - `VITE_RAZORPAY_KEY_ID` = `rzp_live_...`
4. Deploy.

### 2.3 vercel.json
Included in root directory:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
