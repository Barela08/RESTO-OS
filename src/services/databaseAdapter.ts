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
} from '../types';
import { QRService } from './qrService';
import { audioService } from './audioService';
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
    { id: 'p-adm-1', restaurant_id: 'rest-001-main', email: 'admin@resto.os', full_name: 'Rajesh Sharma', phone: '+91 99000 11223', role_id: 'admin', is_active: true, created_at: new Date().toISOString() },
    { id: 'p-own-1', restaurant_id: 'rest-001-main', email: 'owner@resto.os', full_name: 'Vikramaditya Roy', phone: '+91 99000 22334', role_id: 'owner', is_active: true, created_at: new Date().toISOString() },
    { id: 'p-wtr-1', restaurant_id: 'rest-001-main', email: 'waiter@resto.os', full_name: 'Arun Kumar', phone: '+91 99000 33445', role_id: 'waiter', is_active: true, created_at: new Date().toISOString() },
    { id: 'p-kit-1', restaurant_id: 'rest-001-main', email: 'kitchen@resto.os', full_name: 'Chef Sanjeev Anand', phone: '+91 99000 44556', role_id: 'kitchen', is_active: true, created_at: new Date().toISOString() },
    { id: 'p-ctr-1', restaurant_id: 'rest-001-main', email: 'counter@resto.os', full_name: 'Priya Deshmukh', phone: '+91 99000 55667', role_id: 'counter', is_active: true, created_at: new Date().toISOString() },
  ];

  private staff: Staff[] = [
    { id: 'st-wtr-1', restaurant_id: 'rest-001-main', profile_id: 'p-wtr-1', employee_code: 'EMP-WTR-01', designation: 'Senior Captain', shift_preference: 'evening', is_on_duty: true, profile: this.profiles[2] },
    { id: 'st-kit-1', restaurant_id: 'rest-001-main', profile_id: 'p-kit-1', employee_code: 'EMP-KIT-01', designation: 'Head Chef', shift_preference: 'evening', is_on_duty: true, profile: this.profiles[3] },
    { id: 'st-ctr-1', restaurant_id: 'rest-001-main', profile_id: 'p-ctr-1', employee_code: 'EMP-CTR-01', designation: 'Cashier & POS Lead', shift_preference: 'evening', is_on_duty: true, profile: this.profiles[4] },
  ];

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

  constructor() {
    this.loadFromStorage();
    this.ensureTodayQRs();
    this.ensureInitialOrders();
  }

  private loadFromStorage() {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
      const saved = localStorage.getItem('resto_os_db_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.tables) this.tables = parsed.tables;
        if (parsed.qrTokens) this.qrTokens = parsed.qrTokens;
        if (parsed.sessions) this.sessions = parsed.sessions;
        if (parsed.orders) this.orders = parsed.orders;
        if (parsed.kitchenTickets) this.kitchenTickets = parsed.kitchenTickets;
        if (parsed.payments) this.payments = parsed.payments;
        if (parsed.invoices) this.invoices = parsed.invoices;
        if (parsed.repeatScanRequests) this.repeatScanRequests = parsed.repeatScanRequests;
        if (parsed.waiterCalls) this.waiterCalls = parsed.waiterCalls;
        if (parsed.customers) this.customers = parsed.customers;
        if (parsed.loyaltyAccounts) this.loyaltyAccounts = parsed.loyaltyAccounts;
        if (parsed.loyaltyRewards) this.loyaltyRewards = parsed.loyaltyRewards;
        if (parsed.notifications) this.notifications = parsed.notifications;
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
      };
      localStorage.setItem('resto_os_db_v2', JSON.stringify(payload));
    } catch {
      // LocalStorage quotas handled
    }
  }

  private notify() {
    this.saveToStorage();
    this.listeners.forEach(fn => fn());
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
    if (now > expiry || token.valid_date < getTodayDateString()) {
      return { valid: false, errorCode: 'EXPIRED_TOKEN', message: 'This QR code expired at midnight. Please ask staff for today’s code.' };
    }

    const table = this.tables.find(t => t.id === token.table_id);
    if (!table) {
      return { valid: false, errorCode: 'INVALID_TOKEN', message: 'Assigned table could not be found.' };
    }

    // Check if an active session exists on this table
    const activeSession = this.sessions.find(s => s.table_id === table.id && s.status === 'ACTIVE');

    if (activeSession) {
      // REPEAT SCAN DETECTED!
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

        this.addNotification({
          recipient_role: 'counter',
          title: `Repeat QR Scan: Table ${table.table_number}`,
          message: `Table ${table.table_number} was scanned again. Please approve or continue.`,
          event_type: 'REPEAT_SCAN',
          reference_id: repeatReq.id,
          sound_type: 'ALERT',
        });
        audioService.playRepeatScanAlert();
      }

      return {
        valid: true,
        isRepeatScan: true,
        repeatRequestId: repeatReq.id,
        table,
        session: activeSession,
        message: 'Repeat scan detected. Awaiting Cash Counter confirmation.',
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
  }): Order {
    const session = this.sessions.find(s => s.id === params.tableSessionId);
    if (!session || session.status !== 'ACTIVE') {
      throw new Error('Active table session required to place orders.');
    }

    const table = this.tables.find(t => t.id === session.table_id);
    if (!table) {
      throw new Error('Assigned table not found.');
    }

    const orderId = `ord-${Date.now()}`;
    const orderNumber = `ORD-${new Date().getHours()}${new Date().getMinutes()}-${Math.floor(100 + Math.random() * 900)}`;

    let subtotal = 0;
    const orderItems: OrderItem[] = [];

    // Group items by kitchen station
    const stationItemsMap: Record<string, OrderItem[]> = {};

    params.items.forEach((entry, idx) => {
      const menuItem = this.menuItems.find(m => m.id === entry.menuItemId);
      if (!menuItem) return;

      const addons = (entry.addonIds || [])
        .map(aid => this.menuAddons.find(a => a.id === aid))
        .filter((a): a is MenuAddon => Boolean(a));

      const addonsTotal = addons.reduce((sum, a) => sum + a.price, 0);
      const unitPrice = menuItem.base_price + addonsTotal;
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
  // 4. WAITER CALLS & SERVICE REQUESTS
  // ------------------------------------------------------------------
  public requestService(params: {
    tableSessionId: string;
    requestType: 'CALL_WAITER' | 'REQUEST_BILL' | 'ASSISTANCE' | 'WATER' | 'CLEANING';
    notes?: string;
  }): WaiterCall {
    const session = this.sessions.find(s => s.id === params.tableSessionId);
    if (!session) throw new Error('Valid table session required');

    const table = this.tables.find(t => t.id === session.table_id);
    const tableNumber = table ? table.table_number : 'T-00';

    const call: WaiterCall = {
      id: `call-${Date.now()}`,
      restaurant_id: this.restaurant.id,
      table_id: session.table_id,
      table_number: tableNumber,
      table_session_id: session.id,
      assigned_waiter_id: table?.current_waiter_id,
      request_type: params.requestType,
      status: 'PENDING',
      notes: params.notes,
      created_at: new Date().toISOString(),
    };

    this.waiterCalls.unshift(call);

    if (params.requestType === 'REQUEST_BILL') {
      if (table) table.status = 'PAYMENT_PENDING';
      this.addNotification({
        recipient_role: 'counter',
        title: `Bill Requested: Table ${tableNumber}`,
        message: `Customer at Table ${tableNumber} has requested the bill.`,
        event_type: 'BILL_REQUESTED',
        reference_id: call.id,
        sound_type: 'BELL',
      });
    }

    this.addNotification({
      recipient_role: 'waiter',
      title: `${params.requestType.replace('_', ' ')}: Table ${tableNumber}`,
      message: `Table ${tableNumber} needs immediate service.`,
      event_type: 'CALL_WAITER',
      reference_id: call.id,
      sound_type: 'BELL',
    });

    audioService.playWaiterCallBell();
    this.notify();

    return call;
  }

  public updateWaiterCallStatus(callId: string, status: 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'COMPLETED') {
    const call = this.waiterCalls.find(c => c.id === callId);
    if (!call) return;

    call.status = status;
    if (status === 'ACKNOWLEDGED') call.acknowledged_at = new Date().toISOString();
    if (status === 'COMPLETED') call.completed_at = new Date().toISOString();

    this.notify();
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
      const customer = this.customers.find(c => c.phone === customerPhone);
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

        // Check if 8 stamps reached
        if (loyalty.current_active_stamps >= this.settings.loyalty_stamps_for_reward) {
          loyalty.current_active_stamps -= this.settings.loyalty_stamps_for_reward;
          loyalty.total_rewards_unlocked += 1;

          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + this.settings.loyalty_reward_validity_days);

          this.loyaltyRewards.unshift({
            id: `rw-${Date.now()}`,
            restaurant_id: this.restaurant.id,
            loyalty_account_id: loyalty.id,
            voucher_code: `RW-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
            title: this.settings.loyalty_reward_name,
            description: `Unlocked after completing ${this.settings.loyalty_stamps_for_reward} orders at ${this.restaurant.name}.`,
            is_redeemed: false,
            expires_at: expiryDate.toISOString(),
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    this.notify();
    return { invoice, stampAwarded };
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
    this.notify();
  }

  public updateTable(id: string, updates: Partial<RestaurantTable>) {
    const tbl = this.tables.find(t => t.id === id);
    if (!tbl) return;
    Object.assign(tbl, updates, { updated_at: new Date().toISOString() });
    this.notify();
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

  // Pre-seed a few active orders for realistic initial dashboard views
  private ensureInitialOrders() {
    if (this.orders.length > 0) return;

    // Seed session for T-01
    const t1 = this.tables[0];
    const s1: TableSession = {
      id: 'ses-init-01',
      restaurant_id: this.restaurant.id,
      table_id: t1.id,
      table: t1,
      qr_token_id: 'qrt-t1',
      session_token: 'ses-token-t1',
      status: 'ACTIVE',
      opened_at: new Date(Date.now() - 35 * 60000).toISOString(),
      created_at: new Date(Date.now() - 35 * 60000).toISOString(),
      customer_name: 'Rahul Khanna',
      customer_phone: '+91 98888 77665',
    };
    this.sessions.push(s1);

    // Seed Order 1: PREPARING
    const o1Items: OrderItem[] = [
      { id: 'oi-init-1', order_id: 'ord-init-1', menu_item_id: 'item-4', item_name: 'Artisan Margherita Pizza', unit_price: 445.00, quantity: 1, total_price: 445.00, status: 'PREPARING', kitchen_station_id: 'stn-4' },
      { id: 'oi-init-2', order_id: 'ord-init-1', menu_item_id: 'item-9', item_name: 'Passionfruit Mint Sparkler', unit_price: 195.00, quantity: 2, total_price: 390.00, status: 'READY', kitchen_station_id: 'stn-2' },
    ];
    const o1Sub = 835.00;
    const o1: Order = {
      id: 'ord-init-1',
      restaurant_id: this.restaurant.id,
      order_number: 'ORD-1845-702',
      table_id: t1.id,
      table: t1,
      table_session_id: s1.id,
      waiter_id: 'st-wtr-1',
      customer_name: 'Rahul Khanna',
      customer_phone: '+91 98888 77665',
      subtotal_amount: o1Sub,
      cgst_amount: o1Sub * 0.025,
      sgst_amount: o1Sub * 0.025,
      service_charge_amount: 0,
      discount_amount: 0,
      total_amount: o1Sub * 1.05,
      status: 'PREPARING',
      items: o1Items,
      created_at: new Date(Date.now() - 25 * 60000).toISOString(),
      updated_at: new Date(Date.now() - 10 * 60000).toISOString(),
    };
    this.orders.push(o1);

    // Tickets for Order 1
    this.kitchenTickets.push({
      id: 'tkt-init-1',
      restaurant_id: this.restaurant.id,
      order_id: o1.id,
      order: o1,
      station_id: 'stn-4',
      station: this.kitchenStations[3],
      ticket_number: 'TKT-ORD-1845-702-1',
      status: 'PREPARING',
      items: [o1Items[0]],
      table_number: 'T-01',
      created_at: new Date(Date.now() - 25 * 60000).toISOString(),
      updated_at: new Date().toISOString(),
    });

    this.kitchenTickets.push({
      id: 'tkt-init-2',
      restaurant_id: this.restaurant.id,
      order_id: o1.id,
      order: o1,
      station_id: 'stn-2',
      station: this.kitchenStations[1],
      ticket_number: 'TKT-ORD-1845-702-2',
      status: 'READY',
      items: [o1Items[1]],
      table_number: 'T-01',
      created_at: new Date(Date.now() - 25 * 60000).toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Seed session for T-04: PAYMENT_PENDING
    const t4 = this.tables[3];
    const s4: TableSession = {
      id: 'ses-init-04',
      restaurant_id: this.restaurant.id,
      table_id: t4.id,
      table: t4,
      qr_token_id: 'qrt-t4',
      session_token: 'ses-token-t4',
      status: 'PAYMENT_PENDING',
      opened_at: new Date(Date.now() - 75 * 60000).toISOString(),
      created_at: new Date(Date.now() - 75 * 60000).toISOString(),
      customer_name: 'Anita Roy',
      customer_phone: '+91 97777 55443',
    };
    this.sessions.push(s4);

    const o4Items: OrderItem[] = [
      { id: 'oi-init-3', order_id: 'ord-init-4', menu_item_id: 'item-7', item_name: 'Old Delhi Butter Chicken', unit_price: 495.00, quantity: 2, total_price: 990.00, status: 'SERVED', kitchen_station_id: 'stn-1' },
      { id: 'oi-init-4', order_id: 'ord-init-4', menu_item_id: 'item-11', item_name: 'Belgian Dark Chocolate Molten Lava', unit_price: 295.00, quantity: 2, total_price: 590.00, status: 'SERVED', kitchen_station_id: 'stn-3' },
    ];
    const o4Sub = 1580.00;
    const o4: Order = {
      id: 'ord-init-4',
      restaurant_id: this.restaurant.id,
      order_number: 'ORD-1750-418',
      table_id: t4.id,
      table: t4,
      table_session_id: s4.id,
      waiter_id: 'st-wtr-1',
      customer_name: 'Anita Roy',
      customer_phone: '+91 97777 55443',
      subtotal_amount: o4Sub,
      cgst_amount: o4Sub * 0.025,
      sgst_amount: o4Sub * 0.025,
      service_charge_amount: 0,
      discount_amount: 0,
      total_amount: o4Sub * 1.05,
      status: 'SERVED',
      items: o4Items,
      created_at: new Date(Date.now() - 60 * 60000).toISOString(),
      updated_at: new Date(Date.now() - 15 * 60000).toISOString(),
    };
    this.orders.push(o4);

    // Pending Cash Payment for T-04
    this.payments.push({
      id: 'pay-init-4',
      restaurant_id: this.restaurant.id,
      table_session_id: s4.id,
      table_id: t4.id,
      order_id: o4.id,
      amount: o4.total_amount,
      payment_method: 'CASH',
      payment_status: 'PENDING',
      created_at: new Date(Date.now() - 10 * 60000).toISOString(),
    });

    // Sample paid invoice
    this.invoices.push({
      id: 'inv-init-prev',
      restaurant_id: this.restaurant.id,
      invoice_number: 'INV-202611-1024',
      payment_id: 'pay-prev-1',
      table_session_id: 'ses-prev',
      table_id: 'tbl-2',
      customer_name: 'Sameer Joshi',
      customer_phone: '+91 98888 77665',
      subtotal_amount: 1200.00,
      cgst_rate: 2.5,
      cgst_amount: 30.00,
      sgst_rate: 2.5,
      sgst_amount: 30.00,
      service_charge_amount: 0,
      discount_amount: 0,
      total_amount: 1260.00,
      payment_method: 'UPI',
      transaction_ref: 'UPI-AXIS-99238472',
      issued_at: new Date(Date.now() - 120 * 60000).toISOString(),
    });
  }
}

export const dbAdapter = new DatabaseAdapter();
