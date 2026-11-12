# RESTO OS – CRITICAL FULL SYSTEM BUG AUDIT & ROOT CAUSE ANALYSIS

**Project**: RESTO OS  
**Firebase Project ID**: `resto-os-3bf6c`  
**Architecture**: Zero-Cost Firebase Spark Tier (₹0/mo, No Cloud Functions) + Dual Backend (Supabase + Firebase)  
**Date**: November 12, 2026  
**Auditor**: Principal Full-Stack Engineer, Firebase Architect & QA Automation Specialist  

---

## 1. Executive Summary

A comprehensive architectural and code-level audit was conducted across every page, dashboard, database adapter, repository, and security rule in the RESTO OS repository. 

The audit revealed that while the user interface and TypeScript types are exceptionally well-crafted, the operational backend pipelines suffered from **in-memory isolation**: critical business actions (order placement, kitchen ticket generation, cash counter billing, and table state transitions) were executing strictly inside local JavaScript memory (`databaseAdapter.ts` in-memory arrays) and never persisting to or streaming from Cloud Firestore (`resto-os-3bf6c`). Consequently, actions taken on a customer's phone never reached the kitchen, waiter, or cashier devices. Furthermore, table availability was severely corrupted by hardcoded mock data and eager session occupancy on QR scanning.

---

## 2. Detailed Root Cause Analysis by Subsystem

### Subsystem 1: Table Management & Availability
* **Bug Symptom**: Tables show `RESERVED` or unavailable (`OCCUPIED`) even when nobody has booked, scanned, or ordered.
* **Exact Root Causes**:
  1. **Hardcoded Seed Data**: In [`src/services/databaseAdapter.ts`](file:///c:/Users/hp/Downloads/resto%20os/src/services/databaseAdapter.ts#L226-L235), default tables were seeded with hardcoded states:
     - `tbl-1` (Table T-01): `status: 'OCCUPIED'`
     - `tbl-3` (Table T-03): `status: 'OCCUPIED'`
     - `tbl-6` (Table T-06): `status: 'RESERVED'`
  2. **Eager Occupation on QR Scan**: In [`src/services/databaseAdapter.ts`](file:///c:/Users/hp/Downloads/resto%20os/src/services/databaseAdapter.ts#L607) (`verifyQRToken`), [`getOrCreateActiveSession`](file:///c:/Users/hp/Downloads/resto%20os/src/services/databaseAdapter.ts#L688), and [`src/store/sessionStore.ts`](file:///c:/Users/hp/Downloads/resto%20os/src/store/sessionStore.ts#L111), merely scanning a QR code or visiting a menu URL executed `table.status = 'OCCUPIED'`. The table was locked into an occupied state before the customer even added an item to cart or placed an order.
  3. **Missing State Transitions**: The system lacked explicit `OUT_OF_SERVICE` state handling and lacked an automated recovery transition for cancelled or abandoned browsing sessions.
  4. **Table Clearing Disconnected from Availability**: When a bill was settled, the table was either prematurely freed or permanently stuck, with no structured staff-initiated `CLEANING` $\rightarrow$ `AVAILABLE` workflow.

---

### Subsystem 2: Customer Order Pipeline
* **Bug Symptom**: Customer clicks "Place Order" in `CustomerBagPage.tsx` or `MenuPage.tsx`, but orders do not appear in the Kitchen Display, Waiter Station, or Cash Counter.
* **Exact Root Causes**:
  1. **Zero Firestore Persistence in `placeOrder`**: In [`src/services/databaseAdapter.ts`](file:///c:/Users/hp/Downloads/resto%20os/src/services/databaseAdapter.ts#L797-L980), `placeOrder` creates an in-memory `Order` object, prepends it to `this.orders.unshift(order)`, and creates in-memory tickets in `this.kitchenTickets.unshift(ticket)`. It **never wrote to Cloud Firestore collection `orders` or `orderItems`**.
  2. **Uncalled Repository Layer**: [`OrderRepository.createOrder()`](file:///c:/Users/hp/Downloads/resto%20os/src/services/firebase/orderRepository.ts) was completely orphaned and never invoked anywhere in the active customer ordering journey.
  3. **No Idempotency Key in Production Path**: Order placement in `CustomerBagPage.tsx` did not pass or verify an idempotency key against Firestore, leaving customer devices vulnerable to duplicate orders on network re-tries.
  4. **Status Inconsistency**: The order status initialized to `'PLACED'` locally while the production specification requires initial state `'NEW'` with server-side validation.

---

### Subsystem 3: Kitchen Display System (KDS)
* **Bug Symptom**: Kitchen dashboard displays 0 tickets or only local demo tickets, never receiving real customer orders.
* **Exact Root Causes**:
  1. **Missing Firestore `onSnapshot` Listener**: [`src/modules/kitchen/KitchenDashboard.tsx`](file:///c:/Users/hp/Downloads/resto%20os/src/modules/kitchen/KitchenDashboard.tsx#L28-L34) only subscribed to `dbAdapter.subscribe(updateTickets)`, which only observes changes in the same browser window's memory.
  2. **No Multi-Station Routing in Database**: Because `kitchenTickets` were never written to Firestore, stations (Grill, Main, Bar) on separate physical monitors had nothing to query.
  3. **One-Way Status Flow**: Ticket status transitions (`ACCEPTED`, `PREPARING`, `READY_FOR_HANDOVER`, `PICKED_UP`, `SERVED`) were executed on local objects without propagating status updates back to the parent `orders` document in Firestore or alerting the assigned waiter.

---

### Subsystem 4: Cash Counter & Billing System
* **Bug Symptom**: Cashier sees 0 orders, pending bills, or payment records from dining tables.
* **Exact Root Causes**:
  1. **Disconnected Billing Listener**: [`src/modules/counter/CashCounterDashboard.tsx`](file:///c:/Users/hp/Downloads/resto%20os/src/modules/counter/CashCounterDashboard.tsx#L83-L95) subscribed exclusively to local in-memory adapter state (`dbAdapter.getPayments()`, `dbAdapter.getOrders()`, `dbAdapter.getInvoices()`).
  2. **No Firestore Invoices/Payments Write**: When an order was placed or settled, no document was written to Firestore collections `invoices` or `payments`.
  3. **Premature Table De-allocation**: Marking cash paid did not enforce table retention until service completion and clearing.
  4. **Unverifiable Client-Side Online Payments**: Client-side simulated Razorpay success messages bypassed server-authoritative validation. In Spark tier (no Cloud Functions), online payments cannot securely verify HMAC-SHA256 signatures client-side without exposing merchant secret keys.

---

### Subsystem 5: Waiter Station & Cross-Device Call Delivery
* **Bug Symptom**: Customer calls waiter; pending calls remain 0 on the waiter station, or dashboard displays `adm-1` waiter ID with 0 tables assigned.
* **Exact Root Causes**:
  1. **Call Persistence Gap**: Customer assistance initially used in-memory `createServiceRequest` instead of persistent Firestore `waiterCalls`. (Partially resolved in previous commit, but requires unified cross-module wiring for food pickup and ready tickets).
  2. **Identity Confusion**: Floor managers logged in as admin (`adm-1`) were treated as floor waitstaff with 0 assigned tables instead of activating Supervisor Oversight Mode.
  3. **Mount Time Filtering**: `initialMountTimeRef` dropped calls created $>15$s before page mount, losing calls upon dashboard reload.

---

### Subsystem 6: Owner & Admin Analytics
* **Bug Symptom**: Owner Dashboard displays static mock charts or 0 totals when real activity occurs.
* **Exact Root Causes**:
  1. **Hardcoded Hourly Trends**: [`src/modules/owner/OwnerDashboard.tsx`](file:///c:/Users/hp/Downloads/resto%20os/src/modules/owner/OwnerDashboard.tsx#L50-L60) contained a hardcoded `hourlyData` array instead of aggregating completed orders and payments.
  2. **No Live Listener**: Dashboards lacked Firestore subscriptions, requiring manual hard-refreshes that reset in-memory state.

---

### Subsystem 7: Firestore Security Rules & Permissions
* **Bug Symptom**: Permission-denied errors on collection queries (`orders`, `kitchenTickets`).
* **Exact Root Causes**:
  1. **Rule-as-Filter Pitfall**: Rules checked `isStaffOf(resource.data.restaurantId)` using document lookups (`get(/databases/$(database)/documents/users/$(request.auth.uid))`). When `/users` collection was empty or staff were logging in from client sessions without a pre-populated Firestore user document, Firestore denied all collection-level listeners.
  2. **Overly Restrictive Read Rules**: `kitchenTickets` blocked queries unless the user was explicitly confirmed in Firestore as `isKitchen()`, preventing legitimate restaurant staff from monitoring tickets.

---

## 3. Comprehensive Fix Plan & Architecture

| Phase | Module | Action Plan | Target File(s) |
|---|---|---|---|
| **Phase 2** | Table Management | Reset seed data to `AVAILABLE`. Separate QR browsing from active dining sessions. Tables become `OCCUPIED` **only** upon order placement. Add `OUT_OF_SERVICE` and staff clearing workflow. | `databaseAdapter.ts`, `sessionStore.ts`, `tableRepository.ts` |
| **Phase 3** | Customer Ordering | Wire `OrderRepository.createOrder` into `databaseAdapter.placeOrderAsync`. Enforce server-authoritative price calculation, idempotency keys, order status history, and atomic batch commit. | `orderRepository.ts`, `databaseAdapter.ts`, `CustomerBagPage.tsx`, `MenuPage.tsx` |
| **Phase 4** | Kitchen Display | Add real-time Firestore `onSnapshot` listener to `KitchenDashboard.tsx`. Stream tickets and orders. Propagate status changes (`ACCEPTED`, `PREPARING`, `READY_FOR_HANDOVER`) to Firestore. | `KitchenDashboard.tsx`, `orderRepository.ts` |
| **Phase 5** | Cash Counter | Add real-time Firestore listener to `CashCounterDashboard.tsx`. Persist invoices and payments to Firestore `invoices` and `payments`. Enforce table retention until clearing. Document Spark payment boundary. | `CashCounterDashboard.tsx`, `billingRepository.ts` |
| **Phase 6** | Waiter & Owner Dashboards | Add Firestore order & ticket sync to Waiter and Owner dashboards. Dynamically compute metrics from actual database collections. | `WaiterDashboard.tsx`, `OwnerDashboard.tsx`, `AdminDashboard.tsx` |
| **Phase 7** | Security Hardening | Harden `firestore.rules` and `database.rules.json` without `if true;`. Secure multi-tenant restaurant isolation with proper session access. | `firestore.rules`, `database.rules.json` |
| **Phase 8** | QA Test Suite | Execute all 6 required test scenarios in vitest. Verify multi-device end-to-end sync, TypeScript compilation, and production build. | `tests/*.test.ts` |
