# RESTO OS - Complete Firebase Database Schema Specification

**Document Version:** 1.0.0  
**Database Engines:** Cloud Firestore (Document Store) & Firebase Realtime Database (Signal/Presence Bus)  
**Tenant Model:** Multi-tenant isolated via mandatory `restaurantId`  

---

## 1. Schema Design Principles

1. **Mandatory Multi-Tenancy:** Every operational and business document MUST include a root-level `restaurantId` (String).
2. **Stable Document Identifiers:** Primary keys follow deterministic, human-readable prefixes (e.g. `rest-001-main`, `tbl-10`, `ord-YYYYMMDD-XXXX`, `inv-YYYYMMDD-XXXX`).
3. **Auditability & Timestamps:** All mutable documents store `createdAt` (Timestamp) and `updatedAt` (Timestamp) populated via Firestore `serverTimestamp()`.
4. **Denormalization for Fast Read Access:** Key display strings (such as `tableNumber`, `itemName`, `waiterName`) are denormalized into transaction records to reduce cross-document lookups.
5. **Decoupled Realtime Presence:** Ephemeral connection, heartbeat, and presence signals are routed through **Firebase Realtime Database** to prevent exhausting Firestore daily read/write limits on the Spark ₹0 plan.

---

## 2. Cloud Firestore Document Collections (27 Collections)

### 2.1 Core Organization & Identity

#### `restaurants/{restaurantId}`
- `restaurantId`: `string` (Document ID, e.g. `rest-001-main`)
- `name`: `string` (e.g. "The Grand Bistro & Craft Kitchen")
- `tagline`: `string`
- `logoUrl`: `string`
- `address`: `string`
- `city`: `string`
- `state`: `string`
- `postalCode`: `string`
- `phone`: `string`
- `email`: `string`
- `gstin`: `string`
- `fssaiLicense`: `string`
- `currency`: `string` (default: `"INR"`)
- `currencySymbol`: `string` (default: `"₹"`)
- `timezone`: `string` (default: `"Asia/Kolkata"`)
- `settings`: `map` (taxes, auto-accept orders, voice language, sound volume)
- `isActive`: `boolean`
- `createdAt`: `timestamp`
- `updatedAt`: `timestamp`

#### `users/{userId}`
- `userId`: `string` (Document ID matching Firebase Auth `uid`)
- `restaurantId`: `string`
- `email`: `string`
- `username`: `string`
- `fullName`: `string`
- `phone`: `string`
- `role`: `string` (`"master_admin" | "owner" | "admin" | "counter" | "waiter" | "kitchen" | "customer"`)
- `employeeId`: `string` (optional)
- `isActive`: `boolean`
- `lastLoginAt`: `timestamp`
- `createdAt`: `timestamp`
- `updatedAt`: `timestamp`

#### `staff/{staffId}`
- `staffId`: `string` (Document ID, e.g. `st-wtr-01`)
- `restaurantId`: `string`
- `userId`: `string` (Reference to `users/{userId}`)
- `employeeCode`: `string` (e.g. `"EMP-WTR-101"`)
- `designation`: `string`
- `assignedStations`: `array<string>` (for kitchen staff)
- `shiftPreference`: `string` (`"morning" | "evening" | "night"`)
- `isOnDuty`: `boolean`
- `currentDeviceId`: `string`
- `createdAt`: `timestamp`
- `updatedAt`: `timestamp`

#### `staffRoles/{roleId}`
- `roleId`: `string` (Document ID, e.g. `"waiter"`, `"counter"`)
- `roleName`: `string`
- `description`: `string`
- `isSystemRole`: `boolean`
- `createdAt`: `timestamp`

#### `rolePermissions/{permissionId}`
- `permissionId`: `string`
- `roleId`: `string`
- `module`: `string` (`"tables" | "menu" | "orders" | "kitchen" | "billing" | "staff"`)
- `actions`: `array<string>` (`"create" | "read" | "update" | "delete"`)

---

### 2.2 Table Management & QR Tokens

#### `restaurantTables/{tableId}`
- `tableId`: `string` (Document ID, e.g. `tbl-10`)
- `restaurantId`: `string`
- `tableNumber`: `string` (e.g. `"T-10"`)
- `seatingCapacity`: `number` (e.g. `4`)
- `floorArea`: `string` (e.g. `"Main Dining"`, `"Terrace"`, `"Rooftop"`)
- `status`: `string` (`"AVAILABLE" | "OCCUPIED" | "RESERVED" | "PAYMENT_PENDING" | "CLEANING" | "DISABLED"`)
- `currentWaiterId`: `string` (optional, reference to `staff/{staffId}`)
- `currentSessionId`: `string` (optional, reference to `tableSessions/{sessionId}`)
- `isActive`: `boolean`
- `updatedAt`: `timestamp`

#### `qrTokens/{tokenId}`
- `tokenId`: `string` (Document ID, e.g. `qrt-tbl-10`)
- `restaurantId`: `string`
- `tableId`: `string` (Reference to `restaurantTables/{tableId}`)
- `tableNumber`: `string`
- `tokenHash`: `string` (SHA-256 cryptographic token)
- `isPermanent`: `boolean` (default: `true`)
- `validDate`: `string` (YYYY-MM-DD)
- `isRevoked`: `boolean` (default: `false`)
- `qrImageUrl`: `string`
- `createdAt`: `timestamp`

#### `tableSessions/{sessionId}`
- `sessionId`: `string` (Document ID, e.g. `ses-20261112-1001`)
- `restaurantId`: `string`
- `tableId`: `string`
- `tableNumber`: `string`
- `qrTokenId`: `string`
- `sessionToken`: `string` (Client session token stored in browser)
- `status`: `string` (`"ACTIVE" | "PAYMENT_PENDING" | "COMPLETED" | "CLOSED"`)
- `guestCount`: `number`
- `customerId`: `string` (optional, reference to `customers/{customerId}`)
- `customerName`: `string` (optional)
- `customerPhone`: `string` (optional)
- `totalAmount`: `number`
- `openedAt`: `timestamp`
- `closedAt`: `timestamp` (optional)
- `createdAt`: `timestamp`
- `updatedAt`: `timestamp`

---

### 2.3 Menu, Categories & Catalog

#### `menuCategories/{categoryId}`
- `categoryId`: `string` (Document ID, e.g. `cat-starters`)
- `restaurantId`: `string`
- `name`: `string` (e.g. "Artisanal Starters")
- `slug`: `string`
- `icon`: `string`
- `displayOrder`: `number`
- `isActive`: `boolean`
- `createdAt`: `timestamp`

#### `menuItems/{itemId}`
- `itemId`: `string` (Document ID, e.g. `itm-paneer-tikka`)
- `restaurantId`: `string`
- `categoryId`: `string` (Reference to `menuCategories/{categoryId}`)
- `name`: `string`
- `description`: `string`
- `basePrice`: `number` (in INR, e.g. `340`)
- `isVeg`: `boolean`
- `isSpicy`: `boolean`
- `isBestSeller`: `boolean`
- `imageUrl`: `string`
- `kitchenStationId`: `string` (Reference to `kitchenStations/{stationId}`)
- `variants`: `array<map>` (`[{ id, name, priceDelta }]`)
- `addonIds`: `array<string>`
- `isAvailable`: `boolean`
- `prepTimeMinutes`: `number`
- `createdAt`: `timestamp`
- `updatedAt`: `timestamp`

#### `menuAddons/{addonId}`
- `addonId`: `string` (Document ID, e.g. `add-extra-cheese`)
- `restaurantId`: `string`
- `name`: `string`
- `price`: `number`
- `isAvailable`: `boolean`
- `createdAt`: `timestamp`

---

### 2.4 Orders & Kitchen Fulfillment

#### `orders/{orderId}`
- `orderId`: `string` (Document ID, e.g. `ord-20261112-9841`)
- `orderNumber`: `string` (e.g. `"ORD-1432-801"`)
- `restaurantId`: `string`
- `tableSessionId`: `string` (Reference to `tableSessions/{sessionId}`)
- `tableId`: `string`
- `tableNumber`: `string`
- `customerPhone`: `string`
- `customerName`: `string`
- `status`: `string` (`"NEW" | "ACCEPTED" | "PREPARING" | "READY_FOR_HANDOVER" | "PICKED_UP" | "SERVED" | "CANCELLED"`)
- `paymentStatus`: `string` (`"UNPAID" | "PAID"`)
- `itemCount`: `number`
- `subtotalAmount`: `number`
- `cgstAmount`: `number` (2.5%)
- `sgstAmount`: `number` (2.5%)
- `discountAmount`: `number`
- `totalAmount`: `number`
- `specialNotes`: `string`
- `idempotencyKey`: `string` (Client UUID preventing duplicate order submission)
- `createdAt`: `timestamp`
- `updatedAt`: `timestamp`

#### `orderItems/{orderItemId}`
- `orderItemId`: `string` (Document ID, e.g. `oi-ord-9841-01`)
- `orderId`: `string` (Reference to `orders/{orderId}`)
- `restaurantId`: `string`
- `menuItemId`: `string`
- `itemName`: `string`
- `variantId`: `string` (optional)
- `variantName`: `string` (optional)
- `addons`: `array<map>` (`[{ id, name, price }]`)
- `unitPrice`: `number`
- `quantity`: `number`
- `totalPrice`: `number`
- `specialInstructions`: `string`
- `kitchenStationId`: `string`

#### `orderStatusHistory/{historyId}`
- `historyId`: `string`
- `orderId`: `string`
- `restaurantId`: `string`
- `previousStatus`: `string`
- `newStatus`: `string`
- `changedByUserId`: `string`
- `changedByRole`: `string`
- `reason`: `string`
- `timestamp`: `timestamp`

#### `kitchenStations/{stationId}`
- `stationId`: `string` (e.g. `sta-curry`, `sta-tandoor`, `sta-beverage`, `sta-dessert`)
- `restaurantId`: `string`
- `name`: `string` (e.g. "Tandoor & Charcoal")
- `code`: `string`
- `displayOrder`: `number`
- `isActive`: `boolean`

#### `kitchenTickets/{ticketId}`
- `ticketId`: `string` (Document ID, e.g. `tkt-20261112-9841-curry`)
- `ticketNumber`: `string` (e.g. `"KOT-0821"`)
- `restaurantId`: `string`
- `orderId`: `string`
- `stationId`: `string`
- `stationName`: `string`
- `tableNumber`: `string`
- `status`: `string` (`"NEW" | "ACCEPTED" | "PREPARING" | "READY" | "HANDED_OVER"`)
- `items`: `array<map>` (Item details, quantities, and notes)
- `createdAt`: `timestamp`
- `readyAt`: `timestamp` (optional)
- `handedOverAt`: `timestamp` (optional)

#### `kitchenTicketItems/{ticketItemId}`
- `ticketItemId`: `string`
- `ticketId`: `string`
- `orderItemId`: `string`
- `itemName`: `string`
- `quantity`: `number`
- `specialInstructions`: `string`

---

### 2.5 Waiter Service & Floor Assistance

#### `waiterCalls/{callId}`
- `callId`: `string` (Document ID, e.g. `call-20261112-0412`)
- `restaurantId`: `string`
- `tableId`: `string`
- `tableNumber`: `string`
- `tableSessionId`: `string`
- `customerId`: `string` (optional)
- `customerName`: `string`
- `customerPhone`: `string`
- `requestType`: `string` (`"CALL_WAITER" | "WATER" | "REQUEST_BILL" | "CLEANING" | "ASSISTANCE"`)
- `requestMessage`: `string` (optional)
- `priority`: `string` (`"NORMAL" | "URGENT"`)
- `status`: `string` (`"REQUESTED" | "SENT" | "ACCEPTED" | "ON_THE_WAY" | "ARRIVED" | "COMPLETED" | "CANCELLED" | "ESCALATED"`)
- `assignedWaiterId`: `string` (Reference to `staff/{staffId}`)
- `assignedWaiterName`: `string`
- `acceptedAt`: `timestamp` (optional)
- `arrivedAt`: `timestamp` (optional)
- `completedAt`: `timestamp` (optional)
- `createdAt`: `timestamp`
- `updatedAt`: `timestamp`

#### `waiterAssignments/{assignmentId}`
- `assignmentId`: `string`
- `restaurantId`: `string`
- `tableId`: `string`
- `waiterId`: `string`
- `shiftDate`: `string` (YYYY-MM-DD)
- `isPrimary`: `boolean`
- `assignedAt`: `timestamp`

#### `serviceRequests/{requestId}`
- `requestId`: `string`
- `restaurantId`: `string`
- `tableSessionId`: `string`
- `type`: `string`
- `status`: `string`
- `createdAt`: `timestamp`

---

### 2.6 Customers & Loyalty System

#### `customers/{customerId}`
- `customerId`: `string` (Document ID, e.g. `cust-9888877665`)
- `restaurantId`: `string`
- `phone`: `string` (Unique normalized format: `+919888877665`)
- `fullName`: `string`
- `email`: `string` (optional)
- `totalVisits`: `number`
- `totalSpend`: `number`
- `lastVisitAt`: `timestamp`
- `createdAt`: `timestamp`
- `updatedAt`: `timestamp`

#### `invoices/{invoiceId}`
- `invoiceId`: `string` (Document ID, e.g. `INV-20261112-0891`)
- `invoiceNumber`: `string`
- `restaurantId`: `string`
- `tableSessionId`: `string`
- `tableId`: `string`
- `tableNumber`: `string`
- `customerId`: `string` (optional)
- `customerName`: `string`
- `customerPhone`: `string`
- `orderIds`: `array<string>`
- `subtotalAmount`: `number`
- `cgstAmount`: `number` (2.5%)
- `sgstAmount`: `number` (2.5%)
- `discountAmount`: `number`
- `netAmount`: `number`
- `status`: `string` (`"DRAFT" | "ISSUED" | "PAID" | "CANCELLED"`)
- `pdfUrl`: `string` (optional)
- `createdAt`: `timestamp`
- `paidAt`: `timestamp` (optional)

#### `payments/{paymentId}`
- `paymentId`: `string` (Document ID, e.g. `pay-20261112-5501`)
- `restaurantId`: `string`
- `invoiceId`: `string` (Reference to `invoices/{invoiceId}`)
- `tableSessionId`: `string`
- `amount`: `number`
- `paymentMethod`: `string` (`"CASH" | "UPI" | "CARD" | "RAZORPAY"`)
- `status`: `string` (`"PENDING" | "PAID" | "FAILED" | "REFUNDED"`)
- `transactionReference`: `string` (e.g. UPI UTR number or Gateway Payment ID)
- `cashTenderedAmount`: `number` (optional)
- `cashChangeAmount`: `number` (optional)
- `verifiedByUserId`: `string` (Staff UID confirming cash payment)
- `createdAt`: `timestamp`
- `completedAt`: `timestamp`

#### `refunds/{refundId}`
- `refundId`: `string`
- `paymentId`: `string`
- `restaurantId`: `string`
- `amount`: `number`
- `reason`: `string`
- `status`: `string` (`"REQUESTED" | "PROCESSED" | "REJECTED"`)
- `approvedByUserId`: `string`
- `createdAt`: `timestamp`

---

### 2.7 Notifications & Security Audit

#### `notifications/{notificationId}`
- `notificationId`: `string`
- `restaurantId`: `string`
- `recipientRole`: `string` (`"owner" | "admin" | "counter" | "waiter" | "kitchen" | "customer"`)
- `recipientUserId`: `string` (optional)
- `title`: `string`
- `message`: `string`
- `type`: `string` (`"ORDER" | "CALL" | "BILL" | "FOOD_READY" | "PAYMENT"`)
- `isRead`: `boolean`
- `createdAt`: `timestamp`

#### `notificationEvents/{eventId}`
- `eventId`: `string`
- `restaurantId`: `string`
- `eventType`: `string` (`"NEW_ORDER" | "CALL_WAITER" | "ORDER_READY" | "REQUEST_BILL" | "PAYMENT_RECEIVED"`)
- `eventPayload`: `map`
- `spokenText`: `string`
- `language`: `string` (`"hi" | "en"`)
- `createdAt`: `timestamp`

#### `auditLogs/{logId}`
- `logId`: `string` (Document ID, e.g. `log-20261112-0012`)
- `restaurantId`: `string`
- `eventType`: `string` (`"LOGIN_SUCCESS" | "LOGIN_FAILED" | "RATE_LIMIT_TRIGGERED" | "ROLE_CHANGED" | "STAFF_CREATED" | "STAFF_DEACTIVATED" | "PASSWORD_RESET" | "PAYMENT_CONFIRMED"`)
- `userId`: `string`
- `username`: `string`
- `role`: `string`
- `ipAddress`: `string`
- `details`: `map`
- `createdAt`: `timestamp`

---

## 3. Firebase Realtime Database Hierarchy

```
/presence/
  {restaurantId}/
    {userId}/
      status: "online" | "offline"
      role: "waiter" | "kitchen" | "counter" | "admin" | "owner"
      lastSeen: 1731405600000

/connections/
  {restaurantId}/
    {userId}/
      connectedAt: 1731405600000
      clientIp: "103.21.244.0"

/liveEvents/
  {restaurantId}/
    {eventId}/
      eventType: "NEW_ORDER" | "CALL_WAITER" | "ORDER_READY"
      tableNumber: "T-05"
      waiterId: "st-wtr-01"
      timestamp: 1731405600000

/deviceStatus/
  {restaurantId}/
    {deviceId}/
      batteryLevel: 92
      audioMuted: false
      appVersion: "1.0.0"
      lastPing: 1731405600000
```

---

## 4. Required Composite Indexes (`firestore.indexes.json`)

```json
{
  "indexes": [
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "restaurantId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "waiterCalls",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "restaurantId", "order": "ASCENDING" },
        { "fieldPath": "assignedWaiterId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "kitchenTickets",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "restaurantId", "order": "ASCENDING" },
        { "fieldPath": "stationId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "auditLogs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "restaurantId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```
