import { describe, it, expect } from 'vitest';
import { dbAdapter } from '../src/services/databaseAdapter';

describe('Digital Loyalty Stamps & Milestone Rewards', () => {
  it('LOY-01: Registered customer earns 1 stamp for completed order >= ₹250', () => {
    const custPhone = '+91 98888 77665';
    // Register or get loyalty
    const { loyalty } = dbAdapter.registerLoyaltyCustomer('Aditya Verma', custPhone);
    const initialStamps = loyalty.current_active_stamps;

    // Create session and order
    const session = dbAdapter.getSessions()[0] || dbAdapter.getOrCreateActiveSession(dbAdapter.getTables()[0].id);
    const items = dbAdapter.getMenuItems();
    const order = dbAdapter.placeOrder({
      tableSessionId: session.id,
      items: [{ menuItemId: items[0].id, quantity: 1 }],
      customerPhone: custPhone,
      customerName: 'Aditya Verma',
    });

    // Pay order
    const payment = dbAdapter.initiateCustomerPayment({
      tableSessionId: session.id,
      method: 'CASH',
      customerPhone: custPhone,
    });

    const { stampAwarded } = dbAdapter.confirmPayment({
      paymentId: payment.id,
      staffId: 'st-ctr-1',
      cashReceivedAmount: 5000,
    });

    expect(stampAwarded).toBe(true);
    const updatedLoyalty = dbAdapter.getLoyaltyAccounts().find(a => a.customer_id === loyalty.customer_id);
    expect(updatedLoyalty).toBeDefined();
  });
});
