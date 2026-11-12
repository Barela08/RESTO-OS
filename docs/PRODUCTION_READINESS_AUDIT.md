# RESTO OS Production Readiness Audit

**Audit date:** 2026-11-12  
**Supabase project:** `mklcrcyubohgfosgxmrm`  
**Repository branch:** `security-hardening`

## Executive status

The repository and Supabase project are not yet production-ready as a connected restaurant operations system. The current frontend still contains demo/in-memory data flows and local persistence. The Supabase database is populated and has RLS enabled on its public tables, but the current security posture is not safe for public production traffic.

No production DDL, data mutation, migration application, deployment, or merge was performed as part of this audit.

## Verified findings

### Frontend / repository

- The original branch used a fake demo Supabase URL/key fallback. This was removed on `security-hardening`; the client now fails fast when valid browser-safe Supabase environment variables are absent.
- `.env.example` was updated to document the required Supabase URL and publishable key. No mock fallback should be used in production.
- `src/services/databaseAdapter.ts` still seeds demo restaurant, staff, menu and operational records in process memory. It also contains hard-coded demo staff identities and password-like values; this file must not be used as a production authentication source and the seeded credentials must be removed from production builds.
- `src/store/authStore.ts` authenticates against the local adapter and restores staff identity from browser storage.
- `src/app/guards/CustomerSessionGuard.tsx` contains a table selector intended for demo/testing.
- `src/store/sessionStore.ts` restores table sessions from the local adapter rather than revalidating against the server.
- The current QR helper describes daily tokens, while the requested product behavior requires permanent table QR codes and silent resume of an active session.

### Supabase

- Public schema tables have RLS enabled, but 23 tables were reported by the Security Advisor as having no RLS policies.
- Security Advisor reported 8 functions with mutable search paths.
- Security Advisor reported 10 SECURITY DEFINER functions executable by `anon` and `authenticated`.
- Several existing policies are overly broad and allow public read/write access to operational records. These must be redesigned against actual ownership, role and restaurant boundaries.
- Existing production data and function definitions must be preserved and reviewed before changing policies or function grants.

## Required implementation sequence

1. Verify a recoverable Supabase backup in the Dashboard. Do not apply production DDL before this is confirmed.
2. Replace demo Supabase configuration with explicit environment validation and remove mock fallback from production configuration.
3. Implement Supabase Auth-backed staff identity and server-authoritative role checks. Do not trust localStorage or user-editable JWT metadata for authorization.
4. Replace local adapter persistence for orders, order items, table sessions, waiter calls, kitchen tickets, payments and invoices with database-backed operations.
5. Implement secure permanent QR verification and active-session resume.
6. Implement transactional server-side order pricing, payment settlement, invoice creation and loyalty issuance with idempotency.
7. Add narrowly scoped RLS policies for every exposed table and restrict SECURITY DEFINER function execution. Set safe search paths and validate caller identity inside privileged functions.
8. Add Realtime subscriptions for kitchen, waiter, counter and owner views.
9. Run typecheck, lint, automated tests, advisor checks and end-to-end smoke tests.
10. Deploy only after successful verification and approval.

## Production safety rules

- Never put a Supabase service-role/secret key in browser code or any `VITE_*` variable.
- Do not expose demo credentials or seeded demo staff accounts in production.
- Do not drop or truncate populated tables as a shortcut.
- Do not run old migration files blindly. Supabase migration history was previously found empty; reconcile actual live schema before adopting migrations.
- Do not describe the app as production-ready until real database flows and cross-role tests pass.

## Current change-set status (`security-hardening`)

- [x] Remove fake Supabase URL/key fallback and require explicit browser-safe environment configuration.
- [x] Update `.env.example` to remove mock-fallback configuration and document publishable-key setup.
- [x] Record the live database and application security findings in this audit.
- [ ] Replace local staff authentication with Supabase Auth and server-side role resolution.
- [ ] Replace local customer session/QR verification with a server-verified permanent QR workflow.
- [ ] Replace local order/payment persistence with transactional database RPCs.
- [ ] Replace browser-local dashboard synchronization with Supabase Realtime.
- [ ] Reconcile the live schema and existing functions before preparing a safe, idempotent migration.
- [ ] Run build, lint, automated tests and end-to-end acceptance tests.

**Validation limitation:** This GitHub-only change session did not execute the repository's npm scripts. Build, lint and test status are therefore unverified. The branch is not deployable until those checks pass and the required Vercel environment variables are configured.

## Backup gate

**Status at audit time: NOT CHECKED by project owner.** Production schema changes remain blocked until the owner verifies the latest successful backup/recovery point in Supabase Dashboard → Database → Backups.


## Follow-up verification (2026-11-12)

- The Supabase Realtime publication already contains the core operational tables: `orders`, `order_items`, `kitchen_tickets`, `waiter_calls`, `payments`, `invoices`, `restaurant_tables`, and `table_sessions`, among other tables. This verifies publication membership only; frontend subscriptions and event delivery still require implementation and tests.
- A security-baseline migration proposal was added at `supabase/migrations/20261112090000_security_baseline.sql`. It creates explicit deny-by-default policies for the 23 tables flagged as having no policies, pins search paths on the eight flagged functions, and revokes execution of privileged RPCs that currently trust caller-supplied staff IDs. It is intentionally not applied to production because the backup status remains unverified and the restrictive cutover requires staging validation.
- Added `.github/workflows/ci.yml` to run npm install, production build/typecheck, lint, and unit tests on pushes and pull requests. Results are pending GitHub Actions execution.
- No Edge Functions are currently deployed. No Edge Function has been deployed by this change set.
- Staff Auth, permanent QR client integration, transactional order/payment replacement, Realtime frontend subscriptions, and end-to-end tests remain implementation work. The project is not production-ready.
