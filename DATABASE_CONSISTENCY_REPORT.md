# RESTO OS — DATABASE CONSISTENCY REPORT
**Dual-Backend Architecture, State Consistency & Relational Guarantees**  
**Date:** November 12, 2026  
**Primary Realtime Backend:** Firebase Firestore & RTDB (`resto-os-3bf6c`)  
**Secondary Data Store:** Supabase PostgreSQL (`mklcrcyubohgfosgxmrm`)

---

## 1. Architectural Strategy

RESTO OS operates with a dual-backend strategy:
1. **Firebase Firestore & Realtime Database (Single Source of Truth for Live Operations):**
   - High-concurrency client subscriptions via `onSnapshot`.
   - Sub-second notification signaling across kitchen, waiter, and cash desk.
   - Zero-cost monthly billing under the Firebase Spark ₹0 tier.
2. **Supabase PostgreSQL (Authoritative Relational Warehouse & Audit Engine):**
   - Cryptographic table QR tokens, staff role permissions, and long-term analytical backups.
   - Unaltered tables, foreign key constraints, and Row Level Security (RLS) policies.

---

## 2. Table State Consistency & Invariants

### 2.1 State Transition Matrix

The table state machine strictly enforces the following state transitions:

```
                  ┌──────────────────────┐
                  │      AVAILABLE       │ ◄──────────┐
                  └──────────┬───────────┘            │
                             │                        │
       Order Placed          │                        │  Staff Cleans Table
   (placeOrderAsync)         ▼                        │ (markTableCleaned)
                  ┌──────────────────────┐            │
                  │       OCCUPIED       │            │
                  └──────────┬───────────┘            │
                             │                        │
       Bill Requested        │                        │
     (initiatePayment)       ▼                        │
                  ┌──────────────────────┐            │
                  │   PAYMENT_PENDING    │            │
                  └──────────┬───────────┘            │
                             │                        │
      Payment Settled        │                        │
      (confirmPayment)       ▼                        │
                  ┌──────────────────────┐            │
                  │       CLEANING       │ ───────────┘
                  └──────────────────────┘
```

### 2.2 Critical Invariants
1. **Browsing Invariant:** $\text{QR Scan} \nrightarrow \text{OCCUPIED}$. Scanning a QR code or visiting a menu generates an active `tableSessions` record, but leaves `restaurantTables.status` as `AVAILABLE`.
2. **Order Invariant:** $\text{Successful Order} \Longrightarrow \text{OCCUPIED}$. When an order is placed, `restaurantTables.status` transitions to `OCCUPIED`.
3. **Reversion Invariant:** If all active orders for an occupied table are cancelled or rejected, `checkAndRevertTableIfNoActiveOrders()` verifies that no unserved dishes remain, and reverts `status` to `AVAILABLE`.
4. **Settlement Invariant:** Payment confirmation transitions table status to `CLEANING`. Only manual staff acknowledgment (`markTableCleaned`) restores `AVAILABLE` status.

---

## 3. Order & Kitchen Fulfillment Consistency

### 3.1 Atomic Write Batch Guarantee

When a customer submits an order, `OrderRepository.createOrder` executes an atomic Firestore `writeBatch` ensuring zero partial writes:

```
writeBatch
  ├── set( orders/{orderId}, orderPayload )
  ├── set( orderItems/{orderItemId_1}, item_1 )
  ├── set( orderItems/{orderItemId_2}, item_2 )
  ├── set( kitchenTickets/{ticketId_station_1}, ticket_1 )
  ├── set( kitchenTickets/{ticketId_station_2}, ticket_2 )
  └── set( orderStatusHistory/{historyId}, initialHistoryPayload )
```

If network connectivity fails or any rule is violated, all writes fail atomically without leaving dangling orders or missing tickets.

### 3.2 Authoritative Price Verification

The client-side cart cannot inject arbitrary prices into the database. Before writing to Firestore, `OrderRepository`:
1. Queries the menu item document or checks verified catalog metadata.
2. Checks availability: if `isAvailable === false`, the write is rejected with an error.
3. Computes unit price:
   $$\text{unitPrice} = \text{basePrice} + \sum \text{variantDelta} + \sum \text{addonPrice}$$
4. Computes composite 5% GST:
   $$\text{CGST} = \text{round}(\text{subtotal} \times 0.025, 2)$$
   $$\text{SGST} = \text{round}(\text{subtotal} \times 0.025, 2)$$
   $$\text{Total} = \text{subtotal} + \text{CGST} + \text{SGST}$$

---

## 4. Multi-Tenant Restaurant Data Isolation

Every document in Firestore and row in Supabase contains mandatory tenant identification:
- `restaurantId: 'rest-001-main'`
- All queries, indexes, and Firestore security rules enforce `request.resource.data.restaurantId == resource.data.restaurantId`.
- No cross-restaurant data leakage is possible.

---

## 5. Dual-Backend Synchronization Verification

| Entity | Primary Store | Real-time Stream | Backup / Audit | Consistency Mechanism |
|---|---|---|---|---|
| `restaurantTables` | Firestore | `onSnapshot` | Supabase | Bi-directional status sync on mutation |
| `qrTokens` | Supabase / Local | Cryptographic Hash | Firestore | Token hash matching, expiry checks |
| `orders` | Firestore | `onSnapshot` | Supabase | Atomic batch creation, status history logging |
| `kitchenTickets` | Firestore | `onSnapshot` | In-memory | Station partitioning, sibling ticket rollup |
| `waiterCalls` | Firestore | `onSnapshot` | Supabase | PENDING $\rightarrow$ ACCEPTED $\rightarrow$ ON_THE_WAY $\rightarrow$ ARRIVED $\rightarrow$ COMPLETED |
| `payments` | Firestore | `onSnapshot` | Supabase | UTR reconciliation, cash change calculation |
| `invoices` | Firestore | `onSnapshot` | Supabase | Sequential INV number generation |
