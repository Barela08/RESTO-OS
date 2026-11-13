// ====================================================================
// RESTO OS - Cloud Firestore & Realtime Database Type Definitions
// Multi-tenant restaurant architecture with strict type safety
// ====================================================================

import { Timestamp, FieldValue } from 'firebase/firestore';
import { StaffRoleType, TableStatus, OrderStatus, KitchenTicketStatus, PaymentMethod, PaymentStatus, WaiterCallStatus } from './index';

// Universal Document Base with mandatory multi-tenant isolation
export interface FirestoreBaseDocument {
  id: string;
  restaurantId: string;
  createdAt: Timestamp | FieldValue | string;
  updatedAt?: Timestamp | FieldValue | string;
}

// --------------------------------------------------------------------
// 1. Core Organization & Staff Identity
// --------------------------------------------------------------------

export interface FirestoreRestaurant {
  restaurantId: string;
  name: string;
  tagline?: string;
  logoUrl?: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  email: string;
  gstin?: string;
  fssaiLicense?: string;
  currency: string;
  currencySymbol: string;
  timezone: string;
  settings: {
    cgstRate: number; // e.g. 0.025 (2.5%)
    sgstRate: number; // e.g. 0.025 (2.5%)
    autoAcceptOrders: boolean;
    voiceEnabled: boolean;
    voiceLanguage: 'hi' | 'en';
    soundVolume: number;
    waiterEscalationTimeoutSeconds: number;
    backupWaiterId?: string;
  };
  isActive: boolean;
  createdAt: Timestamp | FieldValue | string;
  updatedAt?: Timestamp | FieldValue | string;
}

export interface FirestoreUser {
  userId: string; // Auth UID
  restaurantId: string;
  email: string;
  username: string;
  fullName: string;
  phone?: string;
  role: StaffRoleType | 'master_admin' | 'customer';
  employeeId?: string;
  isActive: boolean;
  lastLoginAt?: Timestamp | FieldValue | string;
  createdAt: Timestamp | FieldValue | string;
  updatedAt?: Timestamp | FieldValue | string;
}

export interface FirestoreStaff {
  staffId: string;
  restaurantId: string;
  userId: string;
  name: string;
  role: StaffRoleType;
  employeeCode: string;
  designation?: string;
  assignedStations?: string[]; // stationIds for kitchen staff
  shiftPreference?: 'morning' | 'evening' | 'night';
  isOnDuty: boolean;
  currentDeviceId?: string;
  createdAt: Timestamp | FieldValue | string;
  updatedAt?: Timestamp | FieldValue | string;
}

export interface FirestoreStaffRole {
  roleId: string;
  roleName: string;
  description: string;
  isSystemRole: boolean;
  createdAt: Timestamp | FieldValue | string;
}

export interface FirestoreRolePermission {
  permissionId: string;
  roleId: string;
  module: 'tables' | 'menu' | 'orders' | 'kitchen' | 'billing' | 'staff' | 'settings';
  actions: ('create' | 'read' | 'update' | 'delete')[];
}

// --------------------------------------------------------------------
// 2. Table Management & Cryptographic QR Sessions
// --------------------------------------------------------------------

export interface FirestoreRestaurantTable {
  tableId: string;
  restaurantId: string;
  tableNumber: string;
  seatingCapacity: number;
  floorArea: string;
  status: TableStatus;
  currentWaiterId?: string;
  currentSessionId?: string;
  isActive: boolean;
  createdAt?: Timestamp | FieldValue | string;
  updatedAt?: Timestamp | FieldValue | string;
}

export interface FirestoreQRToken {
  tokenId: string;
  restaurantId: string;
  tableId: string;
  tableNumber: string;
  tokenHash: string;
  isPermanent: boolean;
  validDate: string;
  isRevoked: boolean;
  revokedAt?: Timestamp | FieldValue | string;
  revokedReason?: string;
  qrImageUrl?: string;
  createdAt: Timestamp | FieldValue | string;
}

export interface FirestoreTableSession {
  sessionId: string;
  restaurantId: string;
  tableId: string;
  tableNumber: string;
  qrTokenId: string;
  sessionToken: string;
  status: 'ACTIVE' | 'PAYMENT_PENDING' | 'COMPLETED' | 'CLOSED';
  guestCount: number;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  totalAmount: number;
  openedAt: Timestamp | FieldValue | string;
  closedAt?: Timestamp | FieldValue | string;
  createdAt: Timestamp | FieldValue | string;
  updatedAt?: Timestamp | FieldValue | string;
}

// --------------------------------------------------------------------
// 3. Menu, Categories & Catalog
// --------------------------------------------------------------------

export interface FirestoreMenuCategory {
  categoryId: string;
  restaurantId: string;
  name: string;
  slug: string;
  icon?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Timestamp | FieldValue | string;
}

export interface FirestoreMenuItem {
  itemId: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string;
  basePrice: number;
  isVeg: boolean;
  isSpicy: boolean;
  isBestSeller: boolean;
  imageUrl?: string;
  kitchenStationId?: string;
  variants?: { id: string; name: string; priceDelta: number }[];
  addonIds?: string[];
  isAvailable: boolean;
  prepTimeMinutes?: number;
  createdAt: Timestamp | FieldValue | string;
  updatedAt?: Timestamp | FieldValue | string;
}

export interface FirestoreMenuAddon {
  addonId: string;
  restaurantId: string;
  name: string;
  price: number;
  isAvailable: boolean;
  createdAt: Timestamp | FieldValue | string;
}

// --------------------------------------------------------------------
// 4. Orders & Kitchen Fulfillment
// --------------------------------------------------------------------

export interface FirestoreOrder {
  orderId: string;
  orderNumber: string;
  restaurantId: string;
  tableSessionId: string;
  tableId: string;
  tableNumber: string;
  customerPhone?: string | null;
  customerName?: string | null;
  status: OrderStatus;
  paymentStatus: 'UNPAID' | 'PAID';
  itemCount: number;
  subtotalAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  discountAmount: number;
  totalAmount: number;
  specialNotes?: string | null;
  idempotencyKey?: string | null;
  createdAt: Timestamp | FieldValue | string;
  updatedAt?: Timestamp | FieldValue | string;
}

export interface FirestoreOrderItem {
  orderItemId: string;
  orderId: string;
  restaurantId: string;
  menuItemId: string;
  itemName: string;
  variantId?: string | null;
  variantName?: string | null;
  addons: { id: string; name: string; price: number }[];
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  specialInstructions?: string;
  kitchenStationId?: string;
}

export interface FirestoreOrderStatusHistory {
  historyId: string;
  orderId: string;
  restaurantId: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  changedByUserId?: string;
  changedByRole?: string;
  reason?: string;
  timestamp: Timestamp | FieldValue | string;
}

export interface FirestoreKitchenStation {
  stationId: string;
  restaurantId: string;
  name: string;
  code: string;
  displayOrder: number;
  isActive: boolean;
}

export interface FirestoreKitchenTicket {
  ticketId: string;
  ticketNumber: string;
  restaurantId: string;
  orderId: string;
  stationId: string;
  stationName: string;
  tableNumber: string;
  status: KitchenTicketStatus;
  items: {
    orderItemId: string;
    itemName: string;
    quantity: number;
    specialInstructions?: string;
  }[];
  createdAt: Timestamp | FieldValue | string;
  updatedAt?: Timestamp | FieldValue | string;
  readyAt?: Timestamp | FieldValue | string;
  handedOverAt?: Timestamp | FieldValue | string;
}

export interface FirestoreKitchenTicketItem {
  ticketItemId: string;
  ticketId: string;
  orderItemId: string;
  itemName: string;
  quantity: number;
  specialInstructions?: string;
}

// --------------------------------------------------------------------
// 5. Waiter Service & Floor Calling
// --------------------------------------------------------------------

export interface FirestoreWaiterCall {
  callId: string;
  restaurantId: string;
  tableId: string;
  tableNumber: string;
  tableSessionId: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  requestType: 'CALL_WAITER' | 'WATER' | 'REQUEST_BILL' | 'CLEANING' | 'ASSISTANCE';
  requestMessage?: string;
  priority: 'NORMAL' | 'URGENT';
  status: WaiterCallStatus;
  assignedWaiterId?: string;
  assignedWaiterName?: string;
  acceptedAt?: Timestamp | FieldValue | string;
  onTheWayAt?: Timestamp | FieldValue | string;
  arrivedAt?: Timestamp | FieldValue | string;
  completedAt?: Timestamp | FieldValue | string;
  cancelledAt?: Timestamp | FieldValue | string;
  createdAt: Timestamp | FieldValue | string;
  updatedAt?: Timestamp | FieldValue | string;
}

export interface FirestoreWaiterAssignment {
  assignmentId: string;
  restaurantId: string;
  tableId: string;
  waiterId: string;
  shiftDate: string; // YYYY-MM-DD
  isPrimary: boolean;
  assignedAt: Timestamp | FieldValue | string;
}

export interface FirestoreServiceRequest {
  requestId: string;
  restaurantId: string;
  tableSessionId: string;
  type: string;
  status: string;
  createdAt: Timestamp | FieldValue | string;
}

// --------------------------------------------------------------------
// 6. Customers, Billing & Financial Transactions
// --------------------------------------------------------------------

export interface FirestoreCustomer {
  customerId: string;
  restaurantId: string;
  phone: string;
  fullName: string;
  email?: string;
  totalVisits: number;
  totalSpend: number;
  lastVisitAt?: Timestamp | FieldValue | string;
  createdAt: Timestamp | FieldValue | string;
  updatedAt?: Timestamp | FieldValue | string;
}

export interface FirestoreInvoice {
  invoiceId: string;
  invoiceNumber: string;
  restaurantId: string;
  tableSessionId: string;
  tableId: string;
  tableNumber: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  orderIds: string[];
  subtotalAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  discountAmount: number;
  netAmount: number;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED';
  pdfUrl?: string;
  createdAt: Timestamp | FieldValue | string;
  paidAt?: Timestamp | FieldValue | string;
}

export interface FirestorePayment {
  paymentId: string;
  restaurantId: string;
  invoiceId: string;
  tableSessionId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  transactionReference?: string;
  cashTenderedAmount?: number;
  cashChangeAmount?: number;
  verifiedByUserId?: string;
  createdAt: Timestamp | FieldValue | string;
  completedAt?: Timestamp | FieldValue | string;
  cancelledAt?: Timestamp | FieldValue | string;
}

export interface FirestoreRefund {
  refundId: string;
  restaurantId: string;
  paymentId: string;
  amount: number;
  reason: string;
  status: 'REQUESTED' | 'PROCESSED' | 'REJECTED';
  approvedByUserId?: string;
  createdAt: Timestamp | FieldValue | string;
}

// --------------------------------------------------------------------
// 7. Notifications & Security Audit
// --------------------------------------------------------------------

export interface FirestoreNotification {
  notificationId: string;
  restaurantId: string;
  recipientRole: StaffRoleType | 'all' | 'customer';
  recipientUserId?: string;
  title: string;
  message: string;
  type: 'ORDER' | 'CALL' | 'BILL' | 'FOOD_READY' | 'PAYMENT';
  isRead: boolean;
  createdAt: Timestamp | FieldValue | string;
}

export interface FirestoreNotificationEvent {
  eventId: string;
  restaurantId: string;
  eventType: 'NEW_ORDER' | 'CALL_WAITER' | 'ORDER_READY' | 'REQUEST_BILL' | 'PAYMENT_RECEIVED';
  eventPayload: Record<string, any>;
  spokenText?: string;
  language?: 'hi' | 'en';
  createdAt: Timestamp | FieldValue | string;
}

export interface FirestoreAuditLog {
  logId: string;
  restaurantId: string;
  eventType: string;
  userId?: string;
  username?: string;
  role?: string;
  ipAddress?: string;
  details?: Record<string, any>;
  createdAt: Timestamp | FieldValue | string;
}

// --------------------------------------------------------------------
// 8. Firebase Realtime Database Interfaces (Presence & Signals)
// --------------------------------------------------------------------

export interface RTDBPresence {
  status: 'online' | 'offline';
  role: StaffRoleType | 'customer';
  name?: string;
  lastSeen: number;
}

export interface RTDBConnection {
  connectedAt: number;
  clientIp?: string;
}

export interface RTDBLiveEvent {
  eventId: string;
  eventType: string;
  tableNumber?: string;
  waiterId?: string;
  timestamp: number;
  payload?: Record<string, any>;
}

export interface RTDBDeviceStatus {
  deviceId: string;
  batteryLevel?: number;
  audioMuted?: boolean;
  appVersion?: string;
  lastPing: number;
}

// --------------------------------------------------------------------
// 9. Staff Hardware & Device Role Registration
// --------------------------------------------------------------------

export interface FirestoreDeviceRegistration {
  deviceId: string;
  userId: string;
  staffId?: string | null;
  restaurantId: string;
  role: 'counter' | 'waiter' | 'kitchen' | 'customer' | 'admin' | 'owner';
  deviceType: 'desktop' | 'mobile' | 'tablet';
  fcmToken?: string | null;
  notificationPermission: 'default' | 'granted' | 'denied';
  lastActiveAt: Timestamp | FieldValue | string;
  isActive: boolean;
  userAgent?: string;
  appVersion?: string;
}
