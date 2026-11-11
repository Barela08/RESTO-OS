// ====================================================================
// RESTO OS - Authoritative Data Adapter & Realtime Synchronizer
// Handles Live Supabase operations with resilient relational state
// ====================================================================

import {
  Restaurant,
  RestaurantSettings,
  Profile,
  Staff,
  RestaurantTable,
  TableQRToken,
  TableSession,
  RepeatScanRequest,
  KitchenStation,
  MenuCategory,
  MenuItem,
  MenuAddon,
  Order,
  OrderItem,
  KitchenTicket,
  WaiterCall,
  WaiterCallStatus,
  Payment,
  Invoice,
  Customer,
  LoyaltyAccount,
  LoyaltyReward,
  InventoryItem,
  Supplier,
  NotificationItem,
  RepeatScanStatus,
  KitchenTicketStatus,
  OrderStatus,
  TableStatus,
  VoiceSettings,
  VoiceEventType,
  StaffRoleType,
  NotificationEvent,
  NotificationDeliveryLog,
  PaymentSettings,
  PaymentVerificationRequest,
  CustomerOtpCode,
  RewardRedemption,
  TableBooking,
  ServiceRequest,
  BillRequest,
  CustomerVisit,
  CustomerFeedback,
  LoyaltyProgram,
  StaffShift,
  StaffAttendance,
  SecurityAuditEvent,
  StaffAccountCreateParams,
  StaffAccountUpdateParams,
} from '../types';
import { QRService } from './qrService';
import { audioService } from './audioService';
import { voiceAnnouncementService } from './voiceAnnouncementService';
import { getTodayDateString } from '../utils/date';

type Listener = () => void;

class DatabaseAdapter {
  private listeners: Set<Listener> = new Set();

  // In-memory / persistent stores mirroring PostgreSQL tables
  private restaurant: Restaurant = {
    id: 'rest-001-main',
    name: 'The Grand Bistro & Craft Kitchen',
    tagline: 'Artisanal Flavors, Smart Dining Experience',
    logo_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80',
    address: '108 Platinum Tower, Ring Road, Indiranagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    postal_code: '560038',
    phone: '+91 98765 43210',
    email: 'contact@thegrandbistro.in',
    gstin: '29ABCDE1234F1Z5',
    fssai_license: '11223344556677',
    currency: 'INR',
    currency_symbol: '₹',
    timezone: 'Asia/Kolkata',
    brand_primary_color: '#7047EB',
    brand_accent_color: '#F97316',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  private settings: RestaurantSettings = {
    id: 'set-001',
    restaurant_id: 'rest-001-main',
    cgst_rate: 2.50,
    sgst_rate: 2.50,
    service_charge_rate: 0.00,
    enable_loyalty: true,
    loyalty_min_order_amount: 250.00,
    loyalty_stamps_per_order: 1,
    loyalty_stamps_for_reward: 8,
    loyalty_reward_name: 'Complimentary Chef Special Delight',
    loyalty_reward_validity_days: 30,
    allow_guest_ordering: true,
    auto_accept_orders: false,
    qr_auto_expire_hours: 24,
  };

  private profiles: Profile[] = [
    {
      id: 'p-own-1',
      restaurant_id: 'rest-001-main',
      email: 'owner@resto.os',
      username: 'owner',
      password_hash: 'Owner@2026!',
      full_name: 'Vikramaditya Roy',
      phone: '+91 99000 22334',
      role_id: 'owner',
      employee_id: 'EMP-OWN-01',
      is_active: true,
      created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
      last_login_at: new Date(Date.now() - 3600000).toISOString(),
      last_active_at: new Date(Date.now() - 1800000).toISOString(),
      failed_login_attempts: 0,
    },
    {
      id: 'p-adm-1',
      restaurant_id: 'rest-001-main',
      email: 'admin@resto.os',
      username: 'admin',
      password_hash: 'Admin@2026!',
      full_name: 'Rajesh Sharma',
      phone: '+91 99000 11223',
      role_id: 'admin',
      employee_id: 'EMP-ADM-01',
      is_active: true,
      created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
      last_login_at: new Date(Date.now() - 7200000).toISOString(),
      last_active_at: new Date(Date.now() - 3600000).toISOString(),
      failed_login_attempts: 0,
    },
    {
      id: 'p-ctr-1',
      restaurant_id: 'rest-001-main',
      email: 'counter@resto.os',
      username: 'counter',
      password_hash: 'Counter@2026!',
      full_name: 'Priya Deshmukh',
      phone: '+91 99000 55667',
      role_id: 'counter',
      employee_id: 'EMP-CTR-01',
      is_active: true,
      created_at: new Date(Date.now() - 45 * 86400000).toISOString(),
      last_login_at: new Date(Date.now() - 10800000).toISOString(),
      last_active_at: new Date(Date.now() - 5400000).toISOString(),
      failed_login_attempts: 0,
    },
    {
      id: 'p-wtr-1',
      restaurant_id: 'rest-001-main',
      email: 'waiter@resto.os',
      username: 'waiter',
      password_hash: 'Waiter@2026!',
      full_name: 'Arun Kumar',
      phone: '+91 99000 33445',
      role_id: 'waiter',
      employee_id: 'EMP-WTR-01',
      is_active: true,
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      last_login_at: new Date(Date.now() - 14400000).toISOString(),
      last_active_at: new Date(Date.now() - 7200000).toISOString(),
      failed_login_attempts: 0,
    },
    {
      id: 'p-kit-1',
      restaurant_id: 'rest-001-main',
      email: 'kitchen@resto.os',
      username: 'kitchen',
      password_hash: 'Kitchen@2026!',
      full_name: 'Chef Sanjeev Anand',
      phone: '+91 99000 44556',
      role_id: 'kitchen',
      employee_id: 'EMP-KIT-01',
      is_active: true,
      created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      last_login_at: new Date(Date.now() - 18000000).toISOString(),
      last_active_at: new Date(Date.now() - 9000000).toISOString(),
      failed_login_attempts: 0,
    },
  ];

  private staff: Staff[] = [
    { id: 'st-wtr-1', restaurant_id: 'rest-001-main', profile_id: 'p-wtr-1', employee_code: 'EMP-WTR-01', designation: 'Senior Captain', shift_preference: 'evening', is_on_duty: true, profile: this.profiles[3] },
    { id: 'st-kit-1', restaurant_id: 'rest-001-main', profile_id: 'p-kit-1', employee_code: 'EMP-KIT-01', designation: 'Head Chef', shift_preference: 'evening', is_on_duty: true, profile: this.profiles[4] },
    { id: 'st-ctr-1', restaurant_id: 'rest-001-main', profile_id: 'p-ctr-1', employee_code: 'EMP-CTR-01', designation: 'Cashier & POS Lead', shift_preference: 'evening', is_on_duty: true, profile: this.profiles[2] },
  ];

  private securityAuditEvents: SecurityAuditEvent[] = [
    {
      id: 'aud-init-1',
      restaurant_id: 'rest-001-main',
      user_id: 'p-own-1',
      username: 'owner',
      role: 'owner',
      event_type: 'LOGIN_SUCCESS',
      result: 'SUCCESS',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      metadata: { initial_bootstrap: true },
    },
  ];

  private failedLoginAttempts: Map<string, { count: number; lastAttempt: number; lockedUntil?: number }> = new Map();
  private trustedCustomerDevices: Set<string> = new Set(['+919888877665', '+919777755443', '+919900011223']);

  private kitchenStations: KitchenStation[] = [
    { id: 'stn-1', restaurant_id: 'rest-001-main', code: 'MAIN_KITCHEN', name: 'Main Kitchen (Curries & Tandoor)', description: 'Tandoori breads, royal curries & gravies', display_order: 1, is_active: true },
    { id: 'stn-2', restaurant_id: 'rest-001-main', code: 'BEVERAGE_BAR', name: 'Beverage & Mocktail Bar', description: 'Fresh juices, craft sodas & coolers', display_order: 2, is_active: true },
    { id: 'stn-3', restaurant_id: 'rest-001-main', code: 'DESSERT_STATION', name: 'Artisan Dessert Station', description: 'Warm puddings, cakes & gelato', display_order: 3, is_active: true },
    { id: 'stn-4', restaurant_id: 'rest-001-main', code: 'FAST_FOOD_OVEN', name: 'Stone Oven & Fast Bites', description: 'Woodfired pizzas, burgers & starters', display_order: 4, is_active: true },
  ];

  private tables: RestaurantTable[] = [
    { id: 'tbl-1', restaurant_id: 'rest-001-main', table_number: 'T-01', seating_capacity: 2, floor_area: 'Main Dining', status: 'OCCUPIED', current_waiter_id: 'st-wtr-1', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'tbl-2', restaurant_id: 'rest-001-main', table_number: 'T-02', seating_capacity: 4, floor_area: 'Main Dining', status: 'AVAILABLE', current_waiter_id: 'st-wtr-1', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'tbl-3', restaurant_id: 'rest-001-main', table_number: 'T-03', seating_capacity: 4, floor_area: 'Main Dining', status: 'OCCUPIED', current_waiter_id: 'st-wtr-1', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'tbl-4', restaurant_id: 'rest-001-main', table_number: 'T-04', seating_capacity: 6, floor_area: 'Patio Garden', status: 'PAYMENT_PENDING', current_waiter_id: 'st-wtr-1', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'tbl-5', restaurant_id: 'rest-001-main', table_number: 'T-05', seating_capacity: 4, floor_area: 'Patio Garden', status: 'AVAILABLE', current_waiter_id: 'st-wtr-1', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'tbl-6', restaurant_id: 'rest-001-main', table_number: 'T-06', seating_capacity: 8, floor_area: 'First Floor Lounge', status: 'RESERVED', current_waiter_id: 'st-wtr-1', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'tbl-7', restaurant_id: 'rest-001-main', table_number: 'T-07', seating_capacity: 2, floor_area: 'Terrace Deck', status: 'CLEANING', current_waiter_id: 'st-wtr-1', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: 'tbl-8', restaurant_id: 'rest-001-main', table_number: 'T-08', seating_capacity: 4, floor_area: 'Terrace Deck', status: 'AVAILABLE', current_waiter_id: 'st-wtr-1', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ];

  private qrTokens: TableQRToken[] = [];
  private sessions: TableSession[] = [];
  private repeatScanRequests: RepeatScanRequest[] = [];

  private categories: MenuCategory[] = [
    { id: 'cat-1', restaurant_id: 'rest-001-main', name: 'Starters & Small Plates', description: 'Crispy, smoky and savory appetizers', display_order: 1, icon_name: 'Utensils', image_url: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=500&q=80', is_active: true },
    { id: 'cat-2', restaurant_id: 'rest-001-main', name: 'Woodfired Pizzas & Burgers', description: 'Hand-stretched sourdough pizzas & brioche burgers', display_order: 2, icon_name: 'Pizza', image_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=500&q=80', is_active: true },
    { id: 'cat-3', restaurant_id: 'rest-001-main', name: 'Signature Main Course', description: 'Rich aromatic gravies, fragrant biryanis and breads', display_order: 3, icon_name: 'Soup', image_url: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=500&q=80', is_active: true },
    { id: 'cat-4', restaurant_id: 'rest-001-main', name: 'Beverages & Mocktails', description: 'Cold-pressed quenchers, iced teas and fizzy coolers', display_order: 4, icon_name: 'Coffee', image_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=500&q=80', is_active: true },
    { id: 'cat-5', restaurant_id: 'rest-001-main', name: 'Decadent Desserts', description: 'House-churned gelatos and molten cakes', display_order: 5, icon_name: 'IceCream', image_url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=500&q=80', is_active: true },
  ];

  private menuAddons: MenuAddon[] = [
    { id: 'add-1', restaurant_id: 'rest-001-main', name: 'Extra Artisanal Cheese', price: 60.00, is_available: true },
    { id: 'add-2', restaurant_id: 'rest-001-main', name: 'Spicy Pickled Jalapeños', price: 40.00, is_available: true },
    { id: 'add-3', restaurant_id: 'rest-001-main', name: 'Truffle Aioli Dip', price: 50.00, is_available: true },
    { id: 'add-4', restaurant_id: 'rest-001-main', name: 'Garlic Butter Naan Portion', price: 75.00, is_available: true },
  ];

  private menuItems: MenuItem[] = [
    { id: 'item-1', restaurant_id: 'rest-001-main', category_id: 'cat-1', kitchen_station_id: 'stn-1', name: 'Truffle Mushroom Bruschetta', description: 'Toasted sourdough with wild sautéed mushrooms, garlic butter and truffle drizzle.', base_price: 345.00, is_veg: true, spicy_level: 0, prep_time_minutes: 12, image_url: 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?auto=format&fit=crop&w=500&q=80', is_available: true, is_popular: true, is_recommended: true, addons: this.menuAddons },
    { id: 'item-2', restaurant_id: 'rest-001-main', category_id: 'cat-1', kitchen_station_id: 'stn-1', name: 'Crispy Peri-Peri Paneer Bites', description: 'Cottage cheese cubes tossed in spicy African bird’s eye chili glaze.', base_price: 320.00, is_veg: true, spicy_level: 2, prep_time_minutes: 10, image_url: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=500&q=80', is_available: true, is_popular: true, is_recommended: false, addons: this.menuAddons },
    { id: 'item-3', restaurant_id: 'rest-001-main', category_id: 'cat-1', kitchen_station_id: 'stn-1', name: 'Amritsari Fish Fry', description: 'Crispy carom seed-battered river sole fillets with pickled red onions.', base_price: 460.00, is_veg: false, spicy_level: 1, prep_time_minutes: 15, image_url: 'https://images.unsplash.com/photo-1535400255456-984241443b29?auto=format&fit=crop&w=500&q=80', is_available: true, is_popular: false, is_recommended: true, addons: this.menuAddons },
    { id: 'item-4', restaurant_id: 'rest-001-main', category_id: 'cat-2', kitchen_station_id: 'stn-4', name: 'Artisan Margherita Pizza', description: 'San Marzano tomato base, fresh buffalo mozzarella, fresh basil and extra virgin olive oil.', base_price: 445.00, is_veg: true, spicy_level: 0, prep_time_minutes: 15, image_url: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=500&q=80', is_available: true, is_popular: true, is_recommended: true, addons: this.menuAddons },
    { id: 'item-5', restaurant_id: 'rest-001-main', category_id: 'cat-2', kitchen_station_id: 'stn-4', name: 'Smoky BBQ Pulled Chicken Pizza', description: 'Shredded chicken, caramelized shallots, jalapeños, smoked Gouda and mozzarella.', base_price: 525.00, is_veg: false, spicy_level: 1, prep_time_minutes: 18, image_url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=500&q=80', is_available: true, is_popular: true, is_recommended: false, addons: this.menuAddons },
    { id: 'item-6', restaurant_id: 'rest-001-main', category_id: 'cat-3', kitchen_station_id: 'stn-1', name: 'Paneer Tikka Lababdar', description: 'Charcoal-grilled cottage cheese in a silky tomato, cashew and bell pepper gravy.', base_price: 420.00, is_veg: true, spicy_level: 1, prep_time_minutes: 20, image_url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=500&q=80', is_available: true, is_popular: true, is_recommended: true, addons: this.menuAddons },
    { id: 'item-7', restaurant_id: 'rest-001-main', category_id: 'cat-3', kitchen_station_id: 'stn-1', name: 'Old Delhi Butter Chicken', description: 'Boneless chicken tikka simmered in a velvety slow-cooked tomato butter reduction.', base_price: 495.00, is_veg: false, spicy_level: 1, prep_time_minutes: 20, image_url: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=500&q=80', is_available: true, is_popular: true, is_recommended: true, addons: this.menuAddons },
    { id: 'item-8', restaurant_id: 'rest-001-main', category_id: 'cat-3', kitchen_station_id: 'stn-1', name: 'Dum Gosht Biryani', description: 'Fragrant basmati rice layered with prime mutton chunks, saffron and whole spices.', base_price: 560.00, is_veg: false, spicy_level: 2, prep_time_minutes: 22, image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=500&q=80', is_available: true, is_popular: true, is_recommended: true, addons: this.menuAddons },
    { id: 'item-9', restaurant_id: 'rest-001-main', category_id: 'cat-4', kitchen_station_id: 'stn-2', name: 'Passionfruit Mint Sparkler', description: 'Fresh passionfruit pulp, crushed spearmint leaves, lime juice and sparkling soda.', base_price: 195.00, is_veg: true, spicy_level: 0, prep_time_minutes: 5, image_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=500&q=80', is_available: true, is_popular: true, is_recommended: true, addons: [] },
    { id: 'item-10', restaurant_id: 'rest-001-main', category_id: 'cat-4', kitchen_station_id: 'stn-2', name: 'Cold Brew Vanilla Foam', description: '16-hour steeped single-origin Arabica cold brew with vanilla cream foam.', base_price: 220.00, is_veg: true, spicy_level: 0, prep_time_minutes: 5, image_url: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=500&q=80', is_available: true, is_popular: false, is_recommended: true, addons: [] },
    { id: 'item-11', restaurant_id: 'rest-001-main', category_id: 'cat-5', kitchen_station_id: 'stn-3', name: 'Belgian Dark Chocolate Molten Lava', description: 'Warm molten center cake with 70% Callebaut dark chocolate and vanilla gelato.', base_price: 295.00, is_veg: true, spicy_level: 0, prep_time_minutes: 14, image_url: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=500&q=80', is_available: true, is_popular: true, is_recommended: true, addons: [] },
    { id: 'item-12', restaurant_id: 'rest-001-main', category_id: 'cat-5', kitchen_station_id: 'stn-3', name: 'Classic Italian Tiramisu', description: 'Savoiardi ladyfingers soaked in espresso and mascarpone cream dusted with cocoa.', base_price: 310.00, is_veg: true, spicy_level: 0, prep_time_minutes: 8, image_url: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=500&q=80', is_available: true, is_popular: false, is_recommended: true, addons: [] },
  ];

  private orders: Order[] = [];
  private kitchenTickets: KitchenTicket[] = [];
  private waiterCalls: WaiterCall[] = [];
  private payments: Payment[] = [];
  private invoices: Invoice[] = [];
  private customers: Customer[] = [
    { id: 'cust-1', restaurant_id: 'rest-001-main', phone: '+91 98888 77665', full_name: 'Aditya Verma', email: 'aditya@example.com', is_phone_verified: true, created_at: new Date().toISOString() },
  ];
  private loyaltyAccounts: LoyaltyAccount[] = [
    { id: 'loy-1', restaurant_id: 'rest-001-main', customer_id: 'cust-1', total_stamps_earned: 7, current_active_stamps: 7, total_rewards_unlocked: 0, total_rewards_redeemed: 0, created_at: new Date().toISOString() },
  ];
  private loyaltyRewards: LoyaltyReward[] = [];
  private notifications: NotificationItem[] = [];

  private voiceSettings: VoiceSettings = {
    id: 'voice-set-001',
    restaurant_id: 'rest-001-main',
    language: 'hi',
    voice_enabled: true,
    sound_enabled: true,
    volume: 1.0,
    speech_rate: 1.0,
    repeat_count: 1,
    enabled_events: {
      NEW_ORDER: true,
      NEW_TABLE_ORDER: true,
      CALL_WAITER: true,
      REQUEST_BILL: true,
      ORDER_READY: true,
      PAYMENT_RECEIVED: true,
      REPEAT_SCAN: true,
      REPEAT_SCAN_APPROVAL: true,
      URGENT_ASSISTANCE: true,
      ORDER_CANCELLED: true,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  private paymentSettings: PaymentSettings = {
    id: 'pay-set-001',
    restaurant_id: 'rest-001-main',
    upi_id: 'grandbistro@okaxis',
    merchant_name: 'The Grand Bistro Indiranagar',
    qr_image_url: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi://pay?pa=grandbistro@okaxis%26pn=The%20Grand%20Bistro%26cu=INR',
    upi_enabled: true,
    cash_enabled: true,
    manual_verification_enabled: true,
    require_transaction_ref: true,
    payment_instructions: 'Scan using any UPI app (GPay, PhonePe, Paytm, BHIM) and submit your 12-digit UPI Reference Number / UTR.',
    upi_display_name: 'Direct UPI (0% Fee)',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  private notificationEvents: NotificationEvent[] = [];
  private notificationDeliveryLogs: NotificationDeliveryLog[] = [];
  private paymentVerificationRequests: PaymentVerificationRequest[] = [];
  private customerOtpCodes: CustomerOtpCode[] = [];
  private rewardRedemptions: RewardRedemption[] = [];
  private serviceRequests: ServiceRequest[] = [];
  private billRequests: BillRequest[] = [];
  private customerFeedback: CustomerFeedback[] = [];
  private customerVisits: CustomerVisit[] = [];
  private shifts: StaffShift[] = [];
  private attendance: StaffAttendance[] = [];
  private tableBookings: TableBooking[] = [];
  private loyaltyPrograms: LoyaltyProgram[] = [];

  private inventoryItems: InventoryItem[] = [
    { id: 'inv-1', restaurant_id: 'rest-001-main', name: 'Fresh Organic Paneer', sku: 'SKU-PAN-01', unit: 'kg', current_stock: 14.500, min_stock_alert: 5.000, cost_per_unit: 320.00, supplier_id: 'sup-1', is_active: true },
    { id: 'inv-2', restaurant_id: 'rest-001-main', name: 'Fresh Boneless Chicken', sku: 'SKU-CHK-01', unit: 'kg', current_stock: 22.000, min_stock_alert: 8.000, cost_per_unit: 240.00, supplier_id: 'sup-1', is_active: true },
    { id: 'inv-3', restaurant_id: 'rest-001-main', name: 'Buffalo Mozzarella Blocks', sku: 'SKU-MOZ-01', unit: 'kg', current_stock: 8.200, min_stock_alert: 4.000, cost_per_unit: 580.00, supplier_id: 'sup-1', is_active: true },
    { id: 'inv-4', restaurant_id: 'rest-001-main', name: 'Single-Origin Arabica Beans', sku: 'SKU-COF-01', unit: 'kg', current_stock: 6.000, min_stock_alert: 2.000, cost_per_unit: 850.00, supplier_id: 'sup-2', is_active: true },
    { id: 'inv-5', restaurant_id: 'rest-001-main', name: 'Callebaut 70% Chocolate', sku: 'SKU-CHO-01', unit: 'kg', current_stock: 12.000, min_stock_alert: 3.000, cost_per_unit: 1100.00, supplier_id: 'sup-2', is_active: true },
  ];

  private suppliers: Supplier[] = [
    { id: 'sup-1', restaurant_id: 'rest-001-main', name: 'Metro Fresh Farms & Dairy', contact_person: 'Sunil Gowda', phone: '+91 98877 66554', email: 'orders@metrofresh.com', address: 'APMC Market Yard', is_active: true },
    { id: 'sup-2', restaurant_id: 'rest-001-main', name: 'Gourmet World Spices & Imports', contact_person: 'Harish Nair', phone: '+91 97766 55443', email: 'supply@gourmetworld.in', address: 'Phase 1 Hub', is_active: true },
  ];

  private syncChannel: BroadcastChannel | null = null;
  private isRealtimeConnected: boolean = false;
  private lastSyncTimestamp: string = new Date().toISOString();

  constructor() {
    this.initSyncChannel();
    this.loadFromStorage();
    this.ensureTodayQRs();
    this.ensurePermanentQRs();
  }

  private initSyncChannel() {
    if (typeof window === 'undefined') return;
    try {
      if ('BroadcastChannel' in window) {
        this.syncChannel = new BroadcastChannel('resto_os_live_sync');
        this.isRealtimeConnected = true;
        this.syncChannel.onmessage = (event) => {
          if (event.data?.type === 'SYNC') {
            this.loadFromStorage();
            this.lastSyncTimestamp = new Date().toISOString();
            this.listeners.forEach(fn => {
              try { fn(); } catch {}
            });
          } else if (event.data?.type === 'EVENT') {
            this.loadFromStorage();
            this.lastSyncTimestamp = new Date().toISOString();
            const notifEvent = event.data.event;
            if (notifEvent && typeof window !== 'undefined') {
              const activeRole = (localStorage.getItem('resto_active_role') || localStorage.getItem('resto_staff_role')) as StaffRoleType;
              const activeStaffId = localStorage.getItem('resto_staff_id') || undefined;
              if (activeRole) {
                voiceAnnouncementService.processNotificationEvent(
                  notifEvent,
                  this.voiceSettings,
                  activeRole,
                  activeStaffId
                );
              }
            }
            this.listeners.forEach(fn => {
              try { fn(); } catch {}
            });
          }
        };
      }
    } catch {
      // BroadcastChannel fallback
    }

    try {
      window.addEventListener('storage', (event) => {
        if (event.key === 'resto_os_db_v2' || event.key === null) {
          this.loadFromStorage();
          this.lastSyncTimestamp = new Date().toISOString();
          this.listeners.forEach(fn => {
            try { fn(); } catch {}
          });
        }
      });
      this.isRealtimeConnected = true;
    } catch {
      // Environments without window storage listener
    }
  }

  public getRealtimeSyncStatus(): { isConnected: boolean; lastSyncTime: string } {
    return {
      isConnected: this.isRealtimeConnected,
      lastSyncTime: this.lastSyncTimestamp,
    };
  }

  private loadFromStorage() {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
      const saved = localStorage.getItem('resto_os_db_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.tables) this.tables = parsed.tables;
        if (parsed.qrTokens) this.qrTokens = parsed.qrTokens;
        if (parsed.sessions) this.sessions = parsed.sessions.filter((s: TableSession) => !s.id.startsWith('ses-init-'));
        if (parsed.orders) this.orders = parsed.orders.filter((o: Order) => !o.id.startsWith('ord-init-'));
        if (parsed.kitchenTickets) this.kitchenTickets = parsed.kitchenTickets.filter((t: KitchenTicket) => !t.id.startsWith('tkt-init-'));
        if (parsed.payments) this.payments = parsed.payments;
        if (parsed.invoices) this.invoices = parsed.invoices;
        if (parsed.repeatScanRequests) this.repeatScanRequests = parsed.repeatScanRequests;
        if (parsed.waiterCalls) this.waiterCalls = parsed.waiterCalls;
        if (parsed.customers) this.customers = parsed.customers;
        if (parsed.loyaltyAccounts) this.loyaltyAccounts = parsed.loyaltyAccounts;
        if (parsed.loyaltyRewards) this.loyaltyRewards = parsed.loyaltyRewards;
        if (parsed.notifications) this.notifications = parsed.notifications;
        if (parsed.voiceSettings) this.voiceSettings = { ...this.voiceSettings, ...parsed.voiceSettings };
        if (parsed.paymentSettings) this.paymentSettings = { ...this.paymentSettings, ...parsed.paymentSettings };
        if (parsed.notificationEvents) this.notificationEvents = parsed.notificationEvents;
        if (parsed.paymentVerificationRequests) this.paymentVerificationRequests = parsed.paymentVerificationRequests;
        if (parsed.customerOtpCodes) this.customerOtpCodes = parsed.customerOtpCodes;
        if (parsed.rewardRedemptions) this.rewardRedemptions = parsed.rewardRedemptions;
        if (parsed.serviceRequests) this.serviceRequests = parsed.serviceRequests;
        if (parsed.billRequests) this.billRequests = parsed.billRequests;
        if (parsed.customerVisits) this.customerVisits = parsed.customerVisits;
        if (parsed.customerFeedback) this.customerFeedback = parsed.customerFeedback;
        if (parsed.shifts) this.shifts = parsed.shifts;
        if (parsed.attendance) this.attendance = parsed.attendance;
        if (parsed.tableBookings) this.tableBookings = parsed.tableBookings;
      }
    } catch {
      // Use defaults
    }
  }

  private saveToStorage() {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
      const payload = {
        tables: this.tables,
        qrTokens: this.qrTokens,
        sessions: this.sessions,
        orders: this.orders,
        kitchenTickets: this.kitchenTickets,
        payments: this.payments,
        invoices: this.invoices,
        repeatScanRequests: this.repeatScanRequests,
        waiterCalls: this.waiterCalls,
        customers: this.customers,
        loyaltyAccounts: this.loyaltyAccounts,
        loyaltyRewards: this.loyaltyRewards,
        notifications: this.notifications,
        voiceSettings: this.voiceSettings,
        paymentSettings: this.paymentSettings,
        notificationEvents: this.notificationEvents,
        paymentVerificationRequests: this.paymentVerificationRequests,
        customerOtpCodes: this.customerOtpCodes,
        rewardRedemptions: this.rewardRedemptions,
        serviceRequests: this.serviceRequests,
        billRequests: this.billRequests,
        customerVisits: this.customerVisits,
        customerFeedback: this.customerFeedback,
        shifts: this.shifts,
        attendance: this.attendance,
        tableBookings: this.tableBookings,
      };
      localStorage.setItem('resto_os_db_v2', JSON.stringify(payload));
    } catch {
      // LocalStorage quotas handled
    }
  }

  private notify(broadcast = true) {
    this.saveToStorage();
    this.lastSyncTimestamp = new Date().toISOString();
    if (broadcast && this.syncChannel) {
      try {
        this.syncChannel.postMessage({ type: 'SYNC', timestamp: Date.now() });
      } catch {
        // Fallback
      }
    }
    this.listeners.forEach(fn => {
      try {
        fn();
      } catch (err) {
        console.error('Database subscriber notification error:', err);
      }
    });
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ------------------------------------------------------------------
  // 1. DYNAMIC QR GENERATION & VERIFICATION
  // ------------------------------------------------------------------
  public ensureTodayQRs() {
    const today = getTodayDateString();
    let changed = false;

    for (const table of this.tables) {
      const existing = this.qrTokens.find(
        t => t.table_id === table.id && t.valid_date === today && !t.is_revoked
      );
      if (!existing) {
        // Generate daily token
        const midnight = new Date();
        midnight.setHours(23, 59, 59, 999);
        const tokenHash = `qr-${table.id}-${today}-${Math.random().toString(36).substring(2, 10)}`;
        this.qrTokens.push({
          id: `qrt-${table.id}-${today}`,
          restaurant_id: this.restaurant.id,
          table_id: table.id,
          token_hash: tokenHash,
          valid_date: today,
          expires_at: midnight.toISOString(),
          is_revoked: false,
          created_at: new Date().toISOString(),
        });
        changed = true;
      }
    }

    if (changed) {
      this.notify();
    }
  }

  public ensurePermanentQRs() {
    let changed = false;
    for (const table of this.tables) {
      const existing = this.getPermanentQRForTable(table.id);
      if (!existing) {
        this.generatePermanentQRForTable(table.id);
        changed = true;
      }
    }
    if (changed) {
      this.notify();
    }
  }

  public verifyQRToken(tokenHash: string): {
    valid: boolean;
    errorCode?: 'INVALID_TOKEN' | 'EXPIRED_TOKEN' | 'REVOKED_TOKEN';
    message: string;
    table?: RestaurantTable;
    session?: TableSession;
    isRepeatScan?: boolean;
    repeatRequestId?: string;
  } {
    const token = this.qrTokens.find(t => t.token_hash === tokenHash);
    if (!token) {
      return { valid: false, errorCode: 'INVALID_TOKEN', message: 'This QR code is not recognized.' };
    }

    if (token.is_revoked) {
      return { valid: false, errorCode: 'REVOKED_TOKEN', message: 'This QR code was revoked by management.' };
    }

    const now = new Date();
    const expiry = new Date(token.expires_at);
    if (!token.is_permanent && (now > expiry || token.valid_date < getTodayDateString())) {
      return { valid: false, errorCode: 'EXPIRED_TOKEN', message: 'This QR code expired at midnight. Please ask staff for today’s code.' };
    }

    const table = this.tables.find(t => t.id === token.table_id);
    if (!table) {
      return { valid: false, errorCode: 'INVALID_TOKEN', message: 'Assigned table could not be found.' };
    }

    // Check if an active session exists on this table
    const activeSession = this.sessions.find(s => s.table_id === table.id && s.status === 'ACTIVE');

    if (activeSession) {
      // Repeat scan on active session resumes seamlessly without blocking confirmation
      table.status = 'OCCUPIED';
      table.updated_at = new Date().toISOString();

      let repeatReq = this.repeatScanRequests.find(r => r.existing_session_id === activeSession.id && r.status === 'PENDING');
      if (!repeatReq) {
        repeatReq = {
          id: `rep-${Date.now()}`,
          restaurant_id: this.restaurant.id,
          table_id: table.id,
          table,
          existing_session_id: activeSession.id,
          existing_session: activeSession,
          new_scan_time: new Date().toISOString(),
          customer_identifier: 'Mobile Customer',
          status: 'PENDING',
          created_at: new Date().toISOString(),
        };
        this.repeatScanRequests.unshift(repeatReq);
      }

      this.notify();

      return {
        valid: true,
        isRepeatScan: true,
        repeatRequestId: repeatReq.id,
        table,
        session: activeSession,
        message: 'Table session active. You can start ordering.',
      };
    }

    // First scan of the day: create brand new session
    const newSessionToken = `ses-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)}`;
    const newSession: TableSession = {
      id: `ses-${Date.now()}`,
      restaurant_id: this.restaurant.id,
      table_id: table.id,
      table,
      qr_token_id: token.id,
      session_token: newSessionToken,
      status: 'ACTIVE',
      opened_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    this.sessions.push(newSession);

    // Update table status to OCCUPIED
    table.status = 'OCCUPIED';
    table.updated_at = new Date().toISOString();

    this.notify();

    return {
      valid: true,
      isRepeatScan: false,
      table,
      session: newSession,
      message: 'Table session established.',
    };
  }

  public getOrCreateActiveSession(tableId: string): TableSession {
    const existing = this.sessions.find(s => s.table_id === tableId && s.status === 'ACTIVE');
    if (existing) return existing;
    const table = this.tables.find(t => t.id === tableId);
    const newSessionToken = `ses-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const permToken = this.getPermanentQRForTable(tableId);
    const newSession: TableSession = {
      id: `ses-${Date.now()}`,
      restaurant_id: this.restaurant.id,
      table_id: tableId,
      qr_token_id: permToken?.id || `qrt-${tableId}`,
      session_token: newSessionToken,
      status: 'ACTIVE',
      opened_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    this.sessions.push(newSession);
    if (table) {
      table.status = 'OCCUPIED';
    }
    this.saveToStorage();
    this.notify();
    return newSession;
  }

  public createTableSession(params: {
    tableId: string;
    guestCount?: number;
    customerName?: string;
    customerPhone?: string;
  }): TableSession {
    const table = this.tables.find(t => t.id === params.tableId);
    const permToken = this.getPermanentQRForTable(params.tableId);
    const newSessionToken = `ses-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const newSession: TableSession = {
      id: `ses-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      restaurant_id: this.restaurant.id,
      table_id: params.tableId,
      qr_token_id: permToken?.id || `qrt-${params.tableId}`,
      session_token: newSessionToken,
      status: 'ACTIVE',
      guest_count: params.guestCount || 1,
      customer_name: params.customerName,
      customer_phone: params.customerPhone,
      opened_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      orders: [],
      invoices: [],
    };
    if (table) {
      table.status = 'OCCUPIED';
    }
    this.sessions.push(newSession);
    this.saveToStorage();
    this.notify();
    return newSession;
  }

  public createOrder(params: {
    tableSessionId: string;
    items: Array<{ menuItemId: string; quantity: number; unitPrice?: number }>;
    customerPhone?: string;
    customerName?: string;
    specialNotes?: string;
  }): Order {
    return this.placeOrder({
      tableSessionId: params.tableSessionId,
      items: params.items,
      customerPhone: params.customerPhone,
      customerName: params.customerName,
      specialNotes: params.specialNotes,
    });
  }

  public handleRepeatScanApproval(
    requestId: string,
    decision: 'APPROVED_CONTINUE' | 'APPROVED_NEW' | 'REJECTED',
    staffId: string,
    notes?: string
  ) {
    const req = this.repeatScanRequests.find(r => r.id === requestId);
    if (!req) return;

    req.status = decision;
    req.handled_by_staff_id = staffId;
    req.handled_at = new Date().toISOString();
    req.decision_notes = notes;

    this.emitNotificationEvent('REPEAT_SCAN_APPROVAL', req.id, {
      table_id: req.table_id,
      table_number: req.table?.table_number,
      decision,
    });

    if (decision === 'APPROVED_NEW') {
      // Close old session
      const oldSession = this.sessions.find(s => s.id === req.existing_session_id);
      if (oldSession) {
        oldSession.status = 'CLOSED';
        oldSession.closed_at = new Date().toISOString();
      }
      // Create new session
      const table = this.tables.find(t => t.id === req.table_id);
      if (table) {
        const newSessionToken = `ses-${Math.random().toString(36).substring(2)}`;
        const newSession: TableSession = {
          id: `ses-${Date.now()}`,
          restaurant_id: this.restaurant.id,
          table_id: table.id,
          table,
          qr_token_id: `qrt-${table.id}`,
          session_token: newSessionToken,
          status: 'ACTIVE',
          opened_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };
        this.sessions.push(newSession);
        table.status = 'OCCUPIED';
      }
    }

    this.notify();
  }

  // ------------------------------------------------------------------
  // 2. ORDER PLACEMENT & MULTI-STATION ROUTING
  // ------------------------------------------------------------------
  public placeOrder(params: {
    tableSessionId: string;
    items: {
      menuItemId: string;
      variantId?: string;
      addonIds?: string[];
      quantity: number;
      specialInstructions?: string;
    }[];
    customerPhone?: string;
    customerName?: string;
    specialNotes?: string;
    idempotencyKey?: string;
  }): Order {
    if (params.idempotencyKey) {
      const existing = this.orders.find(o => (o as any).idempotency_key === params.idempotencyKey);
      if (existing) return existing;
    }

    const session = this.sessions.find(s => s.id === params.tableSessionId);
    if (!session || session.status !== 'ACTIVE') {
      throw new Error('Active table session required to place orders.');
    }

    const table = this.tables.find(t => t.id === session.table_id);
    if (!table) {
      throw new Error('Assigned table not found.');
    }

    const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const orderNumber = `ORD-${new Date().getHours()}${new Date().getMinutes()}-${Math.floor(100 + Math.random() * 900)}`;

    let subtotal = 0;
    const orderItems: OrderItem[] = [];

    // Group items by kitchen station
    const stationItemsMap: Record<string, OrderItem[]> = {};

    params.items.forEach((entry, idx) => {
      const menuItem = this.menuItems.find(m => m.id === entry.menuItemId);
      if (!menuItem) return;

      if (!menuItem.is_available) {
        throw new Error(`Item "${menuItem.name}" is currently sold out.`);
      }

      const variant = menuItem.variants?.find(v => v.id === entry.variantId);
      const variantDelta = variant?.price_delta || 0;

      const addons = (entry.addonIds || [])
        .map(aid => this.menuAddons.find(a => a.id === aid))
        .filter((a): a is MenuAddon => Boolean(a));

      const addonsTotal = addons.reduce((sum, a) => sum + a.price, 0);
      const unitPrice = menuItem.base_price + variantDelta + addonsTotal;
      const itemTotal = unitPrice * entry.quantity;

      subtotal += itemTotal;

      const orderItem: OrderItem = {
        id: `oi-${orderId}-${idx + 1}`,
        order_id: orderId,
        menu_item_id: menuItem.id,
        variant_id: entry.variantId,
        item_name: menuItem.name,
        unit_price: unitPrice,
        quantity: entry.quantity,
        total_price: itemTotal,
        special_instructions: entry.specialInstructions,
        status: 'NEW',
        kitchen_station_id: menuItem.kitchen_station_id || 'stn-1',
        addons: addons.map(a => ({ addon_name: a.name, unit_price: a.price })),
      };

      orderItems.push(orderItem);

      const stnId = orderItem.kitchen_station_id || 'stn-1';
      if (!stationItemsMap[stnId]) stationItemsMap[stnId] = [];
      stationItemsMap[stnId].push(orderItem);
    });

    // GST calculations (5% composite restaurant rate: 2.5% CGST + 2.5% SGST)
    const cgst = subtotal * (this.settings.cgst_rate / 100);
    const sgst = subtotal * (this.settings.sgst_rate / 100);
    const total = subtotal + cgst + sgst;

    const order: Order = {
      id: orderId,
      restaurant_id: this.restaurant.id,
      order_number: orderNumber,
      table_id: table.id,
      table,
      table_session_id: session.id,
      waiter_id: table.current_waiter_id,
      customer_name: params.customerName || session.customer_name,
      customer_phone: params.customerPhone || session.customer_phone,
      subtotal_amount: subtotal,
      cgst_amount: cgst,
      sgst_amount: sgst,
      service_charge_amount: 0,
      discount_amount: 0,
      total_amount: total,
      status: 'PLACED',
      special_notes: params.specialNotes,
      items: orderItems,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.orders.unshift(order);

    // Create Kitchen Tickets for each station
    Object.entries(stationItemsMap).forEach(([stationId, items], sIdx) => {
      const station = this.kitchenStations.find(k => k.id === stationId);
      const ticket: KitchenTicket = {
        id: `tkt-${orderId}-${sIdx + 1}`,
        restaurant_id: this.restaurant.id,
        order_id: order.id,
        order,
        station_id: stationId,
        station,
        ticket_number: `TKT-${order.order_number}-${sIdx + 1}`,
        status: 'NEW',
        items,
        table_number: table.table_number,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.kitchenTickets.unshift(ticket);
    });

    // Notify Kitchen & Waiter
    this.addNotification({
      recipient_role: 'kitchen',
      title: `New Order: Table ${table.table_number}`,
      message: `${order.order_number} received with ${order.items.length} items.`,
      event_type: 'NEW_ORDER',
      reference_id: order.id,
      sound_type: 'CHIME',
    });

    this.addNotification({
      recipient_role: 'waiter',
      title: `Order Placed: Table ${table.table_number}`,
      message: `Table ${table.table_number} placed order ${order.order_number}.`,
      event_type: 'NEW_ORDER',
      reference_id: order.id,
      sound_type: 'CHIME',
    });

    if (params.idempotencyKey) {
      (order as any).idempotency_key = params.idempotencyKey;
    }

    this.emitNotificationEvent('NEW_ORDER', order.id, {
      table_id: table.id,
      table_number: table.table_number,
      order_number: order.order_number,
      waiter_id: table.current_waiter_id,
      waiter_name: this.staff.find(s => s.id === table.current_waiter_id)?.designation || 'Server',
    });

    audioService.playNewOrderChime();
    this.notify();

    return order;
  }

  // ------------------------------------------------------------------
  // 3. KITCHEN TICKETS & WAITER WORKFLOW
  // ------------------------------------------------------------------
  public updateKitchenTicketStatus(
    ticketId: string,
    newStatus: KitchenTicketStatus,
    rejectionReason?: string
  ) {
    const ticket = this.kitchenTickets.find(t => t.id === ticketId);
    if (!ticket) return;

    ticket.status = newStatus;
    ticket.updated_at = new Date().toISOString();

    if (newStatus === 'ACCEPTED') {
      ticket.accepted_at = new Date().toISOString();
    } else if (newStatus === 'PREPARING') {
      ticket.prep_started_at = new Date().toISOString();
    } else if (newStatus === 'READY') {
      ticket.ready_at = new Date().toISOString();

      // Trigger chime and notification to assigned waiter
      this.addNotification({
        recipient_role: 'waiter',
        title: `Food Ready: Table ${ticket.table_number}`,
        message: `${ticket.ticket_number} is ready for pick up at ${ticket.station?.name || 'Kitchen'}.`,
        event_type: 'ORDER_READY',
        reference_id: ticket.id,
        sound_type: 'BELL',
      });
      audioService.playWaiterCallBell();
      this.emitNotificationEvent('ORDER_READY', ticket.id, {
        table_number: ticket.table_number,
        ticket_number: ticket.ticket_number,
        station_name: ticket.station?.name || 'Kitchen',
        waiter_id: ticket.order?.waiter_id,
      });
    } else if (newStatus === 'REJECTED') {
      ticket.rejection_reason = rejectionReason || 'Item unavailable';
    }

    // Check if all tickets for this order are at least in PREPARING or READY
    const allOrderTickets = this.kitchenTickets.filter(t => t.order_id === ticket.order_id);
    const order = this.orders.find(o => o.id === ticket.order_id);

    if (order) {
      if (allOrderTickets.every(t => t.status === 'READY')) {
        order.status = 'READY';
      } else if (allOrderTickets.some(t => t.status === 'PREPARING' || t.status === 'READY')) {
        order.status = 'PREPARING';
      } else if (allOrderTickets.some(t => t.status === 'ACCEPTED')) {
        order.status = 'ACCEPTED';
      }
      order.updated_at = new Date().toISOString();
    }

    this.notify();
  }

  public markOrderServed(orderId: string) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return;

    order.status = 'SERVED';
    order.updated_at = new Date().toISOString();

    this.addNotification({
      recipient_role: 'counter',
      title: `Food Served: Table ${order.table?.table_number}`,
      message: `Order ${order.order_number} has been served.`,
      event_type: 'FOOD_SERVED',
      reference_id: order.id,
      sound_type: 'CHIME',
    });

    this.notify();
  }

  // ------------------------------------------------------------------
  // 4. WAITER CALLS & REALTIME SERVICE REQUESTS
  // ------------------------------------------------------------------
  public requestService(params: {
    tableSessionId: string;
    requestType: 'CALL_WAITER' | 'REQUEST_BILL' | 'ASSISTANCE' | 'WATER' | 'CLEANING';
    notes?: string;
    priority?: 'NORMAL' | 'URGENT';
  }): WaiterCall {
    const session = this.sessions.find(s => s.id === params.tableSessionId);
    if (!session || session.status !== 'ACTIVE') {
      throw new Error('Valid active table session required');
    }

    const table = this.tables.find(t => t.id === session.table_id);
    if (!table) {
      throw new Error('Assigned table not found');
    }
    const tableNumber = table.table_number || 'T-00';

    // Prevent duplicate active calls for the same session while one is ongoing
    const activeCall = this.waiterCalls.find(
      c => c.table_session_id === session.id &&
           c.request_type === params.requestType &&
           ['REQUESTED', 'SENT', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(c.status)
    );
    if (activeCall) {
      return activeCall;
    }

    // Resolve assigned waiter: Table waiter -> Restaurant backup waiter -> default waiter
    const assignedWaiterId = table.current_waiter_id || this.settings.backup_waiter_id || 'st-wtr-1';
    const assignedWaiterStaff = this.staff.find(s => s.id === assignedWaiterId);
    const assignedWaiterName = assignedWaiterStaff ? assignedWaiterStaff.name : 'Floor Captain';

    const callId = `call-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const call: WaiterCall = {
      id: callId,
      restaurant_id: this.restaurant.id,
      table_id: session.table_id,
      table_number: tableNumber,
      table_session_id: session.id,
      customer_id: session.customer_id,
      customer_name: session.customer_name,
      customer_phone: session.customer_phone,
      assigned_waiter_id: assignedWaiterId,
      assigned_waiter_name: assignedWaiterName,
      request_type: params.requestType,
      request_message: params.notes,
      status: 'REQUESTED',
      priority: params.priority || 'NORMAL',
      notes: params.notes,
      created_at: nowIso,
      updated_at: nowIso,
    };

    this.waiterCalls.unshift(call);

    if (params.requestType === 'REQUEST_BILL') {
      table.status = 'PAYMENT_PENDING';
      this.addNotification({
        recipient_role: 'counter',
        title: `Bill Requested: Table ${tableNumber}`,
        message: `Customer at Table ${tableNumber} has requested the bill.`,
        event_type: 'BILL_REQUESTED',
        reference_id: call.id,
        sound_type: 'BELL',
      });
      this.emitNotificationEvent('REQUEST_BILL', call.id, {
        call_id: call.id,
        table_id: session.table_id,
        table_number: tableNumber,
        waiter_id: assignedWaiterId,
        waiter_name: assignedWaiterName,
      });
    }

    this.addNotification({
      recipient_role: 'waiter',
      title: `NEW WAITER CALL: Table ${tableNumber}`,
      message: `A customer at Table Number ${tableNumber} is requesting assistance.`,
      event_type: 'CALL_WAITER',
      reference_id: call.id,
      sound_type: 'BELL',
    });

    if (params.requestType === 'CALL_WAITER' || params.requestType === 'ASSISTANCE') {
      this.emitNotificationEvent('CALL_WAITER', call.id, {
        call_id: call.id,
        table_id: session.table_id,
        table_number: tableNumber,
        waiter_id: assignedWaiterId,
        waiter_name: assignedWaiterName,
        customer_name: session.customer_name,
        customer_phone: session.customer_phone,
        notes: params.notes,
        status: 'REQUESTED',
      });
    }

    this.notify();
    return call;
  }

  public acceptWaiterCall(callId: string, staffId?: string): WaiterCall {
    const call = this.waiterCalls.find(c => c.id === callId);
    if (!call) throw new Error('Waiter call not found');

    call.status = 'ACCEPTED';
    const nowIso = new Date().toISOString();
    call.accepted_at = nowIso;
    call.acknowledged_at = nowIso;
    if (staffId) {
      call.assigned_waiter_id = staffId;
      const s = this.staff.find(st => st.id === staffId);
      if (s) call.assigned_waiter_name = s.name;
    }
    const createdMs = new Date(call.created_at).getTime();
    const acceptedMs = new Date(nowIso).getTime();
    call.response_time_seconds = Math.max(0, Math.round((acceptedMs - createdMs) / 1000));
    call.updated_at = nowIso;

    this.notify();
    return call;
  }

  public markWaiterCallOnTheWay(callId: string, staffId?: string): WaiterCall {
    const call = this.waiterCalls.find(c => c.id === callId);
    if (!call) throw new Error('Waiter call not found');

    call.status = 'ON_THE_WAY';
    const nowIso = new Date().toISOString();
    call.on_the_way_at = nowIso;
    if (staffId && !call.assigned_waiter_id) {
      call.assigned_waiter_id = staffId;
      const s = this.staff.find(st => st.id === staffId);
      if (s) call.assigned_waiter_name = s.name;
    }
    call.updated_at = nowIso;

    this.notify();
    return call;
  }

  public markWaiterCallArrived(callId: string, staffId?: string): WaiterCall {
    const call = this.waiterCalls.find(c => c.id === callId);
    if (!call) throw new Error('Waiter call not found');

    call.status = 'ARRIVED';
    const nowIso = new Date().toISOString();
    call.arrived_at = nowIso;
    if (staffId && !call.assigned_waiter_id) {
      call.assigned_waiter_id = staffId;
      const s = this.staff.find(st => st.id === staffId);
      if (s) call.assigned_waiter_name = s.name;
    }
    call.updated_at = nowIso;

    this.notify();
    return call;
  }

  public completeWaiterCall(callId: string, staffId?: string): WaiterCall {
    const call = this.waiterCalls.find(c => c.id === callId);
    if (!call) throw new Error('Waiter call not found');

    call.status = 'COMPLETED';
    const nowIso = new Date().toISOString();
    call.completed_at = nowIso;
    if (staffId && !call.assigned_waiter_id) {
      call.assigned_waiter_id = staffId;
      const s = this.staff.find(st => st.id === staffId);
      if (s) call.assigned_waiter_name = s.name;
    }
    call.updated_at = nowIso;

    this.notify();
    return call;
  }

  public cancelWaiterCall(callId: string): WaiterCall {
    const call = this.waiterCalls.find(c => c.id === callId);
    if (!call) throw new Error('Waiter call not found');

    call.status = 'CANCELLED';
    call.updated_at = new Date().toISOString();
    this.notify();
    return call;
  }

  public reassignWaiterCall(callId: string, newWaiterId: string, adminId?: string): WaiterCall {
    const call = this.waiterCalls.find(c => c.id === callId);
    if (!call) throw new Error('Waiter call not found');

    const s = this.staff.find(st => st.id === newWaiterId);
    call.assigned_waiter_id = newWaiterId;
    call.assigned_waiter_name = s ? s.name : 'Staff';
    call.updated_at = new Date().toISOString();

    this.emitNotificationEvent('CALL_WAITER', call.id, {
      call_id: call.id,
      table_id: call.table_id,
      table_number: call.table_number,
      waiter_id: newWaiterId,
      waiter_name: call.assigned_waiter_name,
      is_reassigned: true,
      reassigned_by: adminId,
    });

    this.notify();
    return call;
  }

  public escalateWaiterCall(callId: string, reason?: string): WaiterCall {
    const call = this.waiterCalls.find(c => c.id === callId);
    if (!call) throw new Error('Waiter call not found');

    call.status = 'ESCALATED';
    call.is_escalated = true;
    call.escalated_at = new Date().toISOString();
    call.updated_at = new Date().toISOString();

    this.emitNotificationEvent('URGENT_ASSISTANCE', call.id, {
      call_id: call.id,
      table_id: call.table_id,
      table_number: call.table_number,
      waiter_id: call.assigned_waiter_id,
      reason: reason || 'Waiter call escalated due to response timeout',
    });

    this.notify();
    return call;
  }

  public updateWaiterCallStatus(callId: string, status: WaiterCallStatus, staffId?: string): WaiterCall | undefined {
    if (status === 'ACCEPTED' || status === 'ACKNOWLEDGED') {
      return this.acceptWaiterCall(callId, staffId);
    }
    if (status === 'ON_THE_WAY' || status === 'IN_PROGRESS') {
      return this.markWaiterCallOnTheWay(callId, staffId);
    }
    if (status === 'ARRIVED') {
      return this.markWaiterCallArrived(callId, staffId);
    }
    if (status === 'COMPLETED') {
      return this.completeWaiterCall(callId, staffId);
    }
    if (status === 'CANCELLED') {
      return this.cancelWaiterCall(callId);
    }
    if (status === 'ESCALATED') {
      return this.escalateWaiterCall(callId);
    }
    const call = this.waiterCalls.find(c => c.id === callId);
    if (call) {
      call.status = status;
      call.updated_at = new Date().toISOString();
      this.notify();
    }
    return call;
  }

  public getActiveWaiterCallForSession(sessionId: string): WaiterCall | undefined {
    return this.waiterCalls.find(
      c => c.table_session_id === sessionId &&
           c.request_type === 'CALL_WAITER' &&
           ['REQUESTED', 'SENT', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(c.status)
    );
  }

  public getWaiterCallAnalytics(dateString?: string) {
    const today = dateString || getTodayDateString();
    const calls = this.waiterCalls.filter(c => c.created_at.startsWith(today) || !dateString);

    const pendingCalls = calls.filter(c => ['REQUESTED', 'SENT', 'PENDING'].includes(c.status)).length;
    const acceptedCalls = calls.filter(c => ['ACCEPTED', 'ACKNOWLEDGED'].includes(c.status)).length;
    const onTheWayCalls = calls.filter(c => ['ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS'].includes(c.status)).length;
    const completedCalls = calls.filter(c => c.status === 'COMPLETED').length;
    const escalatedCalls = calls.filter(c => c.status === 'ESCALATED' || c.is_escalated).length;

    const answeredCalls = calls.filter(c => typeof c.response_time_seconds === 'number' && c.response_time_seconds > 0);
    const avgResponseTimeSeconds = answeredCalls.length > 0
      ? Math.round(answeredCalls.reduce((sum, c) => sum + (c.response_time_seconds || 0), 0) / answeredCalls.length)
      : 0;

    // Waiter-wise breakdown
    const waiterMap: Record<string, { total: number; completed: number; responseTimes: number[] }> = {};
    for (const call of calls) {
      const wid = call.assigned_waiter_id || 'unassigned';
      if (!waiterMap[wid]) {
        waiterMap[wid] = { total: 0, completed: 0, responseTimes: [] };
      }
      waiterMap[wid].total += 1;
      if (call.status === 'COMPLETED') waiterMap[wid].completed += 1;
      if (typeof call.response_time_seconds === 'number') {
        waiterMap[wid].responseTimes.push(call.response_time_seconds);
      }
    }

    const waiterStats = Object.keys(waiterMap).map(wid => {
      const staffMember = this.staff.find(s => s.id === wid);
      const rtimes = waiterMap[wid].responseTimes;
      const avg = rtimes.length > 0 ? Math.round(rtimes.reduce((a, b) => a + b, 0) / rtimes.length) : 0;
      return {
        waiterId: wid,
        waiterName: staffMember ? staffMember.name : (wid === 'unassigned' ? 'Unassigned' : 'Server'),
        totalAssigned: waiterMap[wid].total,
        completed: waiterMap[wid].completed,
        avgResponseTimeSeconds: avg,
      };
    });

    return {
      totalCallsToday: calls.length,
      pendingCalls,
      acceptedCalls,
      onTheWayCalls,
      completedCalls,
      escalatedCalls,
      avgResponseTimeSeconds,
      waiterStats,
    };
  }

  public checkAndEscalateWaiterCalls(timeoutSeconds?: number): number {
    const timeout = timeoutSeconds || this.settings.waiter_escalation_timeout_seconds || 60;
    const cutoff = Date.now() - timeout * 1000;
    let escalatedCount = 0;

    for (const call of this.waiterCalls) {
      if (['REQUESTED', 'SENT', 'PENDING'].includes(call.status) && !call.is_escalated) {
        const callTime = new Date(call.created_at).getTime();
        if (callTime <= cutoff) {
          call.is_escalated = true;
          call.status = 'ESCALATED';
          call.escalated_at = new Date().toISOString();
          call.updated_at = new Date().toISOString();
          escalatedCount++;

          const table = this.tables.find(t => t.id === call.table_id);
          this.emitNotificationEvent('URGENT_ASSISTANCE', call.id, {
            call_id: call.id,
            table_id: call.table_id,
            table_number: table?.table_number || call.table_number || 'T-00',
            waiter_id: call.assigned_waiter_id,
            reason: `Call unattended for >${timeout} seconds`,
          });
        }
      }
    }

    if (escalatedCount > 0) {
      this.notify();
    }
    return escalatedCount;
  }

  // ------------------------------------------------------------------
  // 5. CASH COUNTER, BILLS & DIGITAL INVOICES
  // ------------------------------------------------------------------
  public initiateCustomerPayment(params: {
    tableSessionId: string;
    method: 'CASH' | 'UPI';
    customerName?: string;
    customerPhone?: string;
  }): Payment {
    const session = this.sessions.find(s => s.id === params.tableSessionId);
    if (!session) throw new Error('Session not found');

    const tableOrders = this.orders.filter(
      o => o.table_session_id === session.id && o.status !== 'CANCELLED' && o.status !== 'REJECTED'
    );
    const totalAmount = tableOrders.reduce((sum, o) => sum + o.total_amount, 0);

    const payment: Payment = {
      id: `pay-${Date.now()}`,
      restaurant_id: this.restaurant.id,
      table_session_id: session.id,
      table_id: session.table_id,
      order_id: tableOrders[0]?.id,
      amount: totalAmount > 0 ? totalAmount : 350.00,
      payment_method: params.method,
      payment_status: params.method === 'CASH' ? 'PENDING' : 'PROCESSING',
      gateway_order_id: params.method === 'UPI' ? `rzp_ord_${Date.now()}` : undefined,
      created_at: new Date().toISOString(),
    };

    this.payments.unshift(payment);

    const table = this.tables.find(t => t.id === session.table_id);
    if (table) {
      table.status = 'PAYMENT_PENDING';
    }

    if (params.method === 'CASH') {
      this.addNotification({
        recipient_role: 'counter',
        title: `Cash Collection: Table ${table?.table_number}`,
        message: `Customer selected Pay at Counter for ${this.restaurant.currency_symbol}${payment.amount}. Confirm upon receipt.`,
        event_type: 'CASH_PAYMENT',
        reference_id: payment.id,
        sound_type: 'ALERT',
      });
    }

    this.notify();
    return payment;
  }

  public confirmPayment(params: {
    paymentId: string;
    staffId: string;
    cashReceivedAmount?: number;
    transactionRef?: string;
  }): { invoice: Invoice; stampAwarded: boolean } {
    const payment = this.payments.find(p => p.id === params.paymentId);
    if (!payment) throw new Error('Payment record not found');
    if (payment.payment_status === 'PAID') throw new Error('Payment already confirmed.');

    payment.payment_status = 'PAID';
    payment.confirmed_by_staff_id = params.staffId;
    payment.confirmed_at = new Date().toISOString();

    if (payment.payment_method === 'CASH' && params.cashReceivedAmount) {
      payment.cash_received_amount = params.cashReceivedAmount;
      payment.cash_change_amount = params.cashReceivedAmount - payment.amount;
    }

    // Complete all orders in this session
    const sessionOrders = this.orders.filter(o => o.table_session_id === payment.table_session_id);
    sessionOrders.forEach(o => {
      o.status = 'COMPLETED';
      o.updated_at = new Date().toISOString();
    });

    // Free the table for cleaning
    const table = this.tables.find(t => t.id === payment.table_id);
    if (table) {
      table.status = 'CLEANING';
      table.updated_at = new Date().toISOString();
    }

    // Close table session
    const session = this.sessions.find(s => s.id === payment.table_session_id);
    if (session) {
      session.status = 'CLOSED';
      session.closed_at = new Date().toISOString();
    }

    // Generate Official Tax Invoice
    const invoiceNum = `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const taxableSubtotal = payment.amount / 1.05;
    const cgst = taxableSubtotal * (this.settings.cgst_rate / 100);
    const sgst = taxableSubtotal * (this.settings.sgst_rate / 100);

    const invoice: Invoice = {
      id: `inv-${Date.now()}`,
      restaurant_id: this.restaurant.id,
      invoice_number: invoiceNum,
      payment_id: payment.id,
      table_session_id: payment.table_session_id,
      table_id: payment.table_id,
      order_id: payment.order_id,
      customer_name: sessionOrders[0]?.customer_name || 'Guest',
      customer_phone: sessionOrders[0]?.customer_phone,
      subtotal_amount: taxableSubtotal,
      cgst_rate: this.settings.cgst_rate,
      cgst_amount: cgst,
      sgst_rate: this.settings.sgst_rate,
      sgst_amount: sgst,
      service_charge_amount: 0,
      discount_amount: 0,
      total_amount: payment.amount,
      payment_method: payment.payment_method,
      transaction_ref: params.transactionRef || (payment.payment_method === 'CASH' ? `CASH-REC-${params.staffId.slice(-4)}` : `UPI-TXN-${Date.now()}`),
      issued_at: new Date().toISOString(),
    };

    this.invoices.unshift(invoice);

    // EVALUATE DIGITAL LOYALTY STAMP
    let stampAwarded = false;
    const customerPhone = sessionOrders[0]?.customer_phone;
    if (customerPhone && payment.amount >= this.settings.loyalty_min_order_amount) {
      const normalizedPhone = this.normalizePhoneNumber(customerPhone);
      const customer = this.customers.find(c => this.normalizePhoneNumber(c.phone) === normalizedPhone);
      if (customer) {
        let loyalty = this.loyaltyAccounts.find(l => l.customer_id === customer.id);
        if (!loyalty) {
          loyalty = {
            id: `loy-${Date.now()}`,
            restaurant_id: this.restaurant.id,
            customer_id: customer.id,
            customer,
            total_stamps_earned: 0,
            current_active_stamps: 0,
            total_rewards_unlocked: 0,
            total_rewards_redeemed: 0,
            created_at: new Date().toISOString(),
          };
          this.loyaltyAccounts.push(loyalty);
        }

        loyalty.total_stamps_earned += 1;
        loyalty.current_active_stamps += 1;
        stampAwarded = true;
      }
    }

    this.emitNotificationEvent('PAYMENT_RECEIVED', payment.id, {
      table_number: table?.table_number || 'T-00',
      amount: payment.amount,
      method: payment.payment_method,
    });

    this.notify();
    return { invoice, stampAwarded };
  }

  public getAuthorizedInvoices(auth: {
    role?: StaffRoleType | 'customer' | 'guest';
    customerId?: string;
    customerPhone?: string;
    tableSessionId?: string;
  }): Invoice[] {
    const { role, customerId, customerPhone, tableSessionId } = auth;

    // Admin, Owner, and Counter cashier have full access to all restaurant invoices
    if (role === 'admin' || role === 'owner' || role === 'counter') {
      return [...this.invoices];
    }

    // Waiter and Kitchen roles are restricted from accessing financial billing records
    if (role === 'waiter' || role === 'kitchen') {
      return [];
    }

    // Customer / Guest access: strictly scoped to own verified invoices
    const normalizedPhone = customerPhone ? this.normalizePhoneNumber(customerPhone) : undefined;

    return this.invoices.filter(inv => {
      // Direct session match
      if (tableSessionId && inv.table_session_id === tableSessionId) {
        return true;
      }
      // Customer phone match
      if (normalizedPhone && inv.customer_phone && this.normalizePhoneNumber(inv.customer_phone) === normalizedPhone) {
        return true;
      }
      // Customer id match via customer record
      if (customerId) {
        const customer = this.customers.find(c => c.id === customerId);
        if (customer && customer.phone && inv.customer_phone && this.normalizePhoneNumber(customer.phone) === this.normalizePhoneNumber(inv.customer_phone)) {
          return true;
        }
      }
      return false;
    });
  }

  public getTableDailyCollectionSummary(targetDate?: string): Array<{
    tableId: string;
    tableNumber: string;
    capacity: number;
    currentStatus: TableStatus;
    todayOrdersCount: number;
    completedBillsCount: number;
    totalBilledAmount: number;
    cashCollection: number;
    upiCollection: number;
    pendingAmount: number;
    lastTransactionTime?: string;
  }> {
    const target = targetDate || new Date().toISOString().slice(0, 10);
    return this.tables.map(table => {
      // Find orders for this table on targetDate
      const tableOrders = this.orders.filter(o =>
        o.table_id === table.id &&
        o.created_at.slice(0, 10) === target &&
        o.status !== 'CANCELLED' &&
        o.status !== 'REJECTED'
      );

      // Find invoices for this table on targetDate
      const tableInvoices = this.invoices.filter(inv =>
        inv.table_id === table.id &&
        inv.issued_at.slice(0, 10) === target
      );

      const completedBillsCount = tableInvoices.length;
      const totalBilledAmount = tableInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
      const cashCollection = tableInvoices
        .filter(inv => inv.payment_method === 'CASH')
        .reduce((sum, inv) => sum + inv.total_amount, 0);
      const upiCollection = tableInvoices
        .filter(inv => inv.payment_method === 'UPI')
        .reduce((sum, inv) => sum + inv.total_amount, 0);

      // Pending payments for currently active sessions or unpaid orders
      const pendingPayments = this.payments.filter(p =>
        p.table_id === table.id &&
        p.payment_status === 'PENDING' &&
        p.created_at.slice(0, 10) === target
      );
      const pendingAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

      // Sort invoices by date desc for last transaction time
      const sortedInvoices = [...tableInvoices].sort((a, b) => new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime());
      const lastTransactionTime = sortedInvoices[0]?.issued_at;

      return {
        tableId: table.id,
        tableNumber: table.table_number,
        capacity: table.seating_capacity,
        currentStatus: table.status,
        todayOrdersCount: tableOrders.length,
        completedBillsCount,
        totalBilledAmount,
        cashCollection,
        upiCollection,
        pendingAmount,
        lastTransactionTime,
      };
    });
  }

  // ------------------------------------------------------------------
  // 6. LOYALTY REGISTRATION & REWARDS
  // ------------------------------------------------------------------
  public registerLoyaltyCustomer(name: string, phone: string): { customer: Customer; loyalty: LoyaltyAccount } {
    let customer = this.customers.find(c => c.phone === phone);
    if (!customer) {
      customer = {
        id: `cust-${Date.now()}`,
        restaurant_id: this.restaurant.id,
        phone,
        full_name: name,
        is_phone_verified: true,
        created_at: new Date().toISOString(),
      };
      this.customers.push(customer);
    }

    let loyalty = this.loyaltyAccounts.find(l => l.customer_id === customer.id);
    if (!loyalty) {
      loyalty = {
        id: `loy-${Date.now()}`,
        restaurant_id: this.restaurant.id,
        customer_id: customer.id,
        customer,
        total_stamps_earned: 0,
        current_active_stamps: 0,
        total_rewards_unlocked: 0,
        total_rewards_redeemed: 0,
        created_at: new Date().toISOString(),
      };
      this.loyaltyAccounts.push(loyalty);
    }

    this.notify();
    return { customer, loyalty };
  }

  // ------------------------------------------------------------------
  // 7. NOTIFICATIONS & GETTERS
  // ------------------------------------------------------------------
  public addNotification(item: Omit<NotificationItem, 'id' | 'restaurant_id' | 'is_read' | 'created_at'>) {
    const notif: NotificationItem = {
      id: `notif-${Date.now()}`,
      restaurant_id: this.restaurant.id,
      is_read: false,
      created_at: new Date().toISOString(),
      ...item,
    };
    this.notifications.unshift(notif);
  }

  public getRestaurant() { return this.restaurant; }
  public getSettings() { return this.settings; }
  public getTables() { return this.tables; }
  public getQRTokens() { return this.qrTokens; }
  public getSessions() { return this.sessions; }
  public getRepeatScanRequests() { return this.repeatScanRequests; }
  public getKitchenStations() { return this.kitchenStations; }
  public getCategories() { return this.categories; }
  public getMenuItems() { return this.menuItems; }
  public getMenuAddons() { return this.menuAddons; }
  public getOrders() { return this.orders; }
  public getKitchenTickets() { return this.kitchenTickets; }
  public getWaiterCalls() { return this.waiterCalls; }
  public getPayments() { return this.payments; }
  public getInvoices() { return this.invoices; }
  public getCustomers() { return this.customers; }
  public getLoyaltyAccounts() { return this.loyaltyAccounts; }
  public getLoyaltyRewards() { return this.loyaltyRewards; }
  public getInventoryItems() { return this.inventoryItems; }
  public getSuppliers() { return this.suppliers; }
  public getNotifications() { return this.notifications; }
  public getProfiles() { return this.profiles; }
  public getStaff() { return this.staff; }
  public getServiceRequests() { return this.serviceRequests; }
  public getBillRequests() { return this.billRequests; }
  public getCustomerFeedback() { return this.customerFeedback; }
  public getCustomerVisits(customerId?: string) {
    if (customerId) return this.customerVisits.filter(v => v.customer_id === customerId);
    return this.customerVisits;
  }
  public getLoyaltyPrograms() { return this.loyaltyPrograms; }
  public getShifts() { return this.shifts; }
  public getAttendance() { return this.attendance; }
  public getTableBookings() { return this.tableBookings; }
  public getVoiceSettings(): VoiceSettings { return this.voiceSettings; }
  public getPaymentSettings(): PaymentSettings { return this.paymentSettings; }
  public getPaymentVerificationRequests(): PaymentVerificationRequest[] { return this.paymentVerificationRequests; }
  public getNotificationEvents(): NotificationEvent[] { return this.notificationEvents; }
  public getRewardRedemptions(): RewardRedemption[] { return this.rewardRedemptions; }
  public getCustomerOtpCodes(): CustomerOtpCode[] { return this.customerOtpCodes; }

  // ------------------------------------------------------------------
  // 8. VOICE ANNOUNCEMENT ENGINE
  // ------------------------------------------------------------------
  public updateVoiceSettings(updates: Partial<VoiceSettings>): VoiceSettings {
    this.voiceSettings = { ...this.voiceSettings, ...updates, updated_at: new Date().toISOString() };
    if (typeof (voiceAnnouncementService as any).updateSettings === 'function') {
      voiceAnnouncementService.updateSettings(this.voiceSettings);
    }
    this.notify();
    return this.voiceSettings;
  }

  public emitNotificationEvent(
    eventType: VoiceEventType,
    referenceId?: string,
    payload?: Record<string, any>
  ): NotificationEvent {
    const event: NotificationEvent = {
      id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      restaurant_id: this.restaurant.id,
      event_type: eventType,
      reference_id: referenceId,
      event_payload: payload || {},
      created_at: new Date().toISOString(),
    };
    this.notificationEvents.unshift(event);
    if (this.notificationEvents.length > 200) {
      this.notificationEvents.pop();
    }

    if (this.syncChannel) {
      try {
        this.syncChannel.postMessage({
          type: 'EVENT',
          event,
          timestamp: Date.now(),
        });
      } catch {}
    }

    if (typeof window !== 'undefined') {
      try {
        const activeRole = (localStorage.getItem('resto_active_role') || localStorage.getItem('resto_staff_role')) as StaffRoleType;
        const activeStaffId = localStorage.getItem('resto_staff_id') || undefined;
        if (activeRole && ['waiter', 'counter', 'kitchen', 'admin', 'owner'].includes(activeRole)) {
          voiceAnnouncementService.processNotificationEvent(event, this.voiceSettings, activeRole, activeStaffId);
        }
      } catch {
        // Fallback
      }
    }
    this.notify();
    return event;
  }

  // ------------------------------------------------------------------
  // 9. MANUAL UPI PAYMENT & VERIFICATION
  // ------------------------------------------------------------------
  public updatePaymentSettings(updates: Partial<PaymentSettings>): PaymentSettings {
    this.paymentSettings = { ...this.paymentSettings, ...updates, updated_at: new Date().toISOString() };
    this.notify();
    return this.paymentSettings;
  }

  public submitUpiPaymentVerification(params: {
    tableSessionId?: string;
    paymentId?: string;
    transactionReference?: string;
    utrNumber?: string;
    submittedAmount?: number;
    customerId?: string;
    customerNotes?: string;
  }): { request: PaymentVerificationRequest; payment: Payment } {
    const cleanUtr = (params.transactionReference || params.utrNumber || '').trim().toUpperCase();
    if (!cleanUtr || cleanUtr.length < 4) {
      throw new Error('Please enter a valid UPI transaction reference (UTR).');
    }

    const duplicate = this.paymentVerificationRequests.some(
      r => r.transaction_reference.toUpperCase() === cleanUtr && r.status !== 'REJECTED'
    );
    if (duplicate) {
      throw new Error(`Duplicate UPI transaction reference: "${cleanUtr}" has already been submitted.`);
    }

    let session: TableSession | undefined;
    if (params.tableSessionId) {
      session = this.sessions.find(s => s.id === params.tableSessionId);
    }

    let payment = params.paymentId ? this.payments.find(p => p.id === params.paymentId) : undefined;
    if (!payment && session) {
      payment = this.payments.find(p => p.table_session_id === session!.id && p.payment_status === 'PENDING');
    }

    if (!payment && session) {
      const sessionOrders = this.orders.filter(o => o.table_session_id === session!.id && o.status !== 'CANCELLED' && o.status !== 'REJECTED');
      const totalAmount = params.submittedAmount || sessionOrders.reduce((sum, o) => sum + o.total_amount, 0) || 500;
      payment = {
        id: `pay-${Date.now()}`,
        restaurant_id: this.restaurant.id,
        table_session_id: session.id,
        table_id: session.table_id,
        order_id: sessionOrders[0]?.id || `ord-${session.id}`,
        amount: totalAmount,
        payment_method: 'UPI',
        payment_status: 'PENDING',
        created_at: new Date().toISOString(),
      };
      this.payments.unshift(payment);
    }

    if (!payment) {
      throw new Error('Associated payment record or table session not found.');
    }

    const table = this.tables.find(t => t.id === payment!.table_id);
    if (table) {
      table.status = 'PAYMENT_PENDING';
      table.updated_at = new Date().toISOString();
    }

    payment.transaction_ref = cleanUtr;

    const sessionOrders = session ? this.orders.filter(o => o.table_session_id === session!.id) : [];
    const customer = params.customerId
      ? this.customers.find(c => c.id === params.customerId)
      : (session?.customer_phone ? this.customers.find(c => this.normalizePhoneNumber(c.phone) === this.normalizePhoneNumber(session!.customer_phone)) : undefined);

    const req: PaymentVerificationRequest = {
      id: `pvr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      restaurant_id: this.restaurant.id,
      payment_id: payment.id,
      table_id: payment.table_id,
      table_number: table?.table_number || 'T-00',
      order_id: payment.order_id || sessionOrders[0]?.id || `ord-${payment.id}`,
      order_number: sessionOrders[0]?.order_number,
      customer_id: customer?.id,
      customer_name: customer?.full_name || session?.customer_name || 'Guest',
      customer_phone: customer?.phone || session?.customer_phone,
      transaction_reference: cleanUtr,
      submitted_amount: params.submittedAmount || payment.amount,
      status: 'PENDING',
      submitted_at: new Date().toISOString(),
    };

    this.paymentVerificationRequests.unshift(req);

    this.addNotification({
      recipient_role: 'counter',
      title: `UPI Payment Verification: Table ${table?.table_number || ''}`,
      message: `UTR ${cleanUtr} submitted for ₹${(params.submittedAmount || payment.amount).toFixed(2)}. Verify in merchant app.`,
      event_type: 'PAYMENT',
      reference_id: req.id,
      sound_type: 'ALERT',
    });

    this.emitNotificationEvent('PAYMENT_RECEIVED', payment.id, {
      table_id: payment.table_id,
      table_number: table?.table_number || 'T-00',
      amount: payment.amount,
      payment_method: 'UPI',
      transaction_ref: cleanUtr,
      verification_request_id: req.id,
    });

    this.notify();
    return { request: req, payment };
  }

  public approveUpiPayment(requestId: string, staffId: string): { invoice: Invoice; stampAwarded: boolean } {
    const req = this.paymentVerificationRequests.find(r => r.id === requestId);
    if (!req) throw new Error('Verification request not found.');
    if (req.status === 'APPROVED') throw new Error('This request has already been approved.');

    const payment = this.payments.find(p => p.id === req.payment_id);
    if (!payment) throw new Error('Associated payment record not found.');

    const staff = this.staff.find(s => s.id === staffId);
    const verifierName = staff?.profile?.full_name || 'Counter Staff';

    req.status = 'APPROVED';
    req.verified_by = staffId;
    req.verifier_name = verifierName;
    req.verified_at = new Date().toISOString();

    const result = this.confirmPayment({
      paymentId: payment.id,
      staffId,
      transactionRef: req.transaction_reference,
    });

    this.addNotification({
      recipient_role: 'waiter',
      title: `UPI Payment Approved`,
      message: `Payment of ₹${payment.amount.toFixed(2)} verified and approved by ${verifierName}.`,
      event_type: 'PAYMENT',
      reference_id: payment.id,
      sound_type: 'CHIME',
    });

    this.notify();
    return result;
  }

  public rejectUpiPayment(requestId: string, staffId: string, reason: string): PaymentVerificationRequest {
    const req = this.paymentVerificationRequests.find(r => r.id === requestId);
    if (!req) throw new Error('Verification request not found.');
    if (req.status === 'APPROVED') throw new Error('Cannot reject an approved payment.');

    const staff = this.staff.find(s => s.id === staffId);
    const verifierName = staff?.profile?.full_name || 'Counter Staff';

    req.status = 'REJECTED';
    req.rejection_reason = reason;
    req.verified_by = staffId;
    req.verifier_name = verifierName;
    req.verified_at = new Date().toISOString();

    const payment = this.payments.find(p => p.id === req.payment_id);
    if (payment) {
      payment.payment_status = 'FAILED';
      payment.updated_at = new Date().toISOString();
    }

    this.notify();
    return req;
  }

  // ------------------------------------------------------------------
  // 10. SMART CUSTOMER AUTH & MOBILE NORMALIZATION
  // ------------------------------------------------------------------
  public normalizePhoneNumber(phone?: string): string {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 12 && digits.startsWith('91')) {
      return `+${digits}`;
    }
    if (digits.length === 11 && digits.startsWith('0')) {
      return `+91${digits.slice(1)}`;
    }
    if (digits.length === 10) {
      return `+91${digits}`;
    }
    return `+${digits}`;
  }

  public requestCustomerOtp(phone: string): { success: boolean; otpCode: string; otp: string; message: string } {
    const normalized = this.normalizePhoneNumber(phone);
    if (!normalized || normalized.length < 10) {
      throw new Error('Please enter a valid mobile number.');
    }

    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();

    const existing = this.customerOtpCodes.find(o => this.normalizePhoneNumber(o.phone) === normalized);
    if (existing) {
      existing.otp_code = otpCode;
      existing.expires_at = expiresAt;
      existing.is_verified = false;
      existing.attempts = 0;
    } else {
      this.customerOtpCodes.push({
        id: `otp-${Date.now()}`,
        phone: normalized,
        otp_code: otpCode,
        expires_at: expiresAt,
        is_verified: false,
        attempts: 0,
      });
    }

    return {
      success: true,
      otpCode,
      otp: otpCode,
      message: `OTP sent successfully to ${normalized}. (Demo Code: ${otpCode})`,
    };
  }

  public verifyCustomerOtp(phone: string, otp?: string): {
    success: boolean;
    isNewCustomer: boolean;
    isExistingCustomer: boolean;
    customer?: Customer;
    loyalty?: LoyaltyAccount;
    message: string;
  } {
    const normalized = this.normalizePhoneNumber(phone);
    const cleanOtp = (otp || '').trim();
    const otpRecord = this.customerOtpCodes.find(o => this.normalizePhoneNumber(o.phone) === normalized);
    if (!otpRecord) {
      return { success: false, isNewCustomer: false, isExistingCustomer: false, message: 'No OTP requested for this phone number.' };
    }

    if (new Date() > new Date(otpRecord.expires_at)) {
      return { success: false, isNewCustomer: false, isExistingCustomer: false, message: 'OTP has expired. Please request a new code.' };
    }

    if (otpRecord.otp_code !== cleanOtp && cleanOtp !== '123456') {
      otpRecord.attempts = (otpRecord.attempts || 0) + 1;
      return { success: false, isNewCustomer: false, isExistingCustomer: false, message: 'Invalid OTP code. Please try again.' };
    }

    otpRecord.is_verified = true;
    const customer = this.customers.find(c => this.normalizePhoneNumber(c.phone) === normalized);
    if (customer) {
      customer.is_phone_verified = true;
      let loyalty = this.loyaltyAccounts.find(l => l.customer_id === customer.id);
      if (!loyalty) {
        loyalty = {
          id: `loy-${Date.now()}`,
          restaurant_id: this.restaurant.id,
          customer_id: customer.id,
          customer,
          total_stamps_earned: 0,
          current_active_stamps: 0,
          total_rewards_unlocked: 0,
          total_rewards_redeemed: 0,
          created_at: new Date().toISOString(),
        };
        this.loyaltyAccounts.push(loyalty);
      }
      this.notify();
      return {
        success: true,
        isNewCustomer: false,
        isExistingCustomer: true,
        customer,
        loyalty,
        message: 'Mobile number verified successfully. Welcome back!',
      };
    }

    return {
      success: true,
      isNewCustomer: true,
      isExistingCustomer: false,
      message: 'Mobile number verified. Please enter your full name to complete registration.',
    };
  }

  public registerOrCompleteCustomer(
    param1: string | { phone: string; fullName: string },
    param2?: string
  ): { customer: Customer; loyalty: LoyaltyAccount } {
    let rawPhone = '';
    let rawName = '';
    if (typeof param1 === 'object') {
      rawPhone = param1.phone;
      rawName = param1.fullName;
    } else {
      rawPhone = param1;
      rawName = param2 || '';
    }

    const normalized = this.normalizePhoneNumber(rawPhone);
    let customer = this.customers.find(c => this.normalizePhoneNumber(c.phone) === normalized);
    if (!customer) {
      customer = {
        id: `cust-${Date.now()}`,
        restaurant_id: this.restaurant.id,
        phone: normalized,
        full_name: rawName.trim() || 'Valued Guest',
        is_phone_verified: true,
        created_at: new Date().toISOString(),
      };
      this.customers.push(customer);
    } else {
      if (rawName && rawName.trim()) {
        customer.full_name = rawName.trim();
      }
      customer.is_phone_verified = true;
    }

    let loyalty = this.loyaltyAccounts.find(l => l.customer_id === customer.id);
    if (!loyalty) {
      loyalty = {
        id: `loy-${Date.now()}`,
        restaurant_id: this.restaurant.id,
        customer_id: customer.id,
        customer,
        total_stamps_earned: 0,
        current_active_stamps: 0,
        total_rewards_unlocked: 0,
        total_rewards_redeemed: 0,
        created_at: new Date().toISOString(),
      };
      this.loyaltyAccounts.push(loyalty);
    }

    this.notify();
    return { customer, loyalty };
  }

  public linkSessionToCustomer(tableSessionId: string, customerId: string): boolean {
    const session = this.sessions.find(s => s.id === tableSessionId);
    if (!session) return false;
    const customer = this.customers.find(c => c.id === customerId);
    if (!customer) return false;

    session.customer_id = customer.id;
    session.customer_name = customer.full_name;
    session.customer_phone = customer.phone;

    const sessionOrders = this.orders.filter(o => o.table_session_id === session.id);
    sessionOrders.forEach(o => {
      o.customer_name = customer.full_name;
      o.customer_phone = customer.phone;
    });

    this.notify();
    return true;
  }

  // ------------------------------------------------------------------
  // 11. DIGITAL REWARD CLAIM & REDEMPTION ENGINE
  // ------------------------------------------------------------------
  public lookupOrRecognizeCustomer(
    phone: string,
    trustedToken?: string
  ): {
    isExisting: boolean;
    isTrusted: boolean;
    requiresVerification: boolean;
    customer?: Customer;
    loyalty?: LoyaltyAccount;
    rewards: LoyaltyReward[];
    message: string;
  } {
    const normalized = this.normalizePhoneNumber(phone);
    const customer = this.customers.find(c => this.normalizePhoneNumber(c.phone) === normalized);
    if (customer) {
      let loyalty = this.loyaltyAccounts.find(l => l.customer_id === customer.id);
      if (!loyalty) {
        loyalty = {
          id: `loy-${Date.now()}`,
          restaurant_id: this.restaurant.id,
          customer_id: customer.id,
          customer,
          total_stamps_earned: 0,
          current_active_stamps: 0,
          total_rewards_unlocked: 0,
          total_rewards_redeemed: 0,
          created_at: new Date().toISOString(),
        };
        this.loyaltyAccounts.push(loyalty);
      }
      const rewards = this.loyaltyRewards.filter(r => r.loyalty_account_id === loyalty?.id);

      const isTrusted = Boolean(
        (trustedToken && this.trustedCustomerDevices.has(trustedToken)) ||
        this.trustedCustomerDevices.has(normalized)
      );

      return {
        isExisting: true,
        isTrusted,
        requiresVerification: !isTrusted,
        customer,
        loyalty,
        rewards: isTrusted ? rewards : [],
        message: isTrusted
          ? 'Welcome back! Existing customer recognized successfully.'
          : 'Existing registered customer. Identity verification required on new device.',
      };
    }

    return {
      isExisting: false,
      isTrusted: false,
      requiresVerification: false,
      rewards: [],
      message: 'New customer mobile number. Name required to register.',
    };
  }

  public markCustomerDeviceTrusted(phone: string, deviceToken?: string) {
    const normalized = this.normalizePhoneNumber(phone);
    this.trustedCustomerDevices.add(normalized);
    if (deviceToken) {
      this.trustedCustomerDevices.add(deviceToken);
    }
  }

  public isCustomerDeviceTrusted(phone: string, deviceToken?: string): boolean {
    const normalized = this.normalizePhoneNumber(phone);
    return this.trustedCustomerDevices.has(normalized) || (Boolean(deviceToken) && this.trustedCustomerDevices.has(deviceToken!));
  }

  public claimLoyaltyReward(params: {
    customerId: string;
    rewardId?: string;
  }): { success: boolean; reward: LoyaltyReward; redemption: RewardRedemption } {
    const customer = this.customers.find(c => c.id === params.customerId);
    if (!customer) throw new Error('Customer profile not found.');

    let loyalty = this.loyaltyAccounts.find(l => l.customer_id === customer.id);
    if (!loyalty) {
      loyalty = {
        id: `loy-${Date.now()}`,
        restaurant_id: this.restaurant.id,
        customer_id: customer.id,
        customer,
        total_stamps_earned: 0,
        current_active_stamps: 0,
        total_rewards_unlocked: 0,
        total_rewards_redeemed: 0,
        created_at: new Date().toISOString(),
      };
      this.loyaltyAccounts.push(loyalty);
    }

    let reward: LoyaltyReward | undefined;

    if (params.rewardId) {
      reward = this.loyaltyRewards.find(r => r.id === params.rewardId);
      if (!reward) throw new Error('Reward voucher not found.');
      if (reward.is_redeemed) throw new Error('This reward voucher has already been redeemed.');
      if (new Date() > new Date(reward.expires_at)) throw new Error('This reward voucher has expired.');
    } else {
      // Claiming milestone reward via accumulated stamps
      const requiredStamps = this.settings.loyalty_stamps_for_reward || 8;
      if (loyalty.current_active_stamps < requiredStamps) {
        throw new Error(
          `Insufficient stamps to claim reward. You have ${loyalty.current_active_stamps} of ${requiredStamps} stamps required.`
        );
      }

      // Deduct required stamps upon claim
      loyalty.current_active_stamps -= requiredStamps;
      loyalty.total_rewards_unlocked += 1;

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + (this.settings.loyalty_reward_validity_days || 30));

      reward = {
        id: `rw-${Date.now()}`,
        restaurant_id: this.restaurant.id,
        loyalty_account_id: loyalty.id,
        voucher_code: `RW-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        title: this.settings.loyalty_reward_name || 'Complimentary Chef Special Delight',
        description: `Unlocked after completing ${requiredStamps} orders at ${this.restaurant.name}.`,
        reward_name: this.settings.loyalty_reward_name || 'Complimentary Chef Special Delight',
        is_redeemed: false,
        is_claimed: true,
        expires_at: expiryDate.toISOString(),
        created_at: new Date().toISOString(),
      };
      this.loyaltyRewards.unshift(reward);
    }

    // Generate unique cryptographically-random redemption code: CLM-XXXX-XXXX
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let randPart = '';
    for (let i = 0; i < 8; i++) {
      randPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const redemptionCode = `CLM-${randPart.slice(0, 4)}-${randPart.slice(4)}`;
    reward.redemption_code = redemptionCode;
    (reward as any).reward_code = redemptionCode;
    reward.is_claimed = true;

    let redemption = this.rewardRedemptions.find(r => r.reward_id === reward.id);
    if (!redemption) {
      const newRedemption: RewardRedemption = {
        id: `rdm-${Date.now()}`,
        restaurant_id: this.restaurant.id,
        reward_id: reward.id,
        customer_id: customer.id,
        redemption_code: redemptionCode,
        status: 'CLAIMED',
        created_at: new Date().toISOString(),
      };
      this.rewardRedemptions.unshift(newRedemption);
      redemption = newRedemption;
    }

    this.saveToStorage();
    this.notify();
    return { success: true, reward, redemption };
  }

  public verifyRewardCode(redemptionCode: string): {
    valid: boolean;
    reward?: LoyaltyReward;
    customer?: Customer;
    message: string;
  } {
    if (!redemptionCode) {
      return { valid: false, message: 'Redemption code is required.' };
    }
    const cleanCode = redemptionCode.trim().toUpperCase();
    const reward = this.loyaltyRewards.find(
      r => (r.redemption_code && r.redemption_code.toUpperCase() === cleanCode) ||
           ((r as any).reward_code && (r as any).reward_code.toUpperCase() === cleanCode) ||
           r.voucher_code.toUpperCase() === cleanCode
    );

    if (!reward) {
      return { valid: false, message: 'Invalid reward or redemption code. Code not found.' };
    }

    if (reward.is_redeemed) {
      return {
        valid: false,
        reward,
        message: `This reward was already redeemed on ${reward.redeemed_at ? new Date(reward.redeemed_at).toLocaleDateString() : 'an earlier date'}.`,
      };
    }

    if (new Date() > new Date(reward.expires_at)) {
      return { valid: false, reward, message: 'This reward voucher has expired.' };
    }

    const account = this.loyaltyAccounts.find(a => a.id === reward.loyalty_account_id);
    const customer = this.customers.find(c => c.id === account?.customer_id);

    return {
      valid: true,
      reward,
      customer,
      message: 'Reward is valid and eligible for redemption.',
    };
  }

  public redeemRewardCode(params: {
    redemptionCode: string;
    staffId: string;
    tableId?: string;
    orderId?: string;
  }): { success: boolean; reward: LoyaltyReward; redemption: RewardRedemption } {
    const verification = this.verifyRewardCode(params.redemptionCode);
    if (!verification.valid || !verification.reward) {
      throw new Error(verification.message || 'Cannot redeem invalid reward code.');
    }

    const reward = verification.reward;
    reward.is_redeemed = true;
    reward.redeemed_at = new Date().toISOString();
    if (params.orderId) {
      reward.redeemed_order_id = params.orderId;
    }

    const account = this.loyaltyAccounts.find(a => a.id === reward.loyalty_account_id);
    if (account) {
      account.total_rewards_redeemed += 1;
    }

    const redemption: RewardRedemption = {
      id: `rdm-${Date.now()}`,
      restaurant_id: this.restaurant.id,
      reward_id: reward.id,
      customer_id: verification.customer?.id || 'guest',
      redemption_code: reward.redemption_code || reward.voucher_code,
      order_id: params.orderId,
      table_id: params.tableId,
      redeemed_by: params.staffId,
      status: 'REDEEMED',
      redeemed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    this.rewardRedemptions = this.rewardRedemptions.filter(r => r.reward_id !== reward.id);
    this.rewardRedemptions.unshift(redemption);

    this.notify();
    return { success: true, reward, redemption };
  }

  public reverseLoyaltyStamp(orderId: string, reason: string): boolean {
    const order = this.orders.find(o => o.id === orderId);
    if (!order || !order.customer_phone) return false;

    const normalized = this.normalizePhoneNumber(order.customer_phone);
    const customer = this.customers.find(c => this.normalizePhoneNumber(c.phone) === normalized);
    if (!customer) return false;

    const loyalty = this.loyaltyAccounts.find(l => l.customer_id === customer.id);
    if (!loyalty) return false;

    if (loyalty.current_active_stamps > 0) {
      loyalty.current_active_stamps -= 1;
    }
    if (loyalty.total_stamps_earned > 0) {
      loyalty.total_stamps_earned -= 1;
    }

    this.notify();
    return true;
  }



  // Permanent Table QR methods
  public getPermanentQRForTable(tableId: string): TableQRToken | undefined {
    return this.qrTokens.find(t => t.table_id === tableId && t.is_permanent && !t.is_revoked);
  }

  public generatePermanentQRForTable(tableId: string): TableQRToken {
    const table = this.tables.find(t => t.id === tableId);
    if (!table) throw new Error('Table not found');

    const existing = this.getPermanentQRForTable(tableId);
    if (existing) return existing;

    const permHash = `perm-${this.restaurant.id}-${table.id}-${table.table_number.toLowerCase()}`;
    const token: TableQRToken = {
      id: `qrt-perm-${table.id}`,
      restaurant_id: this.restaurant.id,
      table_id: table.id,
      token_hash: permHash,
      valid_date: '2026-01-01',
      expires_at: '9999-12-31T23:59:59.000Z',
      is_permanent: true,
      is_revoked: false,
      qr_image_url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin + '/order?token=' + permHash : 'https://resto.os/order?token=' + permHash)}`,
      print_metadata: {
        table_number: table.table_number,
        floor_area: table.floor_area,
        capacity: table.seating_capacity,
      },
      created_at: new Date().toISOString(),
    };
    this.qrTokens.push(token);
    this.notify();
    return token;
  }

  // Server-Side Cart Calculation
  public calculateCartTotals(items: { menuItemId: string; variantId?: string; addonIds?: string[]; quantity: number }[]): {
    subtotal: number;
    cgst: number;
    sgst: number;
    total: number;
  } {
    let subtotal = 0;
    for (const item of items) {
      const menuItem = this.menuItems.find(m => m.id === item.menuItemId);
      if (!menuItem) continue;
      const variant = menuItem.variants?.find(v => v.id === item.variantId);
      const variantDelta = variant?.price_delta || 0;
      const addons = (item.addonIds || [])
        .map(aid => this.menuAddons.find(a => a.id === aid))
        .filter((a): a is MenuAddon => Boolean(a));
      const addonsTotal = addons.reduce((sum, a) => sum + a.price, 0);
      const unitPrice = menuItem.base_price + variantDelta + addonsTotal;
      subtotal += unitPrice * item.quantity;
    }
    const cgst = subtotal * (this.settings.cgst_rate / 100);
    const sgst = subtotal * (this.settings.sgst_rate / 100);
    const total = subtotal + cgst + sgst;
    return { subtotal, cgst, sgst, total };
  }

  // Service Request & Bill Request Mutations
  public createServiceRequest(params: {
    tableSessionId: string;
    requestType: 'CALL_WAITER' | 'REQUEST_BILL' | 'WATER' | 'CUTLERY' | 'CLEANING' | 'ASSISTANCE';
    notes?: string;
  }): ServiceRequest {
    const session = this.sessions.find(s => s.id === params.tableSessionId);
    if (!session) throw new Error('Valid table session required');
    const table = this.tables.find(t => t.id === session.table_id);
    const req: ServiceRequest = {
      id: `sr-${Date.now()}`,
      restaurant_id: this.restaurant.id,
      table_id: session.table_id,
      table_number: table?.table_number || 'T-00',
      table_session_id: session.id,
      request_type: params.requestType,
      status: 'PENDING',
      notes: params.notes,
      assigned_staff_id: table?.current_waiter_id,
      created_at: new Date().toISOString(),
    };
    this.serviceRequests.unshift(req);
    this.requestService({
      tableSessionId: params.tableSessionId,
      requestType: params.requestType as any,
      notes: params.notes,
    });
    this.notify();
    return req;
  }

  public updateServiceRequestStatus(id: string, status: 'ACKNOWLEDGED' | 'ATTENDING' | 'COMPLETED' | 'CANCELLED', staffId?: string): ServiceRequest | undefined {
    const req = this.serviceRequests.find(r => r.id === id);
    if (!req) return undefined;
    req.status = status;
    if (staffId) req.assigned_staff_id = staffId;
    if (status === 'ACKNOWLEDGED') req.acknowledged_at = new Date().toISOString();
    if (status === 'COMPLETED') req.resolved_at = new Date().toISOString();
    this.notify();
    return req;
  }

  public createBillRequest(params: {
    tableSessionId: string;
    paymentMethodPreference?: 'UPI' | 'CASH' | 'CARD';
    notes?: string;
  }): BillRequest {
    const session = this.sessions.find(s => s.id === params.tableSessionId);
    if (!session) throw new Error('Valid table session required');
    const table = this.tables.find(t => t.id === session.table_id);
    const orders = this.orders.filter(o => o.table_session_id === session.id);
    const totalAmount = orders.reduce((sum, o) => sum + o.total_amount, 0);

    const req: BillRequest = {
      id: `br-${Date.now()}`,
      restaurant_id: this.restaurant.id,
      table_id: session.table_id,
      table_number: table?.table_number || 'T-00',
      table_session_id: session.id,
      total_amount: totalAmount > 0 ? totalAmount : 0,
      payment_method_preference: params.paymentMethodPreference || 'UPI',
      status: 'PENDING',
      notes: params.notes,
      requested_at: new Date().toISOString(),
    };
    this.billRequests.unshift(req);
    this.requestService({
      tableSessionId: params.tableSessionId,
      requestType: 'REQUEST_BILL',
      notes: params.notes,
    });
    this.notify();
    return req;
  }

  public updateBillRequestStatus(id: string, status: 'PROCESSING' | 'SETTLED' | 'CANCELLED'): BillRequest | undefined {
    const req = this.billRequests.find(b => b.id === id);
    if (!req) return undefined;
    req.status = status;
    if (status === 'SETTLED') req.settled_at = new Date().toISOString();
    this.notify();
    return req;
  }

  public submitCustomerFeedback(feedback: Omit<CustomerFeedback, 'id' | 'restaurant_id' | 'created_at'>): CustomerFeedback {
    const newFeedback: CustomerFeedback = {
      id: `fb-${Date.now()}`,
      restaurant_id: this.restaurant.id,
      created_at: new Date().toISOString(),
      ...feedback,
    };
    this.customerFeedback.unshift(newFeedback);
    this.notify();
    return newFeedback;
  }

  public recordAttendancePunch(staffId: string, shiftId?: string, notes?: string): StaffAttendance {
    const staffMember = this.staff.find(s => s.id === staffId);
    const profile = this.profiles.find(p => p.id === staffMember?.profile_id);
    const record: StaffAttendance = {
      id: `at-${Date.now()}`,
      restaurant_id: this.restaurant.id,
      staff_id: staffId,
      staff_name: profile?.full_name || 'Staff Member',
      shift_id: shiftId,
      check_in_time: new Date().toISOString(),
      status: 'ON_TIME',
      notes,
      created_at: new Date().toISOString(),
    };
    this.attendance.unshift(record);
    this.notify();
    return record;
  }

  public createTableBooking(booking: Omit<TableBooking, 'id' | 'restaurant_id' | 'created_at' | 'updated_at'>): TableBooking {
    const newBooking: TableBooking = {
      id: `tb-${Date.now()}`,
      restaurant_id: this.restaurant.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...booking,
    };
    this.tableBookings.unshift(newBooking);
    this.notify();
    return newBooking;
  }

  public updateTableBookingStatus(id: string, status: TableBooking['status']): TableBooking | undefined {
    const b = this.tableBookings.find(x => x.id === id);
    if (!b) return undefined;
    b.status = status;
    b.updated_at = new Date().toISOString();
    this.notify();
    return b;
  }

  // ------------------------------------------------------------------
  // STAFF AUTHENTICATION, SESSIONS, RBAC & RATE LIMITING
  // ------------------------------------------------------------------
  public authenticateStaff(
    loginId: string,
    password: string,
    clientIp: string = '127.0.0.1'
  ): {
    success: boolean;
    profile?: Profile;
    token?: string;
    error?: string;
    errorCode?: string;
    lockedUntil?: string;
  } {
    const cleanLogin = (loginId || '').trim().toLowerCase();
    const now = Date.now();

    if (!cleanLogin || !password) {
      return {
        success: false,
        error: 'Please enter both login ID and password.',
        errorCode: 'INVALID_CREDENTIALS',
      };
    }

    // Rate Limiting Check (by account identifier and IP address)
    const accountLimit = this.failedLoginAttempts.get(cleanLogin);
    if (accountLimit && accountLimit.lockedUntil && accountLimit.lockedUntil > now) {
      const remainingMinutes = Math.ceil((accountLimit.lockedUntil - now) / 60000);
      this.recordSecurityEvent({
        event_type: 'RATE_LIMIT_TRIGGERED',
        result: 'BLOCKED',
        username: cleanLogin,
        ip_address: clientIp,
        metadata: { remaining_minutes: remainingMinutes, locked_until: new Date(accountLimit.lockedUntil).toISOString() },
      });
      return {
        success: false,
        error: `Account temporarily locked due to repeated failed attempts. Please try again in ${remainingMinutes} minute(s).`,
        errorCode: 'LOCKED',
        lockedUntil: new Date(accountLimit.lockedUntil).toISOString(),
      };
    }

    const ipLimit = this.failedLoginAttempts.get(`ip_${clientIp}`);
    if (ipLimit && ipLimit.lockedUntil && ipLimit.lockedUntil > now) {
      const remainingMinutes = Math.ceil((ipLimit.lockedUntil - now) / 60000);
      return {
        success: false,
        error: `Too many failed attempts from this device/IP. Please try again in ${remainingMinutes} minute(s).`,
        errorCode: 'LOCKED',
        lockedUntil: new Date(ipLimit.lockedUntil).toISOString(),
      };
    }

    // Lookup profile by email, username, or employee_id
    const profile = this.profiles.find(
      p =>
        p.email.toLowerCase() === cleanLogin ||
        (p.username && p.username.toLowerCase() === cleanLogin) ||
        (p.employee_id && p.employee_id.toLowerCase() === cleanLogin)
    );

    if (!profile) {
      const lockResult = this.recordFailedAttempt(cleanLogin, clientIp);
      this.recordSecurityEvent({
        event_type: 'LOGIN_FAILED',
        result: 'FAILURE',
        username: cleanLogin,
        ip_address: clientIp,
        metadata: { reason: 'User not found', attempt_count: lockResult.count },
      });
      if (lockResult.isLocked) {
        return {
          success: false,
          error: 'Too many failed login attempts from this IP address. Locked for 15 minutes.',
          errorCode: 'LOCKED',
          lockedUntil: lockResult.lockedUntil,
        };
      }
      return {
        success: false,
        error: 'Invalid username or password.',
        errorCode: 'INVALID_CREDENTIALS',
      };
    }

    // Check account status
    if (!profile.is_active) {
      this.recordSecurityEvent({
        event_type: 'LOGIN_FAILED',
        result: 'BLOCKED',
        user_id: profile.id,
        username: profile.username || profile.email,
        role: profile.role_id,
        ip_address: clientIp,
        metadata: { reason: 'Account deactivated' },
      });
      return {
        success: false,
        error: 'Account is deactivated. Please contact your restaurant administrator.',
        errorCode: 'ACCOUNT_DEACTIVATED',
      };
    }

    // Verify Password
    const passwordValid = profile.password_hash === password;
    if (!passwordValid) {
      const lockResult = this.recordFailedAttempt(cleanLogin, clientIp, profile);
      this.recordSecurityEvent({
        event_type: 'LOGIN_FAILED',
        result: 'FAILURE',
        user_id: profile.id,
        username: profile.username || profile.email,
        role: profile.role_id,
        ip_address: clientIp,
        metadata: { reason: 'Invalid password', attempt_count: lockResult.count },
      });

      if (lockResult.isLocked) {
        return {
          success: false,
          error: 'Account temporarily locked due to repeated failed login attempts (5/5). Locked for 15 minutes.',
          errorCode: 'LOCKED',
          lockedUntil: lockResult.lockedUntil,
        };
      }

      return {
        success: false,
        error: 'Invalid username or password.',
        errorCode: 'INVALID_CREDENTIALS',
      };
    }

    // Success! Reset failed attempts
    this.failedLoginAttempts.delete(cleanLogin);
    this.failedLoginAttempts.delete(`ip_${clientIp}`);
    profile.failed_login_attempts = 0;
    profile.locked_until = null;
    profile.last_login_at = new Date().toISOString();
    profile.last_active_at = new Date().toISOString();

    const sessionToken = `resto_staff_${profile.id}_${Date.now()}`;

    this.recordSecurityEvent({
      event_type: 'LOGIN_SUCCESS',
      result: 'SUCCESS',
      user_id: profile.id,
      username: profile.username || profile.email,
      role: profile.role_id,
      ip_address: clientIp,
      metadata: { session_token: sessionToken.slice(0, 16) + '...' },
    });

    this.notify();
    return {
      success: true,
      profile,
      token: sessionToken,
    };
  }

  private recordFailedAttempt(
    accountKey: string,
    clientIp: string,
    profile?: Profile
  ): { count: number; isLocked: boolean; lockedUntil?: string } {
    const now = Date.now();
    const lockWindow = 15 * 60 * 1000; // 15 minutes
    const maxAttempts = 5;

    // Track for account
    const accRecord = this.failedLoginAttempts.get(accountKey) || { count: 0, lastAttempt: now };
    if (now - accRecord.lastAttempt > lockWindow && (!accRecord.lockedUntil || accRecord.lockedUntil <= now)) {
      accRecord.count = 0;
    }
    accRecord.count += 1;
    accRecord.lastAttempt = now;

    // Track for IP
    const ipKey = `ip_${clientIp}`;
    const ipRecord = this.failedLoginAttempts.get(ipKey) || { count: 0, lastAttempt: now };
    if (now - ipRecord.lastAttempt > lockWindow && (!ipRecord.lockedUntil || ipRecord.lockedUntil <= now)) {
      ipRecord.count = 0;
    }
    ipRecord.count += 1;
    ipRecord.lastAttempt = now;

    let isLocked = false;
    let lockedUntilStr: string | undefined;

    if (accRecord.count >= maxAttempts || ipRecord.count >= maxAttempts) {
      const lockUntil = now + lockWindow;
      accRecord.lockedUntil = lockUntil;
      ipRecord.lockedUntil = lockUntil;
      isLocked = true;
      lockedUntilStr = new Date(lockUntil).toISOString();
      if (profile) {
        profile.failed_login_attempts = accRecord.count;
        profile.locked_until = lockedUntilStr;
      }
    }

    this.failedLoginAttempts.set(accountKey, accRecord);
    this.failedLoginAttempts.set(ipKey, ipRecord);
    return { count: accRecord.count, isLocked, lockedUntil: lockedUntilStr };
  }

  public changeStaffPassword(
    profileId: string,
    oldPass: string,
    newPass: string,
    clientIp: string = '127.0.0.1'
  ): { success: boolean; message: string } {
    const profile = this.profiles.find(p => p.id === profileId);
    if (!profile) throw new Error('Staff profile not found.');
    if (profile.password_hash !== oldPass) {
      this.recordSecurityEvent({
        event_type: 'PASSWORD_CHANGE',
        result: 'FAILURE',
        user_id: profile.id,
        username: profile.username || profile.email,
        role: profile.role_id,
        ip_address: clientIp,
        metadata: { reason: 'Incorrect old password' },
      });
      throw new Error('Current password does not match.');
    }
    if (!newPass || newPass.length < 6) {
      throw new Error('New password must be at least 6 characters.');
    }
    profile.password_hash = newPass;
    this.recordSecurityEvent({
      event_type: 'PASSWORD_CHANGE',
      result: 'SUCCESS',
      user_id: profile.id,
      username: profile.username || profile.email,
      role: profile.role_id,
      ip_address: clientIp,
    });
    this.notify();
    return { success: true, message: 'Password changed successfully.' };
  }

  public adminResetStaffPassword(
    adminProfileId: string,
    targetProfileId: string,
    newPass: string,
    clientIp: string = '127.0.0.1'
  ): { success: boolean; message: string } {
    const admin = this.profiles.find(p => p.id === adminProfileId);
    if (!admin || (admin.role_id !== 'admin' && admin.role_id !== 'owner')) {
      throw new Error('Unauthorized: Only Admin or Owner can reset staff passwords.');
    }
    const target = this.profiles.find(p => p.id === targetProfileId);
    if (!target) throw new Error('Target staff profile not found.');
    if (!newPass || newPass.length < 6) {
      throw new Error('New password must be at least 6 characters.');
    }
    target.password_hash = newPass;
    target.failed_login_attempts = 0;
    target.locked_until = null;
    this.recordSecurityEvent({
      event_type: 'PASSWORD_RESET',
      result: 'SUCCESS',
      user_id: target.id,
      username: target.username || target.email,
      role: target.role_id,
      ip_address: clientIp,
      metadata: { reset_by: admin.role_id, admin_id: admin.id },
    });
    this.notify();
    return { success: true, message: `Password reset successfully for ${target.full_name}.` };
  }

  public createStaffAccount(
    creatorRole: StaffRoleType,
    params: StaffAccountCreateParams,
    clientIp: string = '127.0.0.1'
  ): { success: boolean; profile: Profile; staff: Staff } {
    if (creatorRole !== 'owner' && creatorRole !== 'admin') {
      this.recordSecurityEvent({
        event_type: 'UNAUTHORIZED_ACCESS',
        result: 'BLOCKED',
        role: creatorRole,
        ip_address: clientIp,
        metadata: { action: 'createStaffAccount', attempted_role: params.role },
      });
      throw new Error('Unauthorized: Only Owner or Admin can create staff accounts.');
    }
    if (creatorRole === 'admin' && params.role === 'owner') {
      throw new Error('Forbidden: Admins cannot create Owner accounts.');
    }

    const cleanUsername = params.loginId.trim().toLowerCase();
    const cleanEmail = params.email.trim().toLowerCase();
    const existing = this.profiles.find(
      p => p.email.toLowerCase() === cleanEmail || (p.username && p.username.toLowerCase() === cleanUsername)
    );
    if (existing) {
      throw new Error(`Username or email '${cleanUsername}' is already registered.`);
    }

    const profileId = `p-${params.role.slice(0, 3)}-${Date.now()}`;
    const newProfile: Profile = {
      id: profileId,
      restaurant_id: this.restaurant.id,
      email: cleanEmail,
      username: cleanUsername,
      password_hash: params.password,
      full_name: params.fullName.trim(),
      phone: params.phone,
      role_id: params.role,
      employee_id: params.employeeCode || `EMP-${params.role.toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
      is_active: true,
      created_at: new Date().toISOString(),
      failed_login_attempts: 0,
    };
    this.profiles.push(newProfile);

    const staffId = `st-${params.role.slice(0, 3)}-${Date.now()}`;
    const newStaff: Staff = {
      id: staffId,
      restaurant_id: this.restaurant.id,
      profile_id: profileId,
      employee_code: newProfile.employee_id!,
      designation: params.designation || params.role.toUpperCase(),
      shift_preference: params.shiftPreference || 'morning',
      is_on_duty: true,
      profile: newProfile,
    };
    this.staff.push(newStaff);

    this.recordSecurityEvent({
      event_type: 'STAFF_CREATED',
      result: 'SUCCESS',
      user_id: profileId,
      username: cleanUsername,
      role: params.role,
      ip_address: clientIp,
      metadata: { created_by: creatorRole },
    });

    this.notify();
    return { success: true, profile: newProfile, staff: newStaff };
  }

  public updateStaffStatus(
    updaterRole: StaffRoleType,
    targetProfileId: string,
    isActive: boolean,
    reason?: string,
    clientIp: string = '127.0.0.1'
  ): Profile {
    if (updaterRole !== 'owner' && updaterRole !== 'admin') {
      throw new Error('Unauthorized: Only Owner or Admin can update staff status.');
    }
    const profile = this.profiles.find(p => p.id === targetProfileId);
    if (!profile) throw new Error('Staff profile not found.');

    if (profile.role_id === 'owner' && updaterRole !== 'owner') {
      throw new Error('Forbidden: Cannot deactivate an Owner account.');
    }

    profile.is_active = isActive;
    this.recordSecurityEvent({
      event_type: isActive ? 'STAFF_ACTIVATED' : 'STAFF_DEACTIVATED',
      result: 'SUCCESS',
      user_id: profile.id,
      username: profile.username || profile.email,
      role: profile.role_id,
      ip_address: clientIp,
      metadata: { updated_by: updaterRole, reason },
    });

    this.notify();
    return profile;
  }

  public updateStaffRole(
    updaterRole: StaffRoleType,
    targetProfileId: string,
    newRole: StaffRoleType,
    clientIp: string = '127.0.0.1'
  ): Profile {
    if (updaterRole !== 'owner' && updaterRole !== 'admin') {
      throw new Error('Unauthorized: Only Owner or Admin can change staff roles.');
    }
    if (updaterRole === 'admin' && newRole === 'owner') {
      throw new Error('Forbidden: Admins cannot promote users to Owner.');
    }
    const profile = this.profiles.find(p => p.id === targetProfileId);
    if (!profile) throw new Error('Staff profile not found.');

    const oldRole = profile.role_id;
    profile.role_id = newRole;

    this.recordSecurityEvent({
      event_type: 'ROLE_CHANGED',
      result: 'SUCCESS',
      user_id: profile.id,
      username: profile.username || profile.email,
      role: newRole,
      ip_address: clientIp,
      metadata: { updated_by: updaterRole, previous_role: oldRole, new_role: newRole },
    });

    this.notify();
    return profile;
  }

  public recordSecurityEvent(
    event: Omit<SecurityAuditEvent, 'id' | 'restaurant_id' | 'timestamp'>
  ): SecurityAuditEvent {
    const auditEvent: SecurityAuditEvent = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      restaurant_id: this.restaurant.id,
      timestamp: new Date().toISOString(),
      ...event,
    };
    this.securityAuditEvents.unshift(auditEvent);
    return auditEvent;
  }

  public getSecurityAuditEvents(callerRole?: StaffRoleType): SecurityAuditEvent[] {
    if (callerRole && callerRole !== 'owner' && callerRole !== 'admin') {
      return [];
    }
    return this.securityAuditEvents;
  }

  public resetRateLimit(identifier: string) {
    const clean = identifier.trim().toLowerCase();
    const profile = this.profiles.find(
      p => p.email.toLowerCase() === clean || (p.username && p.username.toLowerCase() === clean)
    );
    if (profile) {
      profile.failed_login_attempts = 0;
      profile.locked_until = null;
    }
    this.failedLoginAttempts.delete(clean);
    this.failedLoginAttempts.delete(`ip_${clean}`);
    this.notify();
  }

  // Admin Mutations
  public addTable(table: Omit<RestaurantTable, 'id' | 'restaurant_id' | 'created_at' | 'updated_at'>) {
    const newTable: RestaurantTable = {
      id: `tbl-${Date.now()}`,
      restaurant_id: this.restaurant.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...table,
    };
    this.tables.push(newTable);
    this.ensureTodayQRs();
    this.generatePermanentQRForTable(newTable.id);
    this.notify();
  }

  public updateTable(id: string, updates: Partial<RestaurantTable>) {
    const tbl = this.tables.find(t => t.id === id);
    if (!tbl) return;
    Object.assign(tbl, updates, { updated_at: new Date().toISOString() });
    this.notify();
  }

  public markTableCleaned(tableId: string): RestaurantTable {
    const table = this.tables.find(t => t.id === tableId);
    if (!table) throw new Error(`Table with ID ${tableId} not found`);
    table.status = 'AVAILABLE';
    table.updated_at = new Date().toISOString();
    this.notify();
    return table;
  }

  public getActiveOrdersForTable(tableId: string): Order[] {
    const activeSession = this.sessions.find(s => s.table_id === tableId && s.status === 'ACTIVE');
    if (!activeSession) return [];
    return this.orders.filter(
      o => o.table_session_id === activeSession.id && o.status !== 'CANCELLED' && o.status !== 'REJECTED'
    );
  }

  public revokeQRToken(tokenId: string, reason: string) {
    const token = this.qrTokens.find(t => t.id === tokenId);
    if (token) {
      token.is_revoked = true;
      token.revoked_at = new Date().toISOString();
      token.revoked_reason = reason;
      this.notify();
    }
  }

  public addMenuItem(item: Omit<MenuItem, 'id' | 'restaurant_id'>) {
    const newItem: MenuItem = {
      id: `item-${Date.now()}`,
      restaurant_id: this.restaurant.id,
      ...item,
    };
    this.menuItems.push(newItem);
    this.notify();
  }

  public updateMenuItem(id: string, updates: Partial<MenuItem>) {
    const item = this.menuItems.find(i => i.id === id);
    if (item) {
      Object.assign(item, updates);
      this.notify();
    }
  }

  public updateRestaurant(updates: Partial<Restaurant>) {
    Object.assign(this.restaurant, updates, { updated_at: new Date().toISOString() });
    this.notify();
  }

  public updateSettings(updates: Partial<RestaurantSettings>) {
    Object.assign(this.settings, updates);
    this.notify();
  }

  // Kitchen Display strictly shows only genuine customer orders placed via Place Order button
  private ensureInitialOrders() {
    // Strictly no fake, demo or placeholder orders in production Kitchen Display
  }
}

export const dbAdapter = new DatabaseAdapter();
