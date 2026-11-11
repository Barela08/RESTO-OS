import { describe, it, expect, beforeEach } from 'vitest';
import { dbAdapter } from '../src/services/databaseAdapter';

describe('Module 4: Digital Stamp Claim & Reward System', () => {
  const customerPhone = '+91 97777 66554';
  const customerName = 'Kavita Nair';

  const getOrCreateActiveSession = () => {
    let session = dbAdapter.getSessions().find(s => s.status === 'ACTIVE');
    if (!session) {
      const table = dbAdapter.getTables()[0];
      session = {
        id: `ses-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
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

  beforeEach(() => {
    // Register customer
    dbAdapter.registerLoyaltyCustomer(customerName, customerPhone);
  });

  it('RWD-01: Confirmed payment awards exactly one digital stamp for eligible order', () => {
    const session = getOrCreateActiveSession();
    const items = dbAdapter.getMenuItems();
    const order = dbAdapter.placeOrder({
      tableSessionId: session.id,
      items: [{ menuItemId: items[0].id, quantity: 2 }],
      customerPhone,
      customerName,
    });

    const customer = dbAdapter.getCustomers().find(c => dbAdapter.normalizePhoneNumber(c.phone) === dbAdapter.normalizePhoneNumber(customerPhone));
    const initialLoyalty = dbAdapter.getLoyaltyAccounts().find(l => l.customer_id === customer?.id);
    const initialStamps = initialLoyalty?.current_active_stamps || 0;

    const payment = dbAdapter.initiateCustomerPayment({
      tableSessionId: session.id,
      method: 'CASH',
      customerPhone,
    });

    const { stampAwarded } = dbAdapter.confirmPayment({
      paymentId: payment.id,
      staffId: 'st-ctr-1',
      cashReceivedAmount: 2000,
    });

    expect(stampAwarded).toBe(true);

    const updatedLoyalty = dbAdapter.getLoyaltyAccounts().find(l => l.customer_id === customer?.id);
    expect(updatedLoyalty?.current_active_stamps).toBe(initialStamps + 1);
    expect(updatedLoyalty?.total_stamps_earned).toBeGreaterThanOrEqual(1);
  });

  it('RWD-02: Reaching 8 stamps unlocks a new loyalty reward voucher', () => {
    const customer = dbAdapter.getCustomers().find(c => dbAdapter.normalizePhoneNumber(c.phone) === dbAdapter.normalizePhoneNumber(customerPhone));
    const loyalty = dbAdapter.getLoyaltyAccounts().find(l => l.customer_id === customer?.id);
    expect(loyalty).toBeDefined();

    // Fast-forward stamps to 7
    if (loyalty) {
      loyalty.current_active_stamps = 7;
    }

    const session = getOrCreateActiveSession();
    const items = dbAdapter.getMenuItems();
    dbAdapter.placeOrder({
      tableSessionId: session.id,
      items: [{ menuItemId: items[0].id, quantity: 2 }],
      customerPhone,
      customerName,
    });

    const payment = dbAdapter.initiateCustomerPayment({
      tableSessionId: session.id,
      method: 'CASH',
      customerPhone,
    });

    const { stampAwarded } = dbAdapter.confirmPayment({
      paymentId: payment.id,
      staffId: 'st-ctr-1',
      cashReceivedAmount: 2000,
    });

    expect(stampAwarded).toBe(true);

    const updatedLoyalty = dbAdapter.getLoyaltyAccounts().find(l => l.customer_id === customer?.id);
    // 8 stamps completed: customer has 8 active stamps ready to claim
    expect(updatedLoyalty?.current_active_stamps).toBe(8);

    // Customer claims the 8-stamp reward voucher
    const claimRes = dbAdapter.claimLoyaltyReward({ customerId: customer!.id });
    expect(claimRes.success).toBe(true);
    expect(updatedLoyalty?.current_active_stamps).toBe(0);
    expect(updatedLoyalty?.total_rewards_unlocked).toBeGreaterThanOrEqual(1);

    const customerRewards = dbAdapter.getLoyaltyRewards().filter(r => r.loyalty_account_id === loyalty?.id);
    expect(customerRewards.length).toBeGreaterThanOrEqual(1);
    expect(customerRewards[0].is_redeemed).toBe(false);
  });

  it('RWD-03: Claiming reward generates unique CLM-XXXX-XXXX redemption code', () => {
    const customer = dbAdapter.getCustomers().find(c => dbAdapter.normalizePhoneNumber(c.phone) === dbAdapter.normalizePhoneNumber(customerPhone));
    const loyalty = dbAdapter.getLoyaltyAccounts().find(l => l.customer_id === customer?.id);
    let customerRewards = dbAdapter.getLoyaltyRewards().filter(r => r.loyalty_account_id === loyalty?.id && !r.is_redeemed);
    
    // If no reward exists yet, seed one
    if (customerRewards.length === 0 && loyalty) {
      const newReward = {
        id: `rw-test-${Date.now()}`,
        restaurant_id: dbAdapter.getRestaurant().id,
        loyalty_account_id: loyalty.id,
        voucher_code: `RW-TEST-${Date.now()}`,
        reward_title: 'Complimentary Mocktail',
        reward_type: 'FREE_ITEM' as const,
        discount_percentage: 100,
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        is_redeemed: false,
        created_at: new Date().toISOString(),
      };
      (dbAdapter as any).loyaltyRewards.unshift(newReward);
      customerRewards = [newReward];
    }

    const targetReward = customerRewards[0];
    const { reward } = dbAdapter.claimLoyaltyReward({
      customerId: customer!.id,
      rewardId: targetReward.id,
    });

    expect(reward.redemption_code).toBeDefined();
    expect(reward.redemption_code).toMatch(/^CLM-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(reward.is_redeemed).toBe(false);
  });

  it('RWD-04: Staff can verify digital claim code and view customer reward details', () => {
    const customer = dbAdapter.getCustomers().find(c => dbAdapter.normalizePhoneNumber(c.phone) === dbAdapter.normalizePhoneNumber(customerPhone));
    const loyalty = dbAdapter.getLoyaltyAccounts().find(l => l.customer_id === customer?.id);
    let targetReward = dbAdapter.getLoyaltyRewards().find(r => r.loyalty_account_id === loyalty?.id && r.redemption_code && !r.is_redeemed);
    
    if (!targetReward && loyalty) {
      const claimResult = dbAdapter.claimLoyaltyReward({
        customerId: customer!.id,
        rewardId: dbAdapter.getLoyaltyRewards().find(r => r.loyalty_account_id === loyalty.id)!.id,
      });
      targetReward = claimResult.reward;
    }
    expect(targetReward).toBeDefined();

    const verification = dbAdapter.verifyRewardCode(targetReward!.redemption_code!);
    expect(verification.valid).toBe(true);
    expect(verification.reward?.id).toBe(targetReward!.id);
    expect(verification.customer?.id).toBe(customer!.id);
  });

  it('RWD-05: Staff redemption atomically marks reward redeemed and prevents duplicate use', () => {
    const customer = dbAdapter.getCustomers().find(c => dbAdapter.normalizePhoneNumber(c.phone) === dbAdapter.normalizePhoneNumber(customerPhone));
    const loyalty = dbAdapter.getLoyaltyAccounts().find(l => l.customer_id === customer?.id);
    const targetReward = dbAdapter.getLoyaltyRewards().find(r => r.loyalty_account_id === loyalty?.id && r.redemption_code && !r.is_redeemed);
    expect(targetReward).toBeDefined();

    const redemptionCode = targetReward!.redemption_code!;

    // 1. Redeem reward
    const result = dbAdapter.redeemRewardCode({
      redemptionCode,
      staffId: 'st-ctr-1',
      tableId: 'tbl-1',
    });

    expect(result.success).toBe(true);
    expect(result.reward.is_redeemed).toBe(true);
    expect(result.reward.redeemed_at).toBeDefined();

    // 2. Audit log entry created
    const loggedRedemption = dbAdapter.getRewardRedemptions().find(r => r.reward_id === targetReward!.id);
    expect(loggedRedemption).toBeDefined();
    expect(loggedRedemption?.status).toBe('REDEEMED');
    expect(loggedRedemption?.redeemed_by).toBe('st-ctr-1');

    // 3. Duplicate redemption attempt must be blocked
    const duplicateVerification = dbAdapter.verifyRewardCode(redemptionCode);
    expect(duplicateVerification.valid).toBe(false);
    expect(duplicateVerification.message).toContain('already redeemed');

    expect(() => {
      dbAdapter.redeemRewardCode({
        redemptionCode,
        staffId: 'st-ctr-1',
      });
    }).toThrow(/already redeemed/i);
  });

  it('RWD-06: Order cancellation or refund reverses awarded loyalty stamp', () => {
    const customer = dbAdapter.getCustomers().find(c => dbAdapter.normalizePhoneNumber(c.phone) === dbAdapter.normalizePhoneNumber(customerPhone));
    const loyalty = dbAdapter.getLoyaltyAccounts().find(l => l.customer_id === customer?.id);
    expect(loyalty).toBeDefined();

    loyalty!.current_active_stamps = 4;
    loyalty!.total_stamps_earned = 12;

    const session = getOrCreateActiveSession();
    const items = dbAdapter.getMenuItems();
    const order = dbAdapter.placeOrder({
      tableSessionId: session.id,
      items: [{ menuItemId: items[0].id, quantity: 1 }],
      customerPhone,
      customerName,
    });

    // Reversal
    const reversed = dbAdapter.reverseLoyaltyStamp(order.id, 'Customer cancellation & refund');
    expect(reversed).toBe(true);

    const updatedLoyalty = dbAdapter.getLoyaltyAccounts().find(l => l.customer_id === customer?.id);
    expect(updatedLoyalty?.current_active_stamps).toBe(3);
    expect(updatedLoyalty?.total_stamps_earned).toBe(11);
  });
});
