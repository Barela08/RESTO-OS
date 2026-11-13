# RESTO OS — Multi-Device Role & Hardware Architecture Specification

## 1. Executive Summary
RESTO OS is designed as an enterprise-grade multi-tenant restaurant operating system designed to run across multiple physically distinct hardware devices operating independently over public internet connections. 

Prior to this architectural repair, staff and customer audio alerts suffered from severe leakage—most notably, when a customer clicked "Call Waiter" or placed an order, their personal mobile device played staff alerts (waiter captain bell, kitchen order chime), while staff terminals failed to receive real-time updates without manual browser refresh or reliance on local-only browser storage/broadcast channels.

This document formalizes the production hardware deployment model, the hardware device registration schema (`deviceRegistrations/{deviceId}`), and the strict role-based separation of data subscriptions and audio/tactile notifications.

---

## 2. Hardware Roles & Physical Deployment Topology

```
                                  +---------------------------------------+
                                  |     Cloud Firestore & Realtime DB     |
                                  |       Project: resto-os-3bf6c         |
                                  +---------------------------------------+
                                     /             |              \          \
                                    /              |               \          \
    (Role: 'counter')              /               |                \          \  (Role: 'customer')
+----------------------------+    /   (Role: 'kitchen')   (Role: 'waiter')      +----------------------------+
|  DEVICE 1: Cash Counter PC |<--+        /                 \         +-------->| DEVICE 4: Customer Mobile  |
|  - Desktop / POS Register  |           v                   v                  | - Guest Mobile Browser     |
|  - Orders awaiting billing |  +--------------------+  +--------------------+  | - Table Permanent QR scan  |
|  - Cash settlements        |  | DEVICE 3: Kitchen  |  | DEVICE 2: Waiter   |  | - Silent order submission  |
|  - Counter register chime  |  | - Tablet / KDS Wall|  | - Handheld Android |  | - Silent Call Waiter       |
|  - Strict Zero Waiter Bell |  | - Ticket routing   |  | - Service calls    |  | - Realtime visual tracking |
+----------------------------+  | - Food prep stages |  | - Dish pickup bell |  | - Zero staff alert sounds  |
                                | - Kitchen chime    |  | - Haptic vibration |  +----------------------------+
                                +--------------------+  +--------------------+
```

### Physical Device Matrix

| Device Name | Hardware Profile | Authenticated Role | Subscribed Firestore Collections | Audio Alerts & Haptics | Autoplay Policy Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Device 1: Cash Counter** | Desktop PC / Chrome OS / POS Terminal | `counter` (or `admin`, `owner`) | `orders`, `invoices`, `payments`, `waiterCalls (REQUEST_BILL)` | Dual-tone Counter Cash Chime (B5/E6 synth) | Prime on Cashier PIN Login |
| **Device 2: Waiter Station** | Handheld Android / iOS Mobile | `waiter` | `waiterCalls (status in [PENDING, ACCEPTED])`, `kitchenTickets (status in [READY, READY_FOR_HANDOVER])` | High-frequency Captain Bell (C6/E6 dual strike) + Haptic Vibration `[250ms, 100ms, 250ms]` | Prime on Waiter PIN Login |
| **Device 3: Kitchen Station** | Wall-mount Tablet / KDS Display | `kitchen` | `kitchenTickets (restaurantId, stationId)` | Soft Pleasant New Order Chime (C5/G5/E5 polyphonic synth) | Prime on Chef Station Selection |
| **Device 4: Customer Mobile** | Any Guest Smartphone (Android/iOS) | `customer` (Unauthenticated Guest Session) | `tableSessions/{sessionId}`, `orders/{orderId}`, `waiterCalls/{callId}` | **STRICTLY SILENT** (Visual status toasts only; zero staff bells, zero kitchen chimes) | Not applicable (Silent UI) |

---

## 3. Hardware Device Registration Schema (`deviceRegistrations/{deviceId}`)

Every physical staff terminal establishes a persistent hardware identity upon first boot and synchronizes its operational telemetry to Cloud Firestore:

### Document Path: `deviceRegistrations/{deviceId}`
```typescript
export interface FirestoreDeviceRegistration {
  deviceId: string;                   // Persistent UUID (e.g. dev-1741789200-a8f9)
  userId: string;                     // Staff Auth Profile ID (e.g. st-wtr-1)
  staffId?: string | null;            // Floor employee ID
  restaurantId: string;               // Multi-tenant isolation key (e.g. rest-001-main)
  role: 'counter' | 'waiter' | 'kitchen' | 'customer' | 'admin' | 'owner';
  deviceType: 'desktop' | 'mobile' | 'tablet';
  fcmToken?: string | null;           // Web Push registration token
  notificationPermission: 'default' | 'granted' | 'denied';
  lastActiveAt: Timestamp | string;   // Heartbeat timestamp (updated every 60s)
  isActive: boolean;                  // Set false on logout
  userAgent?: string;                 // Browser & platform telemetry
  appVersion?: string;                // Deployed release version (2.4.0)
}
```

### Heartbeat & Telemetry Lifecycle
1. **Generation**: `deviceRegistrationService.getOrCreateDeviceId()` creates a persistent UUID stored in `localStorage` under `resto_device_id`.
2. **Registration**: When staff authenticate via PIN/Password, `registerDevice()` is invoked, persisting the role, device type, and notification permission.
3. **Heartbeat**: A 60-second periodic timer executes `heartbeat(deviceId)`, maintaining `lastActiveAt: serverTimestamp()` and `isActive: true`.
4. **De-registration**: Upon staff logout, `unregisterDevice(deviceId)` sets `isActive: false` and clears role tokens, preventing stale background dispatch.

---

## 4. Role Subscription & Event Routing Matrix

| Event Type | Generated By | Target Recipient Role | Foreground Delivery Channel | Background Delivery Channel | Audio / Tactile Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `CALL_WAITER` | Customer Mobile | `waiter` (or assigned staff ID) | Firestore `waiterCalls` onSnapshot | FCM Push Notification | Waiter Bell + 250ms Vibration on Waiter Mobile only; **Silent** on Customer Mobile |
| `NEW_ORDER` | Customer Mobile | `kitchen`, `counter` | Firestore `kitchenTickets` onSnapshot & RTDB Signal | FCM Push Notification | Kitchen Chime on Kitchen KDS; Counter Chime on Counter; **Silent** on Customer Mobile |
| `ORDER_READY` | Kitchen KDS | `waiter` | Firestore `kitchenTickets` onSnapshot | FCM Push Notification | Waiter Bell + 250ms Vibration on Waiter Mobile; **Silent** on Kitchen KDS & Customer |
| `ORDER_SERVED` | Waiter Mobile | `customer`, `counter` | Firestore `orders/{orderId}` onSnapshot | In-app visual stage progression | Visual badge update to `SERVED`; **Silent** on all devices |
| `BILL_REQUESTED` | Customer Mobile | `counter`, `waiter` | Firestore `waiterCalls (REQUEST_BILL)` onSnapshot | FCM Push Notification | Counter Chime on Counter PC; Waiter Bell on Waiter Mobile; **Silent** on Customer Mobile |
| `PAYMENT_RECEIVED` | Counter PC | `counter`, `owner` | Firestore `payments` onSnapshot | FCM Push Notification | Counter Cash Register Chime on Counter PC only |

---

## 5. Security & Isolation Boundaries
1. **Zero Customer Staff Role Leakage**:
   - `voiceAnnouncementService.announceEvent` defaults unauthenticated or missing roles to `'customer'`.
   - `processNotificationEvent` aborts immediately if `currentRole === 'customer'`, ensuring guests never process staff announcements or trigger synthetic alerts.
2. **Multi-Tenant Protection**:
   - Every subscription query enforces `where('restaurantId', '==', restaurantId)`. Devices cannot observe operational data belonging to other establishments.
3. **Autoplay Compliance**:
   - Audio contexts are unlocked on explicit staff interaction during login (`unlockAudio()`), satisfying iOS Safari and Chrome strict autoplay security policies.
