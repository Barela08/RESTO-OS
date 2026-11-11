# RESTO OS - Security & RBAC Specification

## 1. Zero Trust Architecture for Tables & QR Codes
- **Never Trust Client URLs:** Table number or table ID parameters in URLs are never accepted as proof of occupancy.
- **Cryptographic Token Verification:** Scanning a table QR submits a SHA-256 token hash to the backend. The backend resolves the actual table, checks date validity (must be today, expires 23:59:59 local), and verifies whether the token has been revoked.
- **Session Tokens:** Upon verification, the backend issues an opaque `session_token` which is validated against the active session in `table_sessions` for all subsequent orders.
- **Repeat Scan Detection:** If a token is scanned while a table already has an active session, a `repeat_scan_requests` event is raised, requiring Cash Counter staff confirmation before allowing order continuation.

## 2. Role-Based Access Control (RBAC)
- **Role Verification:** Authenticated users possess a role (`admin`, `owner`, `waiter`, `kitchen`, `counter`) defined in the database `profiles` table.
- **Row Level Security (RLS):**
  - Public/Guest: Can only read active menu items, insert own orders, and request waiter calls.
  - Waiter: Can only view assigned tables and update order delivery states.
  - Kitchen: Can only view and update kitchen tickets for relevant stations.
  - Counter: Can access pending bills, cash confirmation, repeat scan reviews, and invoice issuance.
  - Admin/Owner: Full operational and financial management access.

## 3. Financial Integrity & Idempotency
- **Server-Side Pricing:** All cart items are re-priced using the authoritative database base prices and add-on rates before an order is placed.
- **Cash Collection Protection:** Selecting "Pay at Cash Counter" leaves the bill in `PAYMENT_PENDING`. Only authenticated counter staff entering the received cash can transition it to `PAID`.
- **Stamp Anti-Fraud:** `loyalty_stamps` enforces a `UNIQUE(order_id)` constraint. An order can never award multiple stamps, and refunds reverse eligible stamps.
