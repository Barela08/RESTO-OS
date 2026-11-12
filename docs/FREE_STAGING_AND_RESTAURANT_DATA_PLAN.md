# RESTO OS — Free Staging & Restaurant Data-Minimization Plan

**Status:** implementation plan; no production database changes are made by this document.

## 1. Cost constraint

The project must not depend on a paid Supabase development branch. Use:
- GitHub branch `security-hardening` for code and SQL review.
- GitHub Actions for typecheck, build, lint, unit tests, and PostgreSQL migration tests.
- A local PostgreSQL instance (Docker) for schema, migration, RLS, function, and transaction tests.
- Read-only inspection of the live Supabase project before preparing any production migration.

A local PostgreSQL test is not a perfect substitute for Supabase Auth, PostgREST, Realtime, or Edge Runtime. Those integration points must be explicitly tested against non-production credentials/environment where possible. Do not claim production verification based only on local tests.

## 2. Restaurant owner reporting: minimum useful data

The owner-facing dashboard should prioritize a compact sales history, not expose every operational record.

### Dashboard summary
- Today's gross billed amount.
- Today's completed/paid amount.
- Number of bills/orders today.
- Pending/unpaid amount, if any.
- Discounts and tax totals, shown separately.
- Date-wise sales totals for a selected period.
- Payment-method totals (cash, UPI, card, other), where recorded.
- Refund/void totals, separately identified.
- Optional comparison with the previous day or selected period.

### Bill history
Each historical bill should retain only the fields needed to retrieve, audit, and reproduce the transaction:
- Restaurant ID.
- Bill/invoice number and order reference.
- Created/closed timestamp and business date.
- Item descriptions, quantity, unit price, discount, tax rate/amount, and line total as charged at the time.
- Subtotal, discount total, tax total, grand total, amount paid, balance due, and payment status.
- Payment method and transaction reference where applicable.
- Staff actor ID for audit accountability.
- Refund/void status and reason, when applicable.

Historical invoice values must be immutable snapshots. Later menu-price or tax-setting changes must not rewrite old bills.

### Operational data still required
Do not remove the underlying order and payment detail merely because the owner dashboard shows summaries. The POS, kitchen, waiter, and billing workflows need current operational records to function. Keep only fields that are necessary for those workflows, access-control, accounting, and support.

### Data minimization
- Do not collect customer personal details unless a feature genuinely requires them.
- Avoid storing card numbers, UPI PINs, passwords, or payment credentials. Store only provider/reference identifiers and payment status.
- Do not expose customer, staff, supplier, audit, or payment-verification tables to public/anonymous clients.
- Scope every row by restaurant ID and enforce staff role/restaurant membership on the server.
- Retention and deletion periods for legally relevant invoices, tax records, audit logs, and customer data must be configurable only after confirming applicable Indian accounting/tax/legal requirements. Do not auto-delete invoices based on an arbitrary short period.

## 3. Reporting implementation rules

- Daily totals must be calculated from persisted bill/payment records on the server/database, not from browser state.
- Use the restaurant's configured timezone and business-day boundary when grouping sales by date.
- Distinguish billed, collected, pending, refunded, and voided amounts. Never combine them into one ambiguous "sales" number.
- Date filters must be inclusive and deterministic.
- Reports must be scoped to the authenticated user's restaurant and role.
- Add indexes for restaurant ID + business date / created timestamp only after checking actual query plans and table sizes.
- Use a transaction or database view/RPC for consistent summaries; test partial payments, refunds, voids, and duplicate requests.

## 4. Free validation sequence

1. Run the existing GitHub Actions workflow and fix build/type/lint/test failures.
2. Add a PostgreSQL service to CI and run migrations against a clean disposable database.
3. Add SQL tests for RLS boundaries, unauthenticated RPC denial, restaurant isolation, bill totals, partial payments, refunds, and idempotency.
4. Use local Docker PostgreSQL for repeatable migration testing and preserve the current production backup.
5. Re-inspect live Supabase schema, policies, grants, functions, and advisor findings before producing a production migration.
6. Apply production changes only after the user approves the exact migration and a maintenance/cutover window.

## 5. Safety gates

- No paid Supabase branch is required by this plan.
- No production migration is authorized by this plan.
- Never apply the current deny-by-default baseline blindly: it can disable staff and guest workflows until replacement policies/RPCs exist.
- Preserve all existing restaurant, menu, order, bill, and payment data.
- Never put Supabase service-role keys in frontend code, GitHub commits, or `VITE_*` variables.
