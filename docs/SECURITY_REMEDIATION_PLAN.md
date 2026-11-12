# RESTO OS Security Remediation Plan

This branch contains a reviewed security-baseline migration proposal. It is **not applied to production**.

## What the migration does
- Adds explicit deny-by-default RLS policies to the 23 tables that currently have RLS enabled but no policies. This closes direct PostgREST access; it does not pretend those internal tables already have a complete staff authorization model.
- Pins safe search paths on the eight functions flagged by the live Supabase Security Advisor.
- Revokes public/anon/authenticated execution from privileged RPCs that currently trust caller-supplied staff IDs or accept arbitrary restaurant/table identifiers without checking `auth.uid()`.
- Keeps the guest QR verification RPC callable because physical QR scanning is an intended anonymous entry point.
- Keeps `get_current_user_role()` callable only by authenticated users for RLS expressions.

## Important limitations
1. This is a containment baseline, not the final complete permission matrix. Staff read/write policies for kitchen stations, suppliers, role permissions, refunds, notifications, inventory movements, etc. must be added after staff identity is bound to Supabase Auth and role membership is verified.
2. Closing the privileged payment/table-management RPCs will disable those operations until replacements are deployed. Do not apply during restaurant service without a tested cutover plan.
3. The current QR RPC returns a bearer session token to anyone holding the permanent table QR. A stronger design should exchange the QR secret for a short-lived, HttpOnly/secure session credential through an Edge Function and avoid returning reusable session secrets in public JSON.
4. `confirm_cash_payment` and `settle_table_bill_and_close_session` contain legacy settlement behavior (including hard-coded 5% assumptions in one function) and must be replaced with one authoritative transaction that validates the authenticated counter staff member, outstanding balance, payment method, tax settings, and idempotency key.
5. The current `server_calculate_order_totals` accepts caller-provided tax rates. Replacement must load tax rates from `restaurant_settings` and validate menu item, variant, and add-on relationships within one restaurant.
6. Supabase migration history was empty at audit time. Reconcile this migration against the live catalog and test on a restored staging branch before applying.

## Remaining application work
- Replace local adapter staff login with Supabase Auth and a protected profile lookup; remove seeded demo credentials from production bundles.
- Replace local customer session restore with server verification.
- Route order creation and settlement through transactional RPCs/Edge Functions; use database-generated prices and idempotency constraints.
- Add Supabase Realtime publication/subscriptions for orders, kitchen tickets, waiter calls, payments and table status after checking publication membership and RLS behavior.
- Add integration tests for anon QR, unauthenticated RPC denial, staff role matrix, order idempotency, payment idempotency, partial payments, invoice/tax totals and realtime event delivery.

## Release gates
- Verify a successful backup/recovery point.
- Restore into a staging project and apply the migration there first.
- Run security and performance advisors; no unreviewed warnings.
- Run app build, lint, unit, integration and browser E2E suites.
- Approve production cutover and deployment separately.
