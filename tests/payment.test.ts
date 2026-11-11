import { describe, it, expect } from 'vitest';
import { dbAdapter } from '../src/services/databaseAdapter';

describe('Cash Counter Payment Settlement & Loyalty Stamps', () => {
  it('PAY-01: Confirms cash payment, verifies change, and issues tax invoice', () => {
    // Initiate cash payment
    const session = dbAdapter.getSessions()[0];
    const payment = dbAdapter.initiateCustomerPayment({
      tableSessionId: session.id,
      method: 'CASH',
      customerName: 'Test Customer',
      customerPhone: '+91 98888 77665',
    });

    expect(payment.payment_status).toBe('PENDING');

    // Confirm by Counter staff with cash
    const cashGiven = Math.ceil(payment.amount + 100);
    const { invoice, stampAwarded } = dbAdapter.confirmPayment({
      paymentId: payment.id,
      staffId: 'st-ctr-1',
      cashReceivedAmount: cashGiven,
    });

    expect(invoice).toBeDefined();
    expect(invoice.invoice_number).toContain('INV-');
    expect(invoice.total_amount).toBe(payment.amount);
    expect(payment.payment_status).toBe('PAID');
    expect(payment.cash_change_amount).toBe(cashGiven - payment.amount);
  });
});
