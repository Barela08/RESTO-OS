# RESTO OS — End-to-End Live Operations Contract

## Goal
A QR customer action must become a durable database event and appear on every authorized staff screen without refresh. Browser-local state or BroadcastChannel is not a production transport.

## Current root cause (verified in code)
- Waiter, kitchen and cash-counter dashboards subscribe to `dbAdapter.subscribe()`, a browser-local adapter subscription.
- The waiter dashboard reads `dbAdapter.getWaiterCalls()`; kitchen reads `dbAdapter.getKitchenTickets()`; cash counter reads `dbAdapter.getOrders()` and `dbAdapter.getPayments()`.
- Customer QR session verification and order placement currently call local adapter methods (`dbAdapter.verifyQRToken`, `dbAdapter.placeOrder`).
- Therefore different devices/browsers do not share an authoritative write path. Supabase Realtime publication alone cannot make local demo writes appear on other devices.

## Required production architecture
Postgres is the source of truth. Every command first commits through a server-validated database RPC/transaction; Realtime broadcasts the committed row change; each screen then refetches its authorized data from Supabase. Never broadcast client-computed totals or trust client-supplied restaurant/staff IDs.

### Event flows and acceptance criteria

| Customer action | Durable write | Realtime recipient | Required UI outcome |
|---|---|---|---|
| Scan table QR | Validate token and create/resume table session via server RPC | waiter, counter | Correct table number and active session visible |
| Call waiter | Insert `waiter_calls` with restaurant/table/session IDs, status REQUESTED, created_at | assigned waiter + all authorized waiter terminals | Immediate prominent alert, sound/vibration where browser permits, table number and notes |
| Place order | Atomic RPC validates session, menu/variant/add-ons, loads tax/discount settings, creates order + items + kitchen ticket(s) | kitchen, waiter, counter | Kitchen NEW ticket with ticket number, table number, items, qty, notes and elapsed time; waiter/counter see same order |
| Kitchen accepts/prepares/ready | Authorized status-transition RPC | waiter, customer tracking, counter | Status changes everywhere; ready ticket alerts waiter |
| Request bill / close table | Server transaction creates bill/payment record and closes session only after valid settlement | counter, waiter, owner | Pending bill visible at counter; floor/table status updates |
| Cash collected | Authorized atomic settlement RPC with authenticated staff identity; immutable payment + invoice + audit row | counter, owner, waiter/customer | Payment status PAID, invoice number, amount, change due and collection totals update |
| UPI verification | Persist verification request and staff decision | counter, owner, customer | Pending/approved/rejected state updates on all relevant screens |

## Realtime subscription contract
Subscribe using Supabase Realtime `postgres_changes` for the restaurant-scoped tables:
- `waiter_calls`
- `orders`, `order_items`, `order_status_history`
- `kitchen_tickets`, `kitchen_ticket_items`
- `payments`, `invoices`, `payment_verification_requests`
- `table_sessions`, `restaurant_tables`, `bill_requests`, `service_requests`

Each subscription must:
1. Use the authenticated user's session and server-derived restaurant membership.
2. Filter by restaurant only after verifying the schema has a restaurant_id on the subscribed table; for child tables join through a secure server query rather than trusting browser-provided IDs.
3. On INSERT/UPDATE/DELETE, invalidate/refetch the relevant query; do not treat the event payload as the sole source of truth.
4. Reconcile missed events on reconnect by refetching active sessions/orders/calls.
5. Remove channels on unmount and handle duplicate delivery idempotently.
6. Provide visible connection status and retry/backoff; do not silently fall back to fake local data in production.

## Notification UX
- Waiter call: persistent in-app alert card with table number, time, optional note, Accept / On the way / Arrived / Complete actions; sound only after a user gesture has enabled audio. Show an unread count and do not suppress an alert just because it arrived shortly before the dashboard mounted.
- Kitchen: new ticket highlighted and optionally chimed; display table number, ticket/order number, ordered items, modifiers, quantity, notes and elapsed time.
- Cash counter: new unpaid bills/payments appear in Pending; show table, order, amount, payment method and time. Settlement must update totals and invoice list immediately.
- Waiter/counter/kitchen changes must be reflected across other screens from committed database updates, not local adapter callbacks.

## Required tests
1. Customer browser calls waiter at Table T-04; waiter browser receives one alert within 2 seconds and can accept it.
2. Customer places order at Table T-04; kitchen browser sees a NEW ticket with correct table, items, quantities and notes within 2 seconds.
3. Waiter and counter browsers show the same order and status; no manual refresh.
4. Kitchen marks READY; waiter receives alert and customer tracker updates.
5. Customer requests bill; counter sees pending amount; cash settlement creates exactly one payment and invoice (idempotency/retry safe).
6. Reconnect during network interruption; all three dashboards reconcile missed events.
7. Restaurant A cannot read or subscribe to Restaurant B events.
8. Anonymous clients cannot subscribe to staff-only financial, customer, or operational data.
9. Browser refresh restores authorized staff session only; customer session is restored only after server-side QR/session verification.

## Safety / release gate
- Do not apply the current deny-by-default baseline migration to production as a substitute for implementing this flow. It intentionally blocks direct access to several internal tables and RPCs.
- Do not expose Supabase service-role keys in browser code.
- Do not claim realtime works until two independent browser sessions pass the end-to-end tests above.
- Existing local/demo adapter paths must be disabled or explicitly marked as demo; they must not masquerade as live production persistence.
- Supabase Realtime publication membership is necessary but not sufficient: correct grants, RLS SELECT policies, authenticated identity, and committed database writes are also required.
