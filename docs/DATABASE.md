# RESTO OS - Database Architecture & Schema Specification

## 1. Overview
Resto OS utilizes PostgreSQL (Supabase) as its source of truth. Every operational table contains `restaurant_id` to enforce future multi-tenancy while optimizing for high-throughput single-restaurant operations.

All timestamps are stored in UTC (`TIMESTAMPTZ`), with frontend formatting aligned to the restaurant's local timezone (`Asia/Kolkata` by default).

## 2. Entity Relationship Overview

```
 [restaurants] 1 ──── ∞ [restaurant_settings]
       │
       ├──── ∞ [restaurant_tables] 1 ──── ∞ [table_qr_tokens]
       │             │                            │
       │             ├──── ∞ [table_sessions] ◄───┘
       │             │              │
       │             │              ├──── ∞ [orders] 1 ──── ∞ [order_items]
       │             │              │          │                  │
       │             │              │          ├──── ∞ [kitchen_tickets]
       │             │              │          │
       │             │              └──── ∞ [payments] 1 ──── 1 [invoices]
       │             │                             │
       │             │                             └──── 1 [loyalty_stamps]
       │             │                                           │
       │             └──── ∞ [waiter_calls]                      ▼
       │                                                 [loyalty_accounts]
       ├──── ∞ [menu_categories] 1 ──── ∞ [menu_items] 1 ──── ∞ [menu_variants]
       │                                      │
       │                                      └──── ∞ [recipes] ──── ∞ [inventory_items]
       │
       └──── ∞ [staff] 1 ──── 1 [profiles]
```

## 3. Key Table Definitions & Constraints

### 3.1 `restaurant_tables` & `table_qr_tokens`
- Unique constraint: `UNIQUE (restaurant_id, table_number)`
- Daily QR token constraint: `UNIQUE (table_id, valid_date)`
- Cryptographic hash: `SHA-256(restaurant_id + table_id + valid_date + salt)`
- Token expiry: 23:59:59 restaurant local time.

### 3.2 `orders` & `order_items`
- Unique constraint: `UNIQUE (restaurant_id, order_number)`
- Status machine: `PLACED` → `ACCEPTED` → `PREPARING` → `READY` → `SERVED` → `COMPLETED` (or `CANCELLED`/`REJECTED`)
- Pricing snapshot: Item name and unit price are snapshotted in `order_items` at placement time so future menu price edits never mutate historical orders.

### 3.3 `payments` & `invoices`
- Status machine: `UNPAID` → `PENDING` → `PROCESSING` → `PAID` (or `FAILED`/`REFUNDED`)
- Invoices generated upon confirmed payment (Online webhook verification or Cash Counter staff verification).
- GST breakdown: CGST (2.5%) + SGST (2.5%) on taxable subtotal.

### 3.4 `loyalty_accounts` & `loyalty_stamps`
- Unique constraint: `UNIQUE (order_id)` on `loyalty_stamps`.
- Rule: Maximum 1 stamp per completed & paid eligible order.
- Threshold: 8 stamps = 1 automatic reward voucher.
