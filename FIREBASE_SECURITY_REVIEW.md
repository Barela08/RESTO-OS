# RESTO OS — Firebase & Database Security Architecture Review

## 1. Security Architecture Summary

- **Firebase Project ID**: `resto-os-3bf6c`
- **Hosting Tier**: Firebase Spark Plan (₹0 Monthly Budget Compliant)
- **Security Rule Model**: Cloud Firestore Security Rules v2 with strict role-based access control (RBAC), multi-tenant tenancy isolation, and cryptographic QR session validation.
- **Rule Verification**: Zero permissive rules (`allow read, write: if true;` is strictly forbidden and absent).

---

## 2. Multi-Tenant Tenancy Isolation

Every business entity and real-time operational document contains an immutable root-level `restaurantId` attribute:
- Collections: `orders`, `orderItems`, `kitchenTickets`, `waiterCalls`, `serviceRequests`, `payments`, `invoices`, `restaurantTables`, `tableSessions`, `deviceRegistrations`.
- Subscriptions and queries enforce `where('restaurantId', '==', restaurantId)`.
- Security rules enforce:
  ```javascript
  function isStaffOf(restaurantId) {
    return isAuthenticated() && (
      getUserData().restaurantId == restaurantId ||
      hasRole('master_admin')
    );
  }
  ```
- **Cross-Establishment Isolation**: Staff from Restaurant A cannot read, query, or receive notifications for tickets, calls, or financial records belonging to Restaurant B.

---

## 3. Privilege Escalation & Role Security

### Prevention of Self-Promotion
1. In `users/{userId}`, regular staff members cannot alter their own `role` or `restaurantId`. Role assignment is strictly restricted to `owner`, `admin`, or `master_admin`:
   ```javascript
   allow update: if isOwnerOrAdminOf(resource.data.restaurantId) ||
                    (request.auth.uid == userId &&
                     areImmutableFieldsUnchanged(['userId', 'restaurantId', 'role', 'createdAt']));
   ```
2. In `deviceRegistrations/{deviceId}`, roles are validated against the strict whitelist:
   `['counter', 'waiter', 'kitchen', 'customer', 'admin', 'owner']`.

---

## 4. Guest QR Session vs Authenticated Staff Boundaries

```
[Customer Guest Browser]                        [Staff Hardware Device]
       |                                                  |
       v                                                  v
 Scans Permanent Table QR                         Authenticates with PIN/Password
       |                                                  |
 Resolves tableSessions/{sessionId}               Obtains Firebase Auth UID & Staff Profile
       |                                                  |
 Access restricted to:                            Access permitted to:
 - Read own tableSession                          - Kitchen Display System (kitchen)
 - Read own orders/{orderId}                      - Waiter Station & Call Bells (waiter)
 - Create waiterCalls for session                 - Cash Register & Billing (counter)
 - Read menu catalog                              - Table Administration (admin/owner)
       |                                                  |
 ZERO ACCESS to staff/auditLogs/voice             Audit-logged in auditLogs/{logId}
```

### Guest Action Safeguards
- **Waiter Call Creation**: Customer can only request assistance for their own active `tableSessionId`.
- **Order Placement**: Financial totals, CGST, SGST, and item calculations are computed authoritatively from trusted menu catalog records (`OrderRepository.createOrder`). Client cannot alter unit prices.
- **Table Availability Protection**: Browsing the menu, scanning the QR, or modifying cart items leaves table in state `AVAILABLE`. Only formal atomic order creation marks the table `OCCUPIED`.

---

## 5. Financial & Payment Record Immutability

1. **Payments Collection (`payments/{paymentId}`)**:
   - `create`: Initial payment record created with `payment_status: 'PENDING'`.
   - `update`: Transition to `PAID` permitted only by authorized `counter`, `admin`, or `owner` staff upon cash collection or verified bank UTR reconciliation.
   - **Post-Settlement Lock**: Once `resource.data.payment_status == 'PAID'`, the payment record is strictly immutable:
     ```javascript
     allow update: if resource.data.payment_status != 'PAID';
     allow delete: if false; // Deletion of financial records strictly forbidden
     ```
2. **Invoices Collection (`invoices/{invoiceId}`)**:
   - `allow delete: if false;` — GST tax invoices cannot be deleted.

---

## 6. Zero Exposure of Service Account Secrets

- **Frontend Security**: No Google Service Account private keys (`private_key`, `client_email`), Supabase Service Role keys, or database administrative passwords exist in client-side bundles (`src/`), `VITE_` environment variables, or public repositories.
- **Serverless Edge Boundary**: When push notifications are dispatched to background devices, the request routes to the server-side Vercel Serverless Function `/api/notify.ts`. The Google Service Account private key is stored exclusively in Vercel Dashboard server environment secrets (`process.env.FIREBASE_SERVICE_ACCOUNT_KEY`), never exposed to the web browser.
