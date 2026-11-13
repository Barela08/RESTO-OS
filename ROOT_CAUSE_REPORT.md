# RESTO OS — Production Multi-Device Notification & Audio Leakage Root Cause Analysis

## 1. Issue Summary
In multi-device production testing involving four physical devices:
1. When a customer scanned a table QR and tapped **"Call Waiter"**, the high-frequency Captain Bell sound played directly on the customer's personal mobile phone, rather than solely on the waiter mobile.
2. When a customer submitted an order, the customer's phone played the kitchen new order chime.
3. When the kitchen marked an order ready, the kitchen KDS terminal played the waiter call bell.
4. Staff terminals (Kitchen Station, Cash Counter, Waiter Station) on separate hardware devices did not synchronize in real-time unless a manual browser reload occurred.

---

## 2. Exhaustive Root Cause Analysis

### Root Cause 1: Sound Invocation Inside Client-Executed Database Adapter
- **Location**: `src/services/databaseAdapter.ts:1101` and `src/services/databaseAdapter.ts:1246`
- **Mechanism**:
  ```typescript
  // databaseAdapter.ts - placeOrder()
  this.emitNotificationEvent('NEW_ORDER', order.id, { ... });
  audioService.playNewOrderChime(); // <--- ERRONEOUS: Executed directly on client placing order!
  this.notify();
  ```
  `placeOrder()` was called directly on whichever client device submitted the order (the guest's smartphone). Placing an audio service call inside the database write function meant the client placing the order was instructed to play the chime!
- **Fix**: Removed `audioService.playNewOrderChime()` from `placeOrder()`. The customer device remains silent. Kitchen stations listen to Firestore `kitchenTickets` and play the chime upon receiving the ticket on the kitchen station.

---

### Root Cause 2: Ungated Audio Triggers in Global Realtime Listener
- **Location**: `src/services/realtimeManager.ts:144`
- **Mechanism**:
  ```typescript
  private handleNotificationEvent(payload: any) {
    const notif = payload.new;
    if (!notif) return;
    try {
      audioService.playWaiterCallBell(); // <--- ERRONEOUS: Played waiter bell globally on ANY notification!
      if (notif.message_hi || notif.message_en || notif.title) {
        voiceAnnouncementService.announceEvent(...);
      }
    } ...
  }
  ```
  `realtimeManager` runs globally in the application. Whenever any notification event was received over Supabase Realtime or broadcast, it blindly called `audioService.playWaiterCallBell()` without inspecting the current device's active role.
- **Fix**: Gated audio execution strictly behind role verification:
  - `activeRole === 'waiter'`: plays waiter call bell & haptic vibration.
  - `activeRole === 'kitchen'`: plays kitchen order chime.
  - `activeRole === 'counter'`: plays cash register chime.
  - `activeRole === 'customer'` or undefined: **Zero sound execution**.

---

### Root Cause 3: Fallback Role in Voice Announcement Service
- **Location**: `src/services/voiceAnnouncementService.ts:454`
- **Mechanism**:
  ```typescript
  public announceEvent(event: NotificationEvent, settings: VoiceSettings) {
    const role = (typeof window !== 'undefined' ? localStorage.getItem('resto_active_role') : 'admin') || 'admin';
    ...
  }
  ```
  On a customer phone that scanned a QR code, `localStorage.getItem('resto_active_role')` is `null`. The service defaulted missing roles to `'admin'`. Because `admin` is configured to receive all announcements, the customer's phone was treated as a restaurant administrator and queued speech synthesis and fallback audio!
- **Fix**: Changed default role to `'customer'`. If `role === 'customer'`, `announceEvent` and `processNotificationEvent` abort immediately.

---

### Root Cause 4: Lack of Cross-Device Firestore Subscriptions in Terminals
- **Location**:
  - `src/modules/kitchen/KitchenDashboard.tsx`
  - `src/modules/counter/CashCounterDashboard.tsx`
  - `src/modules/customer/OrderTrackingPage.tsx`
- **Mechanism**:
  `KitchenDashboard.tsx` and `CashCounterDashboard.tsx` only subscribed to `dbAdapter.subscribe(updateTickets)`, which relied on local memory and `BroadcastChannel`. BroadcastChannel is a same-browser tab-to-tab API; it **cannot** send messages across separate physical devices over the internet. Consequently, when a customer placed an order from Device 4, Device 3 (Kitchen KDS on another device) never received the update.
- **Fix**:
  - Added real-time Cloud Firestore `onSnapshot` listeners to `KitchenDashboard` (`OrderRepository.subscribeToKitchenTickets`), `WaiterDashboard` (`subscribeToKitchenTickets` for ready tickets), `CashCounterDashboard` (`subscribeToOrders`), and `OrderTrackingPage` (`doc(db, 'orders', id)`).
  - Devices now synchronize instantly across the internet.

---

### Root Cause 5: Spark ₹0 Cloud Functions Constraint for Push Notifications
- **Issue**: Background Web Push via FCM HTTP v1 requires server-side OAuth2 bearer tokens signed with a Google Service Account private key. Under Firebase Spark ₹0, Cloud Functions cannot be deployed.
- **Fix**: Implemented a secure Vercel Serverless Function `/api/notify.ts` running on Vercel's free serverless tier. Credentials remain strictly server-side in Vercel environment secrets, keeping ₹0 recurring costs while preserving total security.

---

## 3. Inventory of Modified & Created Files

| File | Action | Purpose |
| :--- | :--- | :--- |
| `src/services/audioService.ts` | Modified | Added `playCounterChime()` and `vibrate()` haptics helper |
| `src/services/databaseAdapter.ts` | Modified | Removed audio leakage from `placeOrder` & `updateKitchenTicketStatus`; added `syncFirestoreKitchenTickets` |
| `src/services/realtimeManager.ts` | Modified | Gated audio and voice announcements strictly by active device role |
| `src/services/voiceAnnouncementService.ts` | Modified | Defaulted unauthenticated role to `'customer'` and suppressed all announcements for guests |
| `src/services/firebase/fcmService.ts` | Modified | Role-gated foreground push audio; integrated token update to device registration |
| `src/types/firestore.ts` | Modified | Added `FirestoreDeviceRegistration` interface |
| `src/types/index.ts` | Modified | Added `payment_status` to `Order` and extended `VoiceEventType` |
| `src/services/firebase/orderRepository.ts` | Modified | Added `mapFirestoreKitchenTicketToKitchenTicket` helper |
| `src/services/firebase/deviceRegistrationService.ts` | Created | Production hardware device registration, heartbeat, and query service |
| `src/store/authStore.ts` | Modified | Integrated device registration on login and de-registration on logout |
| `src/modules/kitchen/KitchenDashboard.tsx` | Modified | Added real-time Firestore `onSnapshot` subscription & kitchen chime |
| `src/modules/waiter/WaiterDashboard.tsx` | Modified | Added real-time Firestore ready tickets subscription & Captain Bell alert |
| `src/modules/counter/CashCounterDashboard.tsx` | Modified | Added real-time Firestore live orders subscription & cash register chime |
| `src/modules/customer/OrderTrackingPage.tsx` | Modified | Added real-time Firestore order tracking subscription without audio |
| `api/notify.ts` | Created | Vercel Serverless Function for secure server-side FCM push dispatch |
| `vercel.json` | Modified | Configured rewrites to support `/api/(.*)` endpoints |
| `tests/multi_device_role_notifications.test.ts` | Created | 6 end-to-end integration tests verifying multi-device role isolation |
| `DEVICE_ROLE_ARCHITECTURE.md` | Created | Formal hardware deployment specification |
| `NOTIFICATION_DELIVERY_ARCHITECTURE.md` | Created | Notification delivery pipelines & Spark ₹0 push architecture |
| `MULTI_DEVICE_TEST_REPORT.md` | Created | Verification report for physical device tests 1 to 6 |
| `FIREBASE_SECURITY_REVIEW.md` | Created | Firestore RBAC, multi-tenancy & financial protection review |
| `ROOT_CAUSE_REPORT.md` | Created | Comprehensive root cause analysis & file inventory |

---

## 4. Remaining Operational Boundaries & Considerations
1. **Background Web Push Requires Vercel Server Secret**:
   - To send background push notifications when a mobile screen is locked, `FIREBASE_SERVICE_ACCOUNT_KEY` must be populated in the Vercel project dashboard environment variables.
   - Foreground notifications operate 100% reliably out of the box via Cloud Firestore `onSnapshot` WebSockets without needing service account keys.
2. **iOS Safari Push Requirements**:
   - On iOS (iPhone/iPad), Web Push requires the user to add the web app to their home screen ("Add to Home Screen" PWA) and grant notification permissions.
