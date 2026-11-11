import { describe, it, expect, beforeEach } from 'vitest';
import { dbAdapter } from '../src/services/databaseAdapter';
import { TableSession } from '../src/types';

describe('RESTO OS: Critical Bug Fixes & Workflow Verification', () => {
  const getOrCreateActiveSession = (tableIndex = 0): TableSession => {
    const table = dbAdapter.getTables()[tableIndex] || dbAdapter.getTables()[0];
    let session = dbAdapter.getSessions().find(s => s.table_id === table.id && s.status === 'ACTIVE');
    if (!session) {
      session = {
        id: `ses-test-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        restaurant_id: dbAdapter.getRestaurant().id,
        table_id: table.id,
        table,
        session_token: `stok-${Date.now()}`,
        status: 'ACTIVE',
        opened_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      (dbAdapter as any).sessions.push(session);
    }
    return session;
  };

  // =========================================================================
  // FIX 1: Kitchen Display – Show Only Real Customer Orders
  // =========================================================================
  describe('Fix 1: Kitchen Display - Show Only Real Customer Orders', () => {
    it('KD-01: System does not seed fake/demo initial orders or tickets on boot', () => {
      // Filter any orders that were created by explicit test actions vs hardcoded initial ones
      const initialDemoOrders = dbAdapter.getOrders().filter(o => o.id.startsWith('ord-init-'));
      const initialDemoTickets = dbAdapter.getKitchenTickets().filter(t => t.id.startsWith('tkt-init-'));

      expect(initialDemoOrders.length).toBe(0);
      expect(initialDemoTickets.length).toBe(0);
    });

    it('KD-02: Merely opening menu, viewing bag or creating session creates ZERO kitchen tickets', () => {
      const ticketsBefore = dbAdapter.getKitchenTickets().length;
      const ordersBefore = dbAdapter.getOrders().length;

      // Simulate customer browsing menu and starting session
      const session = getOrCreateActiveSession(0);
      const categories = dbAdapter.getCategories();
      const items = dbAdapter.getMenuItems();

      expect(session).toBeDefined();
      expect(categories.length).toBeGreaterThan(0);
      expect(items.length).toBeGreaterThan(0);

      // No orders or tickets should have been created by browsing
      expect(dbAdapter.getOrders().length).toBe(ordersBefore);
      expect(dbAdapter.getKitchenTickets().length).toBe(ticketsBefore);
    });

    it('KD-03: An order and kitchen ticket appear ONLY when Place Order is explicitly invoked', () => {
      const session = getOrCreateActiveSession(0);
      const items = dbAdapter.getMenuItems();
      const testItem = items[0];

      const ordersBefore = dbAdapter.getOrders().length;
      const ticketsBefore = dbAdapter.getKitchenTickets().length;

      const order = dbAdapter.placeOrder({
        tableSessionId: session.id,
        items: [{ menuItemId: testItem.id, quantity: 2, specialInstructions: 'Extra spicy' }],
        customerName: 'Real Diner',
        customerPhone: '+91 98888 11111',
      });

      expect(order).toBeDefined();
      expect(order.id).toBeTruthy();
      expect(order.status).toBe('PLACED');
      expect(order.items.length).toBe(1);
      expect(order.table_id).toBe(session.table_id);

      // Exactly 1 new order added
      expect(dbAdapter.getOrders().length).toBe(ordersBefore + 1);

      // Kitchen tickets created for this order
      const newTickets = dbAdapter.getKitchenTickets().filter(t => t.order_id === order.id);
      expect(newTickets.length).toBeGreaterThanOrEqual(1);
      expect(newTickets[0].status).toBe('NEW');
      expect(newTickets[0].items.some(ti => ti.item_name === testItem.name)).toBe(true);
      expect(dbAdapter.getKitchenTickets().length).toBe(ticketsBefore + newTickets.length);
    });
  });

  // =========================================================================
  // FIX 2: Waiter Panel – Food Table & Waiter Assigned Actions
  // =========================================================================
  describe('Fix 2: Waiter Panel - Food Table Action & Waiter Assignments', () => {
    it('WP-01: Waiter can filter tables assigned to their staff ID vs all tables', () => {
      const allTables = dbAdapter.getTables();
      const waiterId = 'st-wtr-1';

      // Ensure at least one table is assigned to st-wtr-1
      dbAdapter.updateTable(allTables[0].id, { waiter_id: waiterId });

      const myAssignedTables = dbAdapter.getTables().filter(t => t.waiter_id === waiterId);
      expect(myAssignedTables.length).toBeGreaterThanOrEqual(1);
      expect(myAssignedTables.every(t => t.waiter_id === waiterId)).toBe(true);
    });

    it('WP-02: Waiter can inspect table details, orders and update table/order status', () => {
      const session = getOrCreateActiveSession(1);
      const table = dbAdapter.getTables().find(t => t.id === session.table_id)!;
      const waiterId = 'st-wtr-1';

      // Assign table to waiter
      dbAdapter.updateTable(table.id, { waiter_id: waiterId, status: 'OCCUPIED' });
      const updatedTable = dbAdapter.getTables().find(t => t.id === table.id)!;
      expect(updatedTable.waiter_id).toBe(waiterId);
      expect(updatedTable.status).toBe('OCCUPIED');

      // Place order on this table
      const items = dbAdapter.getMenuItems();
      const order = dbAdapter.placeOrder({
        tableSessionId: session.id,
        items: [{ menuItemId: items[0].id, quantity: 1 }],
      });

      // Waiter marks order as SERVED
      dbAdapter.markOrderServed(order.id);
      const servedOrder = dbAdapter.getOrders().find(o => o.id === order.id)!;
      expect(servedOrder.status).toBe('SERVED');

      // Waiter clears and marks table AVAILABLE
      dbAdapter.updateTable(table.id, { status: 'AVAILABLE' });
      const availableTable = dbAdapter.getTables().find(t => t.id === table.id)!;
      expect(availableTable.status).toBe('AVAILABLE');
    });
  });

  // =========================================================================
  // FIX 3: Customer Rewards – Fix Claim Stamp / Claim Reward
  // =========================================================================
  describe('Fix 3: Customer Rewards - Milestone Stamp & Reward Claiming', () => {
    const rewardCustomerPhone = '+91 99999 88877';
    const rewardCustomerName = 'Anita Sharma';

    it('RWD-01: Paid order >= ₹250 awards 1 stamp without premature deduction at 8 stamps', () => {
      const { customer: cust, loyalty } = dbAdapter.registerLoyaltyCustomer(rewardCustomerName, rewardCustomerPhone);

      // Set current stamps to 7
      loyalty.current_active_stamps = 7;

      const session = getOrCreateActiveSession(0);
      const items = dbAdapter.getMenuItems();
      const order = dbAdapter.placeOrder({
        tableSessionId: session.id,
        items: [{ menuItemId: items[0].id, quantity: 3 }], // >= ₹250
        customerPhone: rewardCustomerPhone,
        customerName: rewardCustomerName,
      });

      const payment = dbAdapter.initiateCustomerPayment({
        tableSessionId: session.id,
        method: 'CASH',
        customerPhone: rewardCustomerPhone,
      });

      const { stampAwarded } = dbAdapter.confirmPayment({
        paymentId: payment.id,
        staffId: 'st-ctr-1',
        cashReceivedAmount: 3000,
      });

      expect(stampAwarded).toBe(true);

      // Verify stamps count is now exactly 8 (not reset to 0 before customer claims)
      const updatedLoyalty = dbAdapter.getLoyaltyAccounts().find(l => l.customer_id === cust.id)!;
      expect(updatedLoyalty.current_active_stamps).toBe(8);
    });

    it('RWD-02: Customer claims 8-stamp reward: deducts 8 stamps, issues unique CLM- code and CLAIMED status', () => {
      const cust = dbAdapter.getCustomers().find(c => dbAdapter.normalizePhoneNumber(c.phone) === dbAdapter.normalizePhoneNumber(rewardCustomerPhone))!;
      const loyalty = dbAdapter.getLoyaltyAccounts().find(l => l.customer_id === cust.id)!;
      expect(loyalty.current_active_stamps).toBe(8);

      const result = dbAdapter.claimLoyaltyReward({ customerId: cust.id });

      expect(result.success).toBe(true);
      expect(result.reward).toBeDefined();
      expect(result.reward.is_claimed).toBe(true);
      expect(result.reward.reward_code).toMatch(/^CLM-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(result.redemption.status).toBe('CLAIMED');

      // Verify 8 stamps deducted
      const refreshedLoyalty = dbAdapter.getLoyaltyAccounts().find(l => l.customer_id === cust.id)!;
      expect(refreshedLoyalty.current_active_stamps).toBe(0);
    });

    it('RWD-03: Double claim with insufficient stamps is strictly rejected', () => {
      const cust = dbAdapter.getCustomers().find(c => dbAdapter.normalizePhoneNumber(c.phone) === dbAdapter.normalizePhoneNumber(rewardCustomerPhone))!;
      const loyalty = dbAdapter.getLoyaltyAccounts().find(l => l.customer_id === cust.id)!;
      expect(loyalty.current_active_stamps).toBe(0);

      expect(() => {
        dbAdapter.claimLoyaltyReward({ customerId: cust.id });
      }).toThrow(/Insufficient stamps/);
    });
  });

  // =========================================================================
  // FIX 4: Customer Number Recognition – Returning vs New
  // =========================================================================
  describe('Fix 4: Existing Customer Number Recognition', () => {
    const existingPhone = '+91 98765 43210';
    const existingName = 'Rajesh Kumar';

    beforeEach(() => {
      // Ensure customer exists
      const existing = dbAdapter.getCustomers().find(c => dbAdapter.normalizePhoneNumber(c.phone) === dbAdapter.normalizePhoneNumber(existingPhone));
      if (!existing) {
        dbAdapter.registerLoyaltyCustomer(existingName, existingPhone);
      }
    });

    it('REC-01: Existing phone number is recognized without asking for name or creating duplicates', () => {
      const countBefore = dbAdapter.getCustomers().length;

      const result = dbAdapter.lookupOrRecognizeCustomer(existingPhone);

      expect(result.isExisting).toBe(true);
      expect(result.customer).toBeDefined();
      expect(result.customer?.full_name).toBe(existingName);
      expect(result.loyalty).toBeDefined();

      // No new customer created
      expect(dbAdapter.getCustomers().length).toBe(countBefore);
    });

    it('REC-02: New phone number returns isExisting: false without throwing or corrupting state', () => {
      const brandNewPhone = '+91 91111 22233';
      const result = dbAdapter.lookupOrRecognizeCustomer(brandNewPhone);

      expect(result.isExisting).toBe(false);
      expect(result.customer).toBeUndefined();
      expect(result.loyalty).toBeUndefined();
    });
  });

  // =========================================================================
  // FIX 5: Cash Counter – Automatic Verified Table Identification
  // =========================================================================
  describe('Fix 5: Cash Counter - Automatic Verified Table Identification', () => {
    it('CC-01: Cash payments and verification requests carry verified table ID automatically', () => {
      const session = getOrCreateActiveSession(2);
      const items = dbAdapter.getMenuItems();

      const order = dbAdapter.placeOrder({
        tableSessionId: session.id,
        items: [{ menuItemId: items[0].id, quantity: 1 }],
      });

      const payment = dbAdapter.initiateCustomerPayment({
        tableSessionId: session.id,
        method: 'CASH',
      });

      // Verify payment is bound to session table_id
      expect(payment.table_id).toBe(session.table_id);

      const cashPending = dbAdapter.getPayments().find(p => p.id === payment.id);
      expect(cashPending?.table_id).toBe(session.table_id);
    });

    it('CC-02: Cash counter can verify and redeem claimed CLM- voucher code', () => {
      // Create a customer with a claimed reward
      const phone = '+91 97777 00011';
      const { customer: cust, loyalty } = dbAdapter.registerLoyaltyCustomer('Voucher User', phone);
      loyalty.current_active_stamps = 8;

      const claimRes = dbAdapter.claimLoyaltyReward({ customerId: cust.id });
      const voucherCode = claimRes.reward.reward_code!;

      // Cash counter verifies code
      const verifyRes = dbAdapter.verifyRewardCode(voucherCode);
      expect(verifyRes.valid).toBe(true);
      expect(verifyRes.customer?.id).toBe(cust.id);
      expect(verifyRes.reward?.reward_code).toBe(voucherCode);

      // Cash counter confirms redemption
      const redeemRes = dbAdapter.redeemRewardCode({
        redemptionCode: voucherCode,
        staffId: 'st-ctr-1',
      });

      expect(redeemRes.success).toBe(true);
      expect(redeemRes.redemption.status).toBe('REDEEMED');
      expect(redeemRes.redemption.redeemed_at).toBeDefined();

      // Second redemption must fail
      expect(() => {
        dbAdapter.redeemRewardCode({
          redemptionCode: voucherCode,
          staffId: 'st-ctr-1',
        });
      }).toThrow(/already redeemed/);
    });
  });

  // =========================================================================
  // FIX 6: Permanent QR Security & Cross-Table Prevention
  // =========================================================================
  describe('Fix 6: Permanent QR Security & Cross-Table Tampering Prevention', () => {
    it('SEC-01: An order strictly belongs to the table verified by the active session token', () => {
      const table3 = dbAdapter.getTables()[2]; // e.g. Table 3
      const table5 = dbAdapter.getTables()[4]; // e.g. Table 5

      const session3 = getOrCreateActiveSession(2);
      expect(session3.table_id).toBe(table3.id);

      const items = dbAdapter.getMenuItems();
      const order = dbAdapter.placeOrder({
        tableSessionId: session3.id,
        items: [{ menuItemId: items[0].id, quantity: 1 }],
      });

      // The order MUST belong to Table 3, never Table 5
      expect(order.table_id).toBe(table3.id);
      expect(order.table_id).not.toBe(table5.id);
      expect(order.table?.id).toBe(table3.id);
    });

    it('SEC-02: Placing an order with an invalid or closed session throws error', () => {
      const items = dbAdapter.getMenuItems();

      expect(() => {
        dbAdapter.placeOrder({
          tableSessionId: 'ses-fake-non-existent-999',
          items: [{ menuItemId: items[0].id, quantity: 1 }],
        });
      }).toThrow(/Active table session required/);
    });
  });
});
