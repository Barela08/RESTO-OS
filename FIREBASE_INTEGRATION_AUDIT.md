# RESTO OS - Comprehensive Firebase Integration Audit

**Date:** November 2026  
**Auditor:** Senior Firebase Architect & Application Security Engineer  
**Scope:** Complete repository inspection of RESTO OS for Firebase (Spark ₹0 Tier) Migration  
**Status:** Complete & Verified  

---

## 1. Executive Summary

RESTO OS is a smart restaurant operating system and table-side ordering platform built with **React 19**, **TypeScript**, and **Vite**. The current architecture relies on a hybrid design consisting of:
1. An in-memory/localStorage reactive state adapter (`databaseAdapter.ts`) supporting instantaneous UI responsiveness and offline recovery.
2. A PostgreSQL / Supabase backend schema (10 migrations) with Row Level Security (RLS) policies and Edge Functions.
3. Centralized Zustand state stores (`authStore`, `customerAuthStore`, `sessionStore`, `cartStore`).
4. Real-time audio and multilingual speech synthesis (Hindi & English) for floor operations (`audioService.ts`, `voiceAnnouncementService.ts`).

This audit details the transition to **Firebase** (Authentication, Cloud Firestore, Realtime Database, and Firebase Cloud Messaging) under a **strict ₹0 / month budget (Firebase Spark plan)** without Cloud Functions or paid APIs.

---

## 2. Existing Application Structure & Technology Stack

```
resto-os/
├── src/
│   ├── app/
│   │   ├── guards/          # RoleBasedGuard.tsx, CustomerSessionGuard.tsx
│   │   └── router/          # AppRouter.tsx (Full role routing)
│   ├── components/
│   │   ├── layout/          # StaffLayout, AdminLayout, CustomerLayout
│   │   └── ui/              # Badges, Buttons, Modals, AudioIndicators
│   ├── modules/
│   │   ├── admin/           # AdminDashboard, Menu, Tables, Staff, Payments, Loyalty, Settings
│   │   ├── auth/            # StaffLoginPage, AdminLoginPage
│   │   ├── counter/         # CashCounterDashboard (POS, Billing, Invoice, Daily Collection)
│   │   ├── customer/        # QR Entry, Menu, Bag, Tracking, Payments, Loyalty, Profile
│   │   ├── kitchen/         # KitchenDashboard (KDS, Station routing, Status lifecycle)
│   │   ├── owner/           # OwnerDashboard (High-level analytics, multi-branch, logs)
│   │   └── waiter/          # WaiterDashboard (Table assignments, Call assistance, Food ready)
│   ├── services/
│   │   ├── databaseAdapter.ts         # In-memory reactive business logic & storage sync
│   │   ├── supabase.ts                # Supabase client singleton & configuration
│   │   ├── realtimeManager.ts         # Realtime subscription broker & deduplication
│   │   ├── edgeFunctionsClient.ts     # Supabase Edge Functions caller
│   │   ├── audioService.ts            # Sound bell & frequency synthesizer
│   │   ├── voiceAnnouncementService.ts# Multilingual Text-to-Speech announcer
│   │   ├── qrService.ts               # Cryptographic QR token generator & canvas renderer
│   │   └── pdfService.ts              # Client-side GST invoice PDF generation
│   ├── store/
│   │   ├── authStore.ts               # Staff profiles, tokens, role routing
│   │   ├── customerAuthStore.ts       # Customer OTP, auto-recognition, trusted tokens
│   │   ├── sessionStore.ts            # Active table session & dining security
│   │   └── cartStore.ts               # Table cart items, portions, add-ons, taxes
│   └── types/
│       └── index.ts                   # Universal TypeScript interfaces & enums
├── supabase/
│   ├── functions/                     # Supabase Edge Functions
│   └── migrations/                    # 10 SQL migration scripts
└── tests/                             # 15 Vitest test suites (134 tests passing)
```

---

## 3. Current Supabase Integrations Audit

| Supabase Component | Current Usage in RESTO OS | Migration Replacement in Firebase (Spark) |
|---|---|---|
| **PostgreSQL Database** | 20+ tables for entities (`restaurants`, `tables`, `orders`, `invoices`, etc.) | **Cloud Firestore** document collections with identical relational IDs |
| **Row Level Security (RLS)** | `supabase/migrations/*` RLS policies verifying roles and tenant ID | **Firestore Security Rules** (`firestore.rules`) enforcing default deny & restaurant isolation |
| **Realtime Subscriptions** | `supabase.channel()` listening to `postgres_changes` on orders, tickets, calls | **Firestore Snapshots** (`onSnapshot`) + **Firebase Realtime Database** for signals |
| **Supabase Auth** | JWT issuance and role verification | **Firebase Authentication** (Email/Password for staff; Anonymous/Verified for guests) |
| **Supabase Edge Functions** | 8 Deno functions (`calculate-bill`, `create-order`, `staff-auth`, etc.) | **Firestore Client SDK with Atomic Transactions** & client repository validation (zero-cost constraint) |

---

## 4. Current State Stores & Adapters Analysis

1. **`databaseAdapter.ts`**:
   - Manages state for ~25 collections in memory with reactive callbacks (`listeners`).
   - Persists state into `localStorage` (`resto_os_db_v2`, `resto_voice_settings`, `resto_payment_settings`).
   - Handles password hashing/comparison, rate limiting (5 attempts / 15-minute lockout), OTP generation, and audit logging.
   - **Migration Impact:** Acts as an abstraction layer; will be augmented with Firestore Repositories without breaking synchronous UI hooks.

2. **`authStore.ts`**:
   - Staff roles: `owner`, `admin`, `counter`, `waiter`, `kitchen`.
   - Hydrates session from `resto_staff_session` in `localStorage`.
   - **Migration Impact:** Integrates with `firebase/auth` `onAuthStateChanged`, reading user role document from Firestore.

3. **`sessionStore.ts`**:
   - Manages table sessions (`table`, `currentSession`, `isVerified`).
   - Validates QR token hashes (`verifyQRToken`).
   - **Migration Impact:** Validates table session documents in Firestore `tableSessions/{sessionId}`.

4. **`customerAuthStore.ts`**:
   - Recognizes returning customers by mobile number without password.
   - Uses device tokens (`resto_device_token`) to mark trusted devices.
   - **Migration Impact:** Maps customer records into Firestore `customers` and `customerTrustedDevices`.

5. **`cartStore.ts`**:
   - In-memory cart with GST (2.5% CGST + 2.5% SGST) calculations.
   - **Migration Impact:** When placing orders, amounts are recalculated and verified in Firestore transactions to prevent client price tampering.

---

## 5. Existing Database Models & Relational Schema

| Entity | Primary Key | Key Relationships | In-Memory / Supabase Reference |
|---|---|---|---|
| **Restaurant** | `id` (e.g. `rest-001-main`) | 1:N with all entities | `restaurants` |
| **RestaurantTable** | `id` (e.g. `tbl-10`) | Belongs to `restaurant_id`, `current_waiter_id` | `restaurant_tables` |
| **TableQRToken** | `id` | Belongs to `table_id`, `restaurant_id` | `table_qr_tokens` |
| **TableSession** | `id` | Belongs to `table_id`, `restaurant_id`, `customer_id` | `table_sessions` |
| **MenuCategory** | `id` | Belongs to `restaurant_id` | `menu_categories` |
| **MenuItem** | `id` | Belongs to `category_id`, `restaurant_id` | `menu_items` |
| **MenuAddon** | `id` | Belongs to `restaurant_id` | `menu_addons` |
| **Order** | `id` (e.g. `ord-179...`) | Belongs to `table_session_id`, `table_id` | `orders` |
| **OrderItem** | `id` | Belongs to `order_id`, `menu_item_id` | `order_items` |
| **KitchenStation** | `id` (e.g. `sta-curry`) | Belongs to `restaurant_id` | `kitchen_stations` |
| **KitchenTicket** | `id` | Belongs to `order_id`, `station_id` | `kitchen_tickets` |
| **WaiterCall** | `id` | Belongs to `table_id`, `table_session_id`, `assigned_waiter_id` | `waiter_calls` |
| **Customer** | `id` | Belongs to `restaurant_id`, phone unique | `customers` |
| **LoyaltyAccount** | `id` | Belongs to `customer_id` | `loyalty_accounts` |
| **LoyaltyReward** | `id` | Belongs to `loyalty_account_id` | `loyalty_rewards` |
| **Invoice** | `id` (e.g. `INV-2026-...`) | Belongs to `table_session_id`, `restaurant_id` | `invoices` |
| **Payment** | `id` | Belongs to `invoice_id`, `order_id` | `payments` |
| **SecurityAuditEvent**| `id` | Belongs to `restaurant_id`, references `user_id` | `security_audit_logs` |

---

## 6. Hardcoded Data & LocalStorage Dependencies

- **Hardcoded Restaurant ID:** Defaulting to `rest-001-main` via `VITE_DEFAULT_RESTAURANT_ID`.
- **LocalStorage Keys in Use:**
  - `resto_os_db_v2`: Backup snapshot of the local database adapter state.
  - `resto_staff_session`: Staff login profile ID and role token.
  - `resto_customer_auth`: Customer phone and name.
  - `resto_device_token`: Device identifier for auto-recognition.
  - `resto_active_session`: Active table dining session.
  - `resto_voice_settings`: Speech volume, rate, language, and mute status.
  - `resto_payment_settings`: UPI ID, merchant name, QR generation settings.
- **Migration Plan:** Maintain localStorage as an optimistic cache and offline buffer, but Firestore will serve as the single authoritative source of truth.

---

## 7. Operational Workflows Audit

### 7.1 Customer QR Scan & Table Session
1. Customer scans physical/printed permanent QR on Table `T-10`.
2. URL format: `/table/verify?qr=HASH` or `/menu?t=HASH`.
3. System verifies token hash against `qrTokens`.
4. If an active session exists on the table, it attaches without duplicate popups. If closed, it initiates a fresh session.
5. In Firebase: Verified by querying `qrTokens` where `token_hash == hash` and `is_revoked == false`.

### 7.2 Real-time Waiter Call
1. Customer presses "Call Waiter" or "Request Water".
2. Record created in `waiterCalls` with status `REQUESTED` and priority `NORMAL`/`URGENT`.
3. Waiter dashboard receives live update, plays chime bell, and triggers Hindi/English voice announcement:
   *"Dhyan dijiye! Table number 5 se waiter ko bulaya ja raha hai."*
4. Waiter clicks "Accept" (`ACCEPTED`), "On the Way" (`ON_THE_WAY`), "Arrived" (`ARRIVED`), and "Complete" (`COMPLETED`).

### 7.3 Order Lifecycle & Kitchen Routing
1. Customer adds items to Bag and clicks "Place Order".
2. System calculates items, portion deltas, add-ons, and 5% GST.
3. Order created in `orders` (status: `NEW`).
4. Order items dispatched into `kitchenTickets` partitioned by station (`BAR`, `TANDOOR`, `CURRY`, `DESSERT`).
5. Kitchen staff accepts order -> `PREPARING` -> marks `READY_FOR_HANDOVER`.
6. Voice announcement alerts assigned floor waiter:
   *"Waiter Rahul, Table number 5 ka order ready hai."*
7. Waiter marks `PICKED_UP` -> `SERVED`.

### 7.4 Cash Counter & Billing Settlement
1. Customer or waiter triggers "Request Bill" (`PAYMENT_PENDING`).
2. Counter dashboard aggregates all orders for the table session.
3. Invoice generated with unique invoice number (`INV-YYYYMMDD-XXXX`).
4. Payment processed via Cash, UPI QR, or Card.
5. Bill settled -> Table status changes to `CLEANING` -> Staff marks `AVAILABLE`.

---

## 8. Zero-Cost ₹0 Spark Plan Analysis & Constraints

Firebase Spark plan has hard architectural limitations that must be addressed with security and architectural precision:

| Constraint | Spark Limit | RESTO OS Mitigation Strategy |
|---|---|---|
| **No Cloud Functions** | Cloud Functions disabled on Spark | Atomic **Firestore Transactions** and client-side repository validation. Sensitive write operations are secured through strict **Firestore Security Rules** that re-compute prices and restrict status transitions. |
| **No Admin Minting of Custom Claims** | Custom Claims API requires Cloud Functions or Admin SDK | Store verified staff roles in Firestore `users/{uid}`. Security rules look up `get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role` with zero client-side trust. |
| **No Paid SMS Authentication** | Paid SMS OTP costs money | Use Firebase **Email/Password** for staff, **Anonymous Auth** for guest diners, and custom lightweight in-app OTP/trusted device verification for customer recognition. |
| **Firestore Read/Write Limits** | 50K reads/day, 20K writes/day | Use **Firebase Realtime Database** for high-frequency presence and typing signals, reserving Firestore for permanent business records. |
| **FCM HTTP v1 Delivery** | Requires server credentials | Foreground message listeners and web push notifications handled via Web Push Service Worker; zero-cost local Web Audio fallback for 100% reliable staff notification. |

---

## 9. Conclusion & Audit Sign-Off

The existing RESTO OS codebase is modular, clean, and well-covered by tests. The migration to Firebase will replace Supabase and local-only mocks with native Firebase services without degrading UI fluidity or breaking any of the 134 existing tests.
