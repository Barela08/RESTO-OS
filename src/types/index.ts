// ====================================================================
// RESTO OS - Core TypeScript Domain Models & Interfaces
// ====================================================================

export type StaffRoleType = 'admin' | 'owner' | 'waiter' | 'kitchen' | 'counter';

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'PAYMENT_PENDING' | 'CLEANING' | 'DISABLED';

export type OrderStatus =
  | 'PLACED'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'PAYMENT_PENDING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED';

export type KitchenTicketStatus = 'NEW' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'HANDED_OVER' | 'REJECTED' | 'SERVED';

export type PaymentMethod = 'CASH' | 'UPI' | 'RAZORPAY' | 'CARD';

export type PaymentStatus = 'UNPAID' | 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'PARTIALLY_PAID' | 'REFUNDED' | 'CANCELLED';

export type ServiceRequestType = 'ASSISTANCE' | 'CALL_WAITER' | 'REQUEST_BILL' | 'CLEANING' | 'WATER';

export type ServiceRequestStatus = 'PENDING' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ESCALATED';

export type RepeatScanStatus = 'PENDING' | 'APPROVED_CONTINUE' | 'APPROVED_NEW' | 'REJECTED';

export interface Restaurant {
  id: string;
  name: string;
  tagline?: string;
  logo_url?: string;
  address: string;
  city: string;
  state?: string;
  country: string;
  postal_code?: string;
  phone: string;
  email?: string;
  gstin?: string;
  fssai_license?: string;
  currency: string;
  currency_symbol: string;
  timezone: string;
  brand_primary_color: string;
  brand_accent_color: string;
  created_at: string;
  updated_at: string;
}

export interface RestaurantSettings {
  id: string;
  restaurant_id: string;
  cgst_rate: number;
  sgst_rate: number;
  service_charge_rate: number;
  enable_loyalty: boolean;
  loyalty_min_order_amount: number;
  loyalty_stamps_per_order: number;
  loyalty_stamps_for_reward: number;
  loyalty_reward_name: string;
  loyalty_reward_validity_days: number;
  allow_guest_ordering: boolean;
  auto_accept_orders: boolean;
  qr_auto_expire_hours: number;
}

export interface Profile {
  id: string;
  restaurant_id: string;
  email: string;
  full_name: string;
  phone?: string;
  role_id: StaffRoleType;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
}

export interface Staff {
  id: string;
  restaurant_id: string;
  profile_id: string;
  employee_code: string;
  designation?: string;
  shift_preference?: string;
  is_on_duty: boolean;
  profile?: Profile;
}

export interface RestaurantTable {
  id: string;
  restaurant_id: string;
  table_number: string;
  seating_capacity: number;
  floor_area: string;
  description?: string;
  status: TableStatus;
  current_waiter_id?: string;
  current_waiter?: Staff;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TableQRToken {
  id: string;
  restaurant_id: string;
  table_id: string;
  table?: RestaurantTable;
  token_hash: string;
  valid_date: string;
  expires_at: string;
  is_permanent?: boolean;
  qr_image_url?: string;
  print_metadata?: Record<string, any>;
  is_revoked: boolean;
  revoked_at?: string;
  revoked_reason?: string;
  created_at: string;
}

export interface TableSession {
  id: string;
  restaurant_id: string;
  table_id: string;
  table?: RestaurantTable;
  qr_token_id: string;
  session_token: string;
  status: 'ACTIVE' | 'PAYMENT_PENDING' | 'CLOSED';
  opened_at: string;
  closed_at?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_id?: string;
  created_at: string;
}

export interface RepeatScanRequest {
  id: string;
  restaurant_id: string;
  table_id: string;
  table?: RestaurantTable;
  existing_session_id: string;
  existing_session?: TableSession;
  new_scan_time: string;
  customer_identifier?: string;
  status: RepeatScanStatus;
  handled_by_staff_id?: string;
  handled_at?: string;
  decision_notes?: string;
  created_at: string;
}

export interface KitchenStation {
  id: string;
  restaurant_id: string;
  code: string;
  name: string;
  description?: string;
  display_order: number;
  is_active: boolean;
}

export interface MenuCategory {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  display_order: number;
  icon_name?: string;
  image_url?: string;
  is_active: boolean;
}

export interface MenuVariant {
  id: string;
  menu_item_id: string;
  name: string;
  price_delta: number;
  is_default: boolean;
}

export interface MenuAddon {
  id: string;
  restaurant_id: string;
  name: string;
  price: number;
  is_available: boolean;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string;
  category?: MenuCategory;
  kitchen_station_id?: string;
  kitchen_station?: KitchenStation;
  name: string;
  description?: string;
  base_price: number;
  is_veg: boolean;
  is_vegan?: boolean;
  is_gluten_free?: boolean;
  spicy_level: number;
  prep_time_minutes: number;
  image_url?: string;
  is_available: boolean;
  is_popular?: boolean;
  is_recommended?: boolean;
  calories?: number;
  variants?: MenuVariant[];
  addons?: MenuAddon[];
}

export interface CartItem {
  id: string; // unique cart entry key
  menu_item: MenuItem;
  variant?: MenuVariant;
  selected_addons: MenuAddon[];
  quantity: number;
  special_instructions?: string;
  unit_price: number;
  total_price: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  variant_id?: string;
  item_name: string;
  variant_name?: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  special_instructions?: string;
  status: KitchenTicketStatus;
  kitchen_station_id?: string;
  addons?: { addon_name: string; unit_price: number }[];
}

export interface Order {
  id: string;
  restaurant_id: string;
  order_number: string;
  table_id: string;
  table?: RestaurantTable;
  table_session_id: string;
  waiter_id?: string;
  waiter?: Staff;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  subtotal_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  service_charge_amount: number;
  discount_amount: number;
  total_amount: number;
  status: OrderStatus;
  rejection_reason?: string;
  special_notes?: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface KitchenTicket {
  id: string;
  restaurant_id: string;
  order_id: string;
  order?: Order;
  station_id: string;
  station?: KitchenStation;
  ticket_number: string;
  status: KitchenTicketStatus;
  rejection_reason?: string;
  items: OrderItem[];
  table_number: string;
  accepted_at?: string;
  prep_started_at?: string;
  ready_at?: string;
  handed_over_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WaiterCall {
  id: string;
  restaurant_id: string;
  table_id: string;
  table_number: string;
  table_session_id: string;
  assigned_waiter_id?: string;
  request_type: ServiceRequestType;
  status: ServiceRequestStatus;
  notes?: string;
  acknowledged_at?: string;
  completed_at?: string;
  is_escalated?: boolean;
  created_at: string;
}

export interface Payment {
  id: string;
  restaurant_id: string;
  table_session_id: string;
  table_id: string;
  order_id?: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  gateway_order_id?: string;
  gateway_payment_id?: string;
  cash_received_amount?: number;
  cash_change_amount?: number;
  confirmed_by_staff_id?: string;
  confirmed_at?: string;
  transaction_ref?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface Invoice {
  id: string;
  restaurant_id: string;
  invoice_number: string;
  payment_id: string;
  table_session_id: string;
  table_id: string;
  order_id?: string;
  customer_name?: string;
  customer_phone?: string;
  subtotal_amount: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  service_charge_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: PaymentMethod;
  transaction_ref?: string;
  issued_at: string;
}

export interface Customer {
  id: string;
  restaurant_id: string;
  phone: string;
  full_name: string;
  email?: string;
  is_phone_verified: boolean;
  created_at: string;
}

export interface LoyaltyAccount {
  id: string;
  restaurant_id: string;
  customer_id: string;
  customer?: Customer;
  total_stamps_earned: number;
  current_active_stamps: number;
  total_rewards_unlocked: number;
  total_rewards_redeemed: number;
  created_at: string;
}

export interface LoyaltyReward {
  id: string;
  restaurant_id: string;
  loyalty_account_id: string;
  voucher_code: string;
  title: string;
  reward_title?: string;
  reward_name?: string;
  reward_type?: 'FREE_ITEM' | 'DISCOUNT_PERCENT' | 'FLAT_DISCOUNT';
  discount_percentage?: number;
  description?: string;
  is_redeemed: boolean;
  is_claimed?: boolean;
  redeemed_at?: string;
  expires_at: string;
  created_at: string;
  redemption_code?: string;
  redemption_code_hash?: string;
  redeemed_order_id?: string;
}

export interface InventoryItem {
  id: string;
  restaurant_id: string;
  name: string;
  sku?: string;
  unit: string;
  current_stock: number;
  min_stock_alert: number;
  cost_per_unit: number;
  supplier_id?: string;
  is_active: boolean;
}

export interface Supplier {
  id: string;
  restaurant_id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  is_active: boolean;
}

export interface NotificationItem {
  id: string;
  restaurant_id: string;
  recipient_role?: StaffRoleType;
  recipient_user_id?: string;
  title: string;
  message: string;
  event_type: string;
  reference_id?: string;
  is_read: boolean;
  sound_type: 'CHIME' | 'ALERT' | 'BELL';
  created_at: string;
}

// ====================================================================
// NEW MODULE TYPES: Voice Announcements, UPI QR, Customer Auth, Rewards
// ====================================================================

export type VoiceLanguage = 'hi' | 'en';

export type VoiceEventType =
  | 'NEW_ORDER'
  | 'NEW_TABLE_ORDER'
  | 'CALL_WAITER'
  | 'REQUEST_BILL'
  | 'ORDER_READY'
  | 'PAYMENT_RECEIVED'
  | 'REPEAT_SCAN'
  | 'REPEAT_SCAN_APPROVAL'
  | 'URGENT_ASSISTANCE'
  | 'ORDER_CANCELLED';

export interface VoiceSettings {
  id: string;
  restaurant_id: string;
  user_id?: string;
  language: VoiceLanguage;
  voice_enabled: boolean;
  sound_enabled: boolean;
  volume: number;
  speech_rate: number;
  repeat_count: number;
  enabled_events: Record<VoiceEventType, boolean>;
  created_at: string;
  updated_at: string;
}

export interface NotificationEvent {
  id: string;
  restaurant_id: string;
  event_type: VoiceEventType;
  reference_id?: string;
  event_payload: {
    table_id?: string;
    table_number?: string;
    order_id?: string;
    order_number?: string;
    waiter_id?: string;
    waiter_name?: string;
    amount?: number;
    request_type?: string;
    reason?: string;
    timestamp?: string;
    [key: string]: any;
  };
  created_at: string;
}

export interface NotificationDeliveryLog {
  id: string;
  event_id: string;
  recipient_user_id?: string;
  device_id: string;
  delivery_status: 'DELIVERED' | 'ACKNOWLEDGED';
  acknowledged_at?: string;
  created_at: string;
}

export interface PaymentSettings {
  id: string;
  restaurant_id: string;
  upi_id: string;
  merchant_name: string;
  qr_image_url?: string;
  upi_enabled: boolean;
  cash_enabled: boolean;
  manual_verification_enabled: boolean;
  require_transaction_ref: boolean;
  payment_instructions: string;
  upi_display_name: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentVerificationRequest {
  id: string;
  restaurant_id: string;
  payment_id: string;
  order_id: string;
  order_number?: string;
  table_id?: string;
  table_number?: string;
  table_session_id?: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  transaction_reference: string;
  utr_number?: string;
  submitted_amount: number;
  expected_amount?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  verified_by?: string;
  verifier_name?: string;
  rejection_reason?: string;
  customer_notes?: string;
  submitted_at: string;
  created_at?: string;
  verified_at?: string;
}

export interface CustomerOtpCode {
  id: string;
  phone: string;
  otp_code: string;
  expires_at: string;
  is_verified: boolean;
  attempts: number;
  created_at?: string;
}

export interface RewardRedemption {
  id: string;
  restaurant_id: string;
  reward_id: string;
  customer_id: string;
  redemption_code: string;
  redemption_code_hash?: string;
  order_id?: string;
  table_id?: string;
  redeemed_by?: string;
  status: 'CLAIMED' | 'REDEEMED' | 'CANCELLED';
  redeemed_at?: string;
  created_at: string;
}

export interface TableBooking {
  id: string;
  restaurant_id: string;
  customer_id?: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  table_id?: string;
  table_number?: string;
  party_size: number;
  booking_date: string;
  booking_time: string;
  status: 'PENDING' | 'CONFIRMED' | 'SEATED' | 'CANCELLED' | 'NO_SHOW';
  special_requests?: string;
  created_at: string;
  updated_at: string;
}

export interface ServiceRequest {
  id: string;
  restaurant_id: string;
  table_id: string;
  table_number?: string;
  table_session_id: string;
  request_type: 'CALL_WAITER' | 'REQUEST_BILL' | 'WATER' | 'CUTLERY' | 'CLEANING' | 'ASSISTANCE';
  status: 'PENDING' | 'ACKNOWLEDGED' | 'ATTENDING' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  assigned_staff_id?: string;
  assigned_staff_name?: string;
  created_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
}

export interface BillRequest {
  id: string;
  restaurant_id: string;
  table_id: string;
  table_number?: string;
  table_session_id: string;
  total_amount: number;
  payment_method_preference: 'UPI' | 'CASH' | 'CARD';
  status: 'PENDING' | 'PROCESSING' | 'SETTLED' | 'CANCELLED';
  notes?: string;
  requested_at: string;
  settled_at?: string;
}

export interface CustomerSession {
  id: string;
  restaurant_id: string;
  customer_id: string;
  session_token: string;
  device_info?: string;
  ip_address?: string;
  last_active_at: string;
  created_at: string;
}

export interface CustomerVisit {
  id: string;
  restaurant_id: string;
  customer_id: string;
  table_id?: string;
  table_session_id?: string;
  visit_date: string;
  total_spend: number;
  orders_count: number;
  created_at: string;
}

export interface CustomerFeedback {
  id: string;
  restaurant_id: string;
  customer_id?: string;
  customer_name?: string;
  order_id?: string;
  table_id?: string;
  table_number?: string;
  food_rating: number;
  service_rating: number;
  ambience_rating: number;
  comments?: string;
  created_at: string;
}

export interface LoyaltyProgram {
  id: string;
  restaurant_id: string;
  program_name: string;
  description?: string;
  min_order_amount: number;
  stamps_per_order: number;
  stamps_required: number;
  reward_description: string;
  validity_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StaffShift {
  id: string;
  restaurant_id: string;
  staff_id: string;
  staff_name?: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  shift_date: string;
  status: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'ABSENT';
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface StaffAttendance {
  id: string;
  restaurant_id: string;
  staff_id: string;
  staff_name?: string;
  shift_id?: string;
  check_in_time: string;
  check_out_time?: string;
  status: 'ON_TIME' | 'LATE' | 'HALF_DAY';
  notes?: string;
  created_at: string;
  updated_at?: string;
}

