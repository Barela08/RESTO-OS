# RESTO OS - Firebase Security Architecture & Threat Mitigation

**Document Version:** 1.0.0  
**Scope:** Security boundaries, attack surface reduction, and Firestore/Realtime Database rule enforcement  
**Architecture:** Zero-Cost Firebase Spark Model (No Cloud Functions)  

---

## 1. Security Architecture Principles

1. **Default Deny by Default:** Every document and database path denies read and write operations unless explicitly authorized.
2. **Backend-Authoritative Identity:** The application never trusts client-supplied roles (e.g. `role: "admin"` in a request body). All role checks verify the authenticated `request.auth.uid` against the server-stored document at `/databases/$(database)/documents/users/$(request.auth.uid)`.
3. **Strict Multi-Tenant Isolation:** All operational queries and writes require matching `restaurantId`. Users belonging to Restaurant A cannot read, query, or mutate documents belonging to Restaurant B.
4. **Immutable Financial Records:** Once a payment or invoice is marked `PAID`, it cannot be deleted or altered by any staff member.
5. **Tamper-Proof Audit Logging:** Audit logs are strictly append-only. No role, including Owner, can update or delete audit log entries.

---

## 2. Spark-Tier Security Solution: The Role Verification Pattern

### The Problem
On the paid Blaze plan, Firebase Cloud Functions mint custom claims (e.g. `token.role = 'admin'`). On the **₹0 Spark plan**, Cloud Functions cannot be deployed.

### The Solution
We use Firestore Security Rules' native `get()` document lookup function:
```javascript
function getUserData() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
}

function getUserRole() {
  return getUserData().role;
}

function isOwnerOrAdmin() {
  return request.auth != null && (getUserRole() == 'owner' || getUserRole() == 'admin' || getUserRole() == 'master_admin');
}
```

### Self-Promotion Defense
To guarantee that a malicious user cannot edit their own document in `/users/{uid}` and give themselves `role: 'owner'`:
```javascript
match /users/{userId} {
  allow read: if request.auth != null && (request.auth.uid == userId || isOwnerOrAdmin());
  allow create: if isOwnerOrAdmin();
  allow update: if isOwnerOrAdmin() && (request.resource.data.role == resource.data.role || getUserRole() == 'owner');
  allow delete: if getUserRole() == 'owner';
}
```
Result: Regular users cannot modify their `users` document or promote their role.

---

## 3. Threat Matrix & Defense Mechanisms

| Attack Vector | Threat Scenario | Mitigation in RESTO OS |
|---|---|---|
| **Price Tampering** | Customer modifies unit prices in browser and sends discounted order | [`OrderRepository.createOrder()`](file:///c:/Users/hp/Downloads/resto%20os/src/services/firebase/orderRepository.ts) recalculates all prices directly from `menuItems` in Firestore. Security rules reject arbitrary modification of order prices. |
| **Cross-Table Peeking** | Customer at Table 2 queries orders or calls from Table 10 | Security rules restrict table session reads to authorized floor staff or requests matching the specific `tableSessionId`. |
| **Fake Cash Settlement** | Rogue waiter marks unpaid bill as paid | Only users with role `counter`, `admin`, or `owner` can write to `payments` collection. Once written with status `PAID`, update and delete are permanently blocked. |
| **Role Escalation** | Waiter sends REST API or Firebase SDK call promoting themselves to Admin | Rules lookup verified role in `users/{uid}`. No client-supplied role parameter is trusted. |
| **Credential Exposure** | Service account JSON checked into git | Private keys are excluded via `.gitignore`. Frontend uses client-side public API keys secured by Firestore rules. |

---

## 4. Verification & Testing

Security rules must be audited and verified using unit tests to ensure that:
1. Unauthenticated requests are blocked.
2. Waiters cannot modify billing invoices.
3. Kitchen staff cannot settle cash payments.
4. Customers cannot view other tables' orders.
5. All 27 collections enforce restaurant-level tenant isolation.
