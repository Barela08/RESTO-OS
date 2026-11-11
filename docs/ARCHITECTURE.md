# RESTO OS - System Architecture Specification

## 1. High-Level Architecture

```
                    ┌──────────────────────────────────────────┐
                    │               CLIENT TIERS               │
                    └──────────────────────────────────────────┘
      Customer Web App    Waiter Dashboard    Kitchen KDS    Cash Counter    Admin / Owner
         (Mobile-first)       (Tablet/Mobile)    (Landscape)     (Desktop/POS)   (Desktop SaaS)
              │                     │                │               │               │
              └─────────────────────┼────────────────┼───────────────┼───────────────┘
                                    │ HTTPS / WSS
                                    ▼
                    ┌──────────────────────────────────────────┐
                    │       APPLICATION & ROUTING LAYER        │
                    │   React 19 + TypeScript + React Router   │
                    │   TanStack Query Cache + Zustand State   │
                    │   Audio Notification Engine (WebAudio)   │
                    │   PDF Invoice & QR Vector Generators     │
                    └──────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────────────────┐
                    │       DATA ACCESS & BUSINESS LOGIC       │
                    │  Resto OS Data Provider & Store Adapter  │
                    │   - Live Supabase Client (Real Postgres) │
                    │   - Reactive Broadcast Engine (Realtime) │
                    │   - Robust Failover Local Database Cache │
                    └──────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────────────────┐
                    │          POSTGRESQL DATABASE             │
                    │  Relational Tables, Constraints, Triggers│
                    │  Row-Level Security (RLS) Policies       │
                    │  Atomic Stored Procedures & Transactions │
                    │  Cryptographic QR Token Validation       │
                    └──────────────────────────────────────────┘
```

## 2. Dynamic QR Lifecycle & Security Engine

```
[ Scheduled Daily Cron 00:00:01 ] ──► [ Generate Daily Hash Token (SHA-256) ]
                                                    │
                                                    ▼
                                      [ Store in table_qr_tokens ]
                                      - table_id, restaurant_id
                                      - token_hash, valid_date
                                      - expires_at (23:59:59 Local)
                                                    │
             ┌──────────────────────────────────────┘
             ▼
[ Customer Scans QR Code ] ──► [ Submit Token to Backend ]
                                      │
                         [ Validate Expiry & Active Status ]
                         ├── Expired / Revoked? ──► [ REJECT: 403 Forbidden ]
                         └── Valid Token? ──► Check Active Table Session
                                                    │
                                ┌───────────────────┴───────────────────┐
                                ▼                                       ▼
                       [ No Active Session ]                 [ Active Session Found ]
                                │                                       │
                      [ Create New Session ]                 [ Trigger Repeat Scan Alert ]
                      - session_id                                      │
                      - Set Table OCCUPIED                              ▼
                      - Issue Session Token               [ Cash Counter Dashboard ]
                                                          - In-App Sound Alert
                                                          - Staff Action:
                                                            ├── Confirm & Continue Session
                                                            └── Reject / New Session Override
```

## 3. Order & Kitchen Lifecycle State Machine

```
[ Customer Cart ]
       │
       ▼
[ Atomic Order Placement ]
  ├── Recalculate item prices from DB
  ├── Apply GST (CGST + SGST)
  ├── Assign table's authorized waiter
  ├── Create Kitchen Tickets by Station
  └── Emit 'order_placed' event
       │
       ├─────────────────────────────────┬────────────────────────────────┐
       ▼                                 ▼                                ▼
[ Kitchen KDS ]                  [ Waiter Screen ]               [ Customer Tracker ]
  - Status: NEW (Chime)            - Alert: New Order Assigned     - Status: Placed
  - Staff clicks ACCEPT            - View details & notes          - Live step highlighted
       │
       ▼
[ Status: PREPARING ] ──► Timer starts
       │
       ▼
[ Status: READY ] ──────► Trigger Waiter Push/Audio Notification
       │
       ▼
[ Waiter Serves Food ] ──► Status: SERVED
```

## 4. Payment Settlement & Digital Stamp Pipeline

```
[ Food Served: Status SERVED ]
             │
             ▼
[ Customer Requests Bill / Pay ]
             │
   ┌─────────┴────────────────────────┐
   ▼                                  ▼
[ Option A: Online UPI / Razorpay ]  [ Option B: Pay at Cash Counter ]
   - Backend creates gateway order      - Status: PAYMENT_PENDING
   - Customer completes UPI             - Bill sent to Counter Dashboard
   - Server validates webhook           - Counter Staff receives cash
   - Status updated to PAID             - Staff verifies & clicks Confirm
   │                                    │
   └───────────────┬────────────────────┘
                   ▼
       [ Payment Status: PAID ]
                   │
                   ▼
       [ Generate Official Tax Invoice ]
       - Unique sequential invoice number
       - CGST / SGST breakdown
       - Printable & PDF download
                   │
                   ▼
       [ Loyalty Stamp Qualification Check ]
       ├── Is Customer Registered & Verified?
       ├── Is Order Minimum Value Met?
       ├── Has Stamp Already Been Issued? (Idempotent Constraint)
       └───► Issue 1 Stamp to Customer Loyalty Account
             ├── Check Milestone (e.g. 8 Stamps reached)
             └── Unlock Reward Voucher automatically
```
