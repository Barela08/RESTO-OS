# RESTO OS - API & RPC Function Specification

## 1. Daily QR System Endpoints & RPCs

### 1.1 `generate_daily_qr_tokens(p_restaurant_id: string)`
- **Input:** Restaurant Identifier.
- **Action:** Iterates active tables, generates a cryptographic SHA-256 token hash for today's date if missing, records batch log.
- **Output:** `{ success: boolean, date: string, tokens_generated: number }`.

### 1.2 `verify_table_qr_token(p_token_hash: string, p_user_agent?: string, p_ip?: string)`
- **Input:** QR token hash from URL or scan.
- **Security Check:** Validates signature, expiry (< 23:59:59 local), revoked flag.
- **Repeat Scan Logic:** If an active session is detected on that table, generates a `repeat_scan_requests` record with an instant notification to Cash Counter.
- **Output:**
  - First Scan: `{ success: true, is_repeat_scan: false, session_id: UUID, session_token: string, table_number: string, table_id: UUID }`
  - Repeat Scan: `{ success: true, is_repeat_scan: true, repeat_request_id: UUID, table_number: string, existing_session_token: string }`

## 2. Orders & Kitchen RPCs

### 2.1 `place_customer_order(payload)`
- **Input:** `table_session_id`, `items: [{ menuItemId, quantity, variantId, addonIds, instructions }]`, `customerPhone?`, `customerName?`
- **Validation:** Verifies active session, checks item availability, recalculates prices strictly on the server, calculates CGST/SGST.
- **Action:** Inserts `orders`, `order_items`, and routes tickets to appropriate `kitchen_stations`. Notifies waiter & kitchen via Realtime broadcast.

### 2.2 `update_kitchen_ticket_status(ticket_id: UUID, new_status: string, reason?: string)`
- **Input:** `NEW` → `ACCEPTED` → `PREPARING` → `READY` → `HANDED_OVER`.
- **Action:** When marked `READY`, sends instant chime & notification to assigned waiter.

## 3. Cash Counter & Payment RPCs

### 3.1 `confirm_cash_payment(p_payment_id: UUID, p_staff_id: UUID, p_cash_received: number)`
- **Validation:** Verifies staff permissions and cash received >= bill total.
- **Action:** Marks payment `PAID`, generates sequential tax invoice, marks orders `COMPLETED`, transitions table to `CLEANING`, and triggers `award_loyalty_stamp_if_eligible`.

### 3.2 `award_loyalty_stamp_if_eligible(p_order_id: UUID, p_payment_id: UUID)`
- **Validation:** Customer must have a verified phone profile; order must be >= ₹250.
- **Action:** Issues 1 stamp to customer loyalty account. If total stamps >= 8, issues free reward voucher.
