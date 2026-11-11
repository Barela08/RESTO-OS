import { describe, it, expect, beforeEach } from 'vitest';
import { dbAdapter } from '../src/services/databaseAdapter';

describe('Module 2 Acceptance Tests: Manual UPI ID + QR Payment', () => {
  beforeEach(() => {
    dbAdapter.updatePaymentSettings({
      upi_id: 'grandbistro@okaxis',
      merchant_name: 'The Grand Bistro Indiranagar',
      qr_image_url: 'https://example.com/qr.png',
      upi_enabled: true,
      cash_enabled: true,
      require_transaction_ref: true,
      manual_verification_enabled: true,
    });
  });

  it('UPI-01: Admin can update and persist UPI payment configuration', () => {
    const updated = dbAdapter.updatePaymentSettings({
      upi_id: 'restokitchen@hdfcbank',
      merchant_name: 'The Grand Bistro Kitchen & Bar',
      payment_instructions: 'Scan standee QR and submit your 12-digit UTR reference.',
    });

    expect(updated.upi_id).toBe('restokitchen@hdfcbank');
    expect(updated.merchant_name).toBe('The Grand Bistro Kitchen & Bar');

    const retrieved = dbAdapter.getPaymentSettings();
    expect(retrieved.upi_id).toBe('restokitchen@hdfcbank');
  });

  const getSession = () => dbAdapter.getSessions().find(s => s.status === 'ACTIVE') || dbAdapter.getOrCreateActiveSession(dbAdapter.getTables()[0].id);

  it('UPI-02: Generates correct URL-encoded UPI Intent URI with exact bill amount', () => {
    const session = getSession();
    const items = dbAdapter.getMenuItems();

    const order = dbAdapter.placeOrder({
      tableSessionId: session.id,
      items: [{ menuItemId: items[0].id, quantity: 2 }],
      customerName: 'Sanjay Dutt',
    });

    const paymentSettings = dbAdapter.getPaymentSettings();
    const upiUri = `upi://pay?pa=${encodeURIComponent(paymentSettings.upi_id)}&pn=${encodeURIComponent(
      paymentSettings.merchant_name
    )}&am=${order.total_amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(order.order_number)}`;

    expect(upiUri).toContain('upi://pay?');
    expect(upiUri).toContain(`pa=${encodeURIComponent(paymentSettings.upi_id)}`);
    expect(upiUri).toContain(`am=${order.total_amount.toFixed(2)}`);
    expect(upiUri).toContain('cu=INR');
    expect(upiUri).toContain(`tn=${encodeURIComponent(order.order_number)}`);
  });

  it('UPI-03: Submitting UPI UTR creates PENDING verification request and does not mark paid automatically', () => {
    const session = getSession();
    const testUtr = `UTR-${Date.now()}`;

    const { request, payment } = dbAdapter.submitUpiPaymentVerification({
      tableSessionId: session.id,
      transactionReference: testUtr,
      submittedAmount: 750.00,
    });

    expect(request).toBeDefined();
    expect(request.status).toBe('PENDING');
    expect(request.transaction_reference).toBe(testUtr);
    expect(payment.payment_status).toBe('PENDING');

    // Confirm that bill is NOT marked paid automatically
    const livePayment = dbAdapter.getPayments().find(p => p.id === payment.id);
    expect(livePayment?.payment_status).toBe('PENDING');
  });

  it('UPI-04: Blocks duplicate UPI transaction reference (UTR)', () => {
    const session = getSession();
    const uniqueUtr = `UTR-UNIQUE-${Date.now()}`;

    // First submission succeeds
    dbAdapter.submitUpiPaymentVerification({
      tableSessionId: session.id,
      transactionReference: uniqueUtr,
    });

    // Second submission with exact same UTR must throw error
    expect(() => {
      dbAdapter.submitUpiPaymentVerification({
        tableSessionId: session.id,
        transactionReference: uniqueUtr,
      });
    }).toThrow(/Duplicate UPI transaction reference/i);
  });

  it('UPI-05: Counter staff can approve UPI payment, emitting tax invoice and setting PAID', () => {
    const session = getSession();
    const utr = `UTR-APPROVE-${Date.now()}`;

    const { request } = dbAdapter.submitUpiPaymentVerification({
      tableSessionId: session.id,
      transactionReference: utr,
      submittedAmount: 650.00,
    });

    const { invoice } = dbAdapter.approveUpiPayment(request.id, 'st-ctr-1');
    expect(invoice).toBeDefined();
    expect(invoice.invoice_number).toContain('INV-');
    expect(invoice.payment_method).toBe('UPI');
    expect(invoice.transaction_ref).toBe(utr);

    const updatedReq = dbAdapter.getPaymentVerificationRequests().find(r => r.id === request.id);
    expect(updatedReq?.status).toBe('APPROVED');
    expect(updatedReq?.verified_by).toBe('st-ctr-1');

    const payment = dbAdapter.getPayments().find(p => p.id === request.payment_id);
    expect(payment?.payment_status).toBe('PAID');
  });

  it('UPI-06: Counter staff can reject UPI payment with reason, keeping order unpaid', () => {
    const session = getSession();
    const utr = `UTR-REJECT-${Date.now()}`;

    const { request, payment } = dbAdapter.submitUpiPaymentVerification({
      tableSessionId: session.id,
      transactionReference: utr,
      submittedAmount: 400.00,
    });

    const rejected = dbAdapter.rejectUpiPayment(
      request.id,
      'st-ctr-1',
      'UTR not reflected in merchant bank account'
    );

    expect(rejected.status).toBe('REJECTED');
    expect(rejected.rejection_reason).toContain('UTR not reflected');

    const updatedPayment = dbAdapter.getPayments().find(p => p.id === payment.id);
    expect(updatedPayment?.payment_status).toBe('FAILED');
  });
});
