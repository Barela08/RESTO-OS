import { describe, it, expect, beforeEach } from 'vitest';
import { dbAdapter } from '../src/services/databaseAdapter';
import { useCustomerAuthStore } from '../src/store/customerAuthStore';

describe('Comprehensive Backend Services & Business Rules', () => {
  beforeEach(() => {
    dbAdapter.ensureTodayQRs();
    dbAdapter.ensurePermanentQRs();
  });

  describe('1. Permanent Table QR & Cryptographic Integrity', () => {
    it('generates permanent QR tokens for all dining tables with never-expiring validity', () => {
      const tables = dbAdapter.getTables();
      expect(tables.length).toBeGreaterThan(0);

      const firstTable = tables[0];
      const permToken = dbAdapter.getPermanentQRForTable(firstTable.id);
      expect(permToken).toBeDefined();
      expect(permToken?.is_permanent).toBe(true);
      expect(permToken?.expires_at).toBe('9999-12-31T23:59:59.000Z');
      expect(permToken?.is_revoked).toBe(false);
    });

    it('successfully verifies a permanent table QR and resolves table session', () => {
      const tables = dbAdapter.getTables();
      const table = tables[0];
      const permToken = dbAdapter.getPermanentQRForTable(table.id);
      expect(permToken).toBeDefined();

      if (permToken) {
        const verifyResult = dbAdapter.verifyQRToken(permToken.token_hash);
        expect(verifyResult.valid).toBe(true);
        expect(verifyResult.table).toBeDefined();
        expect(verifyResult.table?.id).toBe(table.id);
        expect(verifyResult.session).toBeDefined();
        expect(verifyResult.session?.table_id).toBe(table.id);
      }
    });

    it('rejects tampered or unauthorized table QR tokens', () => {
      const result = dbAdapter.verifyQRToken('perm-tampered-fake-token-999');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_TOKEN');
    });

    it('respects revocation on permanent QR codes', () => {
      const table = dbAdapter.getTables()[1];
      const permToken = dbAdapter.getPermanentQRForTable(table.id);
      expect(permToken).toBeDefined();

      if (permToken) {
        dbAdapter.revokeQRToken(permToken.id, 'Stolen standee');
        const verifyResult = dbAdapter.verifyQRToken(permToken.token_hash);
        expect(verifyResult.valid).toBe(false);
        expect(verifyResult.errorCode).toBe('REVOKED_TOKEN');
      }
    });
  });

  describe('2. Server-Side Order Totals & Idempotency', () => {
    it('calculates order subtotal, CGST, SGST, and total on the server', () => {
      const menu = dbAdapter.getMenuItems();
      expect(menu.length).toBeGreaterThan(0);

      const testItems = [
        {
          menuItemId: menu[0].id,
          quantity: 2,
        },
      ];

      const totals = dbAdapter.calculateCartTotals(testItems);
      const expectedSubtotal = menu[0].base_price * 2;
      const expectedCgst = Math.round(expectedSubtotal * 0.025 * 100) / 100;
      const expectedSgst = Math.round(expectedSubtotal * 0.025 * 100) / 100;
      const expectedTotal = Math.round((expectedSubtotal + expectedCgst + expectedSgst) * 100) / 100;

      expect(totals.subtotal).toBe(expectedSubtotal);
      expect(totals.cgst).toBe(expectedCgst);
      expect(totals.sgst).toBe(expectedSgst);
      expect(totals.total).toBe(expectedTotal);
    });

    it('prevents duplicate order creation using idempotency keys', () => {
      const tables = dbAdapter.getTables();
      const table = tables[0];
      const session = dbAdapter.getOrCreateActiveSession(table.id);
      const menu = dbAdapter.getMenuItems();
      const idempotencyKey = `idem-test-backend-${Date.now()}`;

      const items = [
        {
          menuItemId: menu[0].id,
          quantity: 1,
        },
      ];

      // First order placement
      const order1 = dbAdapter.placeOrder({
        tableSessionId: session.id,
        items,
        notes: 'Less spicy',
        idempotencyKey,
      });

      expect(order1).toBeDefined();
      expect(order1.idempotency_key).toBe(idempotencyKey);

      // Duplicate placement with identical key must return existing order
      const order2 = dbAdapter.placeOrder({
        tableSessionId: session.id,
        items,
        notes: 'Less spicy',
        idempotencyKey,
      });

      expect(order2.id).toBe(order1.id);
      expect(order2.order_number).toBe(order1.order_number);
    });
  });

  describe('3. Waiter Service Requests & Bill Requests', () => {
    it('creates and updates service requests (waiter calls, cutlery, water)', () => {
      const tables = dbAdapter.getTables();
      const table = tables[0];
      const session = dbAdapter.getOrCreateActiveSession(table.id);

      const req = dbAdapter.createServiceRequest({
        tableSessionId: session.id,
        requestType: 'WATER',
        notes: 'Cold water please',
      });

      expect(req).toBeDefined();
      expect(req.request_type).toBe('WATER');
      expect(req.status).toBe('PENDING');

      // Update status to COMPLETED
      const updated = dbAdapter.updateServiceRequestStatus(req.id, 'COMPLETED', 'staff-waiter-01');
      expect(updated?.status).toBe('COMPLETED');
      expect(updated?.assigned_staff_id).toBe('staff-waiter-01');
      expect(updated?.resolved_at).toBeDefined();
    });

    it('creates and resolves bill requests with designated payment mode', () => {
      const tables = dbAdapter.getTables();
      const table = tables[0];
      const session = dbAdapter.getOrCreateActiveSession(table.id);

      const billReq = dbAdapter.createBillRequest({
        tableSessionId: session.id,
        paymentMethodPreference: 'UPI',
        notes: 'Need split bill if possible',
      });

      expect(billReq).toBeDefined();
      expect(billReq.payment_method_preference).toBe('UPI');
      expect(billReq.status).toBe('PENDING');

      const resolved = dbAdapter.updateBillRequestStatus(billReq.id, 'COMPLETED', 'counter-staff-01');
      expect(resolved.status).toBe('COMPLETED');
    });
  });

  describe('4. Customer OTP Authentication & Identity Resolution', () => {
    it('sends OTP, verifies phone, and links existing customer profile', () => {
      const auth = useCustomerAuthStore.getState();

      // Request OTP
      const phone = '9888877665';
      const sendRes = auth.requestOtp(phone);
      expect(sendRes.success).toBe(true);
      expect(sendRes.otpCode).toBeDefined();

      // Verify OTP
      const verifyRes = auth.verifyOtp(phone, sendRes.otpCode!);
      expect(verifyRes.success).toBe(true);

      const state = useCustomerAuthStore.getState();
      expect(state.isLoggedIn).toBe(true);
      expect(state.customer).toBeDefined();
      expect(state.customer?.full_name).toBe('Aditya Verma');
    });

    it('registers new customer name and persists profile', () => {
      const auth = useCustomerAuthStore.getState();
      const uniquePhone = `91${Math.floor(10000000 + Math.random() * 90000000)}`;

      const otpRes = auth.requestOtp(uniquePhone);
      expect(otpRes.success).toBe(true);
      const verifyRes = auth.verifyOtp(uniquePhone, otpRes.otpCode!);
      expect(verifyRes.success).toBe(true);
      expect(verifyRes.isExistingCustomer).toBe(false);

      auth.completeRegistration(uniquePhone, 'Aarav Sharma');

      const updatedState = useCustomerAuthStore.getState();
      expect(updatedState.customer?.full_name).toBe('Aarav Sharma');
    });
  });

  describe('5. Loyalty Rewards & Staff Redemption', () => {
    it('creates claimable reward code and verifies it via counter staff', () => {
      const customers = dbAdapter.getCustomers();
      const customer = customers[0];
      const loyalty = dbAdapter.getLoyaltyAccounts().find(l => l.customer_id === customer.id) || dbAdapter.getLoyaltyAccounts()[0];

      // Create an unlocked reward for test customer
      const rewardItem = {
        id: `rw-test-${Date.now()}`,
        restaurant_id: dbAdapter.getRestaurant().id,
        loyalty_account_id: loyalty.id,
        voucher_code: `RW-TEST-${Date.now()}`,
        title: 'Free Artisanal Dessert',
        description: 'Unlocked reward voucher',
        is_redeemed: false,
        expires_at: new Date(Date.now() + 86400000 * 30).toISOString(),
        created_at: new Date().toISOString(),
      };
      dbAdapter.getLoyaltyRewards().push(rewardItem);

      // Claim reward code
      const { reward } = dbAdapter.claimLoyaltyReward({
        customerId: customer.id,
        rewardId: rewardItem.id,
      });

      expect(reward).toBeDefined();
      expect(reward.redemption_code).toMatch(/^CLM-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(reward.is_redeemed).toBe(false);

      // Verify reward code
      const checkResult = dbAdapter.verifyRewardCode(reward.redemption_code!);
      expect(checkResult.valid).toBe(true);
      expect(checkResult.reward?.id).toBe(reward.id);

      // Redeem code
      const redeemResult = dbAdapter.redeemRewardCode({
        redemptionCode: reward.redemption_code!,
        staffId: 'staff-counter-01',
      });

      expect(redeemResult.reward.is_redeemed).toBe(true);
      expect(redeemResult.redemption.redemption_code).toBe(reward.redemption_code);

      // Subsequent verification must fail as already redeemed
      const checkAgain = dbAdapter.verifyRewardCode(reward.redemption_code!);
      expect(checkAgain.valid).toBe(false);
      expect(checkAgain.message).toContain('already redeemed');
    });
  });

  describe('6. Customer Feedback & Staff Attendance', () => {
    it('records customer feedback rating and notes', () => {
      const tables = dbAdapter.getTables();
      const table = tables[0];

      const feedback = dbAdapter.submitCustomerFeedback({
        table_id: table.id,
        food_rating: 5,
        service_rating: 5,
        ambience_rating: 4,
        comments: 'Outstanding dining experience!',
      });

      expect(feedback).toBeDefined();
      expect(feedback.food_rating).toBe(5);
      expect(feedback.service_rating).toBe(5);

      const allFeedback = dbAdapter.getCustomerFeedback();
      expect(allFeedback.some(f => f.id === feedback.id)).toBe(true);
    });

    it('records staff attendance punches', () => {
      const staffList = dbAdapter.getStaff();
      expect(staffList.length).toBeGreaterThan(0);
      const staffMember = staffList[0];

      const punch = dbAdapter.recordAttendancePunch(staffMember.id, undefined, 'Shift started on time');

      expect(punch).toBeDefined();
      expect(punch.staff_id).toBe(staffMember.id);
      expect(punch.check_in_time).toBeDefined();

      const attendanceRecords = dbAdapter.getAttendance();
      expect(attendanceRecords.some(a => a.id === punch.id)).toBe(true);
    });
  });
});
