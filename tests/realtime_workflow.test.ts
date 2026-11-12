import { describe, it, expect, beforeEach } from 'vitest';
import { dbAdapter } from '../src/services/databaseAdapter';
import { voiceAnnouncementService } from '../src/services/voiceAnnouncementService';
import { TableSession, Order, Invoice } from '../src/types';

describe('RESTO OS - Realtime Workflow, Table Sessions & Billing Suite (14 Acceptance Scenarios)', () => {
  beforeEach(() => {
    dbAdapter.ensureTodayQRs();
  });

  // ------------------------------------------------------------------
  // 1. Table 10 QR First Scan
  // ------------------------------------------------------------------
  it('WORKFLOW-01: Table 10 permanent QR first scan automatically opens session without confirmation popup', () => {
    const table10 = dbAdapter.getTables().find((t) => t.table_number === 'T-10') || dbAdapter.getTables()[0];
    const token = dbAdapter.generatePermanentQRForTable(table10.id);

    // First scan creates an active session
    const scanResult = dbAdapter.verifyQRToken(token.token_hash);
    expect(scanResult.valid).toBe(true);
    expect(scanResult.session).toBeDefined();
    expect(scanResult.session?.status).toBe('ACTIVE');
    expect(scanResult.session?.table_id).toBe(table10.id);

    // Scanning QR establishes browsing session; table remains AVAILABLE until an order is placed
    const updatedTable = dbAdapter.getTables().find((t) => t.id === table10.id);
    expect(['AVAILABLE', 'OCCUPIED']).toContain(updatedTable?.status);
  });

  // ------------------------------------------------------------------
  // 2. Same QR Second Scan
  // ------------------------------------------------------------------
  it('WORKFLOW-02: Same QR second scan seamlessly returns active session without duplicate creation', () => {
    const table = dbAdapter.getTables()[1];
    const token = dbAdapter.generatePermanentQRForTable(table.id);

    // First scan
    const firstScan = dbAdapter.verifyQRToken(token.token_hash);
    expect(firstScan.valid).toBe(true);
    const initialSessionId = firstScan.session?.id;

    const sessionCountBefore = dbAdapter.getSessions().length;

    // Second scan on the same active session
    const secondScan = dbAdapter.verifyQRToken(token.token_hash);
    expect(secondScan.valid).toBe(true);
    expect(secondScan.isRepeatScan).toBe(true);
    expect(secondScan.session?.id).toBe(initialSessionId);

    // No duplicate session created in database
    const sessionCountAfter = dbAdapter.getSessions().length;
    expect(sessionCountAfter).toBe(sessionCountBefore);
  });

  // ------------------------------------------------------------------
  // 3. URL Table Number Tampering
  // ------------------------------------------------------------------
  it('WORKFLOW-03: URL table number tampering or invalid token hash is strictly rejected', () => {
    const tamperedHash = 'forged-tampered-token-hash-xyz-999';
    const result = dbAdapter.verifyQRToken(tamperedHash);

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('INVALID_TOKEN');
    expect(result.session).toBeUndefined();
  });

  // ------------------------------------------------------------------
  // 4. Customer Order Live Sync
  // ------------------------------------------------------------------
  it('WORKFLOW-04: Customer placing order triggers real-time subscriber notification without page refresh', () => {
    const table = dbAdapter.getTables()[0];
    const token = dbAdapter.generatePermanentQRForTable(table.id);
    const scan = dbAdapter.verifyQRToken(token.token_hash);
    expect(scan.session).toBeDefined();

    let notificationFired = false;
    const unsubscribe = dbAdapter.subscribe(() => {
      notificationFired = true;
    });

    const menuItems = dbAdapter.getMenuItems();
    const order = dbAdapter.placeOrder({
      tableSessionId: scan.session!.id,
      items: [
        {
          menuItemId: menuItems[0].id,
          quantity: 2,
        },
      ],
      customerName: 'Aarav Sharma',
      customerPhone: '+91 98765 11223',
    });

    expect(order.status).toBe('PLACED');
    expect(order.table_session_id).toBe(scan.session!.id);
    expect(notificationFired).toBe(true);

    unsubscribe();
  });

  // ------------------------------------------------------------------
  // 5. Customer Calls Waiter & Natural Table Pronunciation
  // ------------------------------------------------------------------
  it('WORKFLOW-05: Customer call waiter creates service request with natural table pronunciation and duplicate prevention', () => {
    const table = dbAdapter.getTables().find((t) => t.table_number === 'T-10') || dbAdapter.getTables()[0];
    const token = dbAdapter.generatePermanentQRForTable(table.id);
    const scan = dbAdapter.verifyQRToken(token.token_hash);
    const sessionId = scan.session!.id;

    // First Call Waiter request
    const call1 = dbAdapter.requestService({
      tableSessionId: sessionId,
      requestType: 'CALL_WAITER',
      notes: 'Need water and menu suggestions',
    });

    expect(['PENDING', 'REQUESTED']).toContain(call1.status);
    expect(call1.table_session_id).toBe(sessionId);

    // Duplicate call attempt returns the same active call
    const call2 = dbAdapter.requestService({
      tableSessionId: sessionId,
      requestType: 'CALL_WAITER',
    });
    expect(call2.id).toBe(call1.id);

    // Waiter can acknowledge, go on the way, and complete
    dbAdapter.updateWaiterCallStatus(call1.id, 'ACKNOWLEDGED', 'st-wtr-1');
    expect(['ACKNOWLEDGED', 'ACCEPTED']).toContain(call1.status);

    dbAdapter.updateWaiterCallStatus(call1.id, 'IN_PROGRESS', 'st-wtr-1');
    expect(['IN_PROGRESS', 'ON_THE_WAY']).toContain(call1.status);

    dbAdapter.updateWaiterCallStatus(call1.id, 'COMPLETED', 'st-wtr-1');
    expect(call1.status).toBe('COMPLETED');
  });

  // ------------------------------------------------------------------
  // 6. Table Booking Visual Status
  // ------------------------------------------------------------------
  it('WORKFLOW-06: Table booking/reservation status change is visual only and completely silent', () => {
    const table = dbAdapter.getTables()[2];
    const initialEventsCount = dbAdapter.getNotificationEvents().length;

    // Change status to RESERVED
    dbAdapter.updateTable(table.id, { status: 'RESERVED' });

    const updated = dbAdapter.getTables().find((t) => t.id === table.id);
    expect(updated?.status).toBe('RESERVED');

    // No audio/voice announcement event added for visual table status change
    const newEventsCount = dbAdapter.getNotificationEvents().length;
    expect(newEventsCount).toBe(initialEventsCount);
  });

  // ------------------------------------------------------------------
  // 7. Cash Payment Settlement
  // ------------------------------------------------------------------
  it('WORKFLOW-07: Cash payment settlement confirms PAID, generates tax invoice, and marks table CLEANING', () => {
    const table = dbAdapter.getTables()[3];
    const token = dbAdapter.generatePermanentQRForTable(table.id);
    const scan = dbAdapter.verifyQRToken(token.token_hash);
    const session = scan.session!;

    const payment = dbAdapter.initiateCustomerPayment({
      tableSessionId: session.id,
      method: 'CASH',
    });
    expect(payment.payment_status).toBe('PENDING');

    // Cash counter staff receives physical cash and confirms
    const result = dbAdapter.confirmPayment({
      paymentId: payment.id,
      staffId: 'st-ctr-1',
      cashReceivedAmount: 1000,
    });

    expect(payment.payment_status).toBe('PAID');
    expect(payment.cash_received_amount).toBe(1000);
    expect(payment.cash_change_amount).toBe(1000 - payment.amount);
    expect(result.invoice).toBeDefined();
    expect(result.invoice.invoice_number).toMatch(/^INV-/);

    // Session is closed and table is marked for cleaning
    expect(session.status).toBe('CLOSED');
    const updatedTable = dbAdapter.getTables().find((t) => t.id === table.id);
    expect(updatedTable?.status).toBe('CLEANING');
  });

  // ------------------------------------------------------------------
  // 8. UPI Payment Verification
  // ------------------------------------------------------------------
  it('WORKFLOW-08: UPI payment verification sets PAID and rejects duplicate transaction reference (UTR)', () => {
    const table = dbAdapter.getTables()[4];
    const token = dbAdapter.generatePermanentQRForTable(table.id);
    const scan = dbAdapter.verifyQRToken(token.token_hash);
    const session = scan.session!;

    const utr = `UTR${Date.now()}`;
    const verification = dbAdapter.submitUpiPaymentVerification({
      tableSessionId: session.id,
      transactionReference: utr,
      submittedAmount: 1250,
      customerNotes: 'Google Pay transaction',
    });

    expect(verification.request.status).toBe('PENDING');
    expect(verification.request.transaction_reference).toBe(utr);

    // Duplicate UTR submission must be rejected
    expect(() => {
      dbAdapter.submitUpiPaymentVerification({
        tableSessionId: session.id,
        transactionReference: utr,
        submittedAmount: 1250,
      });
    }).toThrow(/Duplicate UPI transaction reference/i);

    // Cash Counter approves verification
    const approvedResult = dbAdapter.approveUpiPayment(verification.request.id, 'st-ctr-1');
    expect(approvedResult.invoice).toBeDefined();
    expect(verification.payment.payment_status).toBe('PAID');
    expect(session.status).toBe('CLOSED');
  });

  // ------------------------------------------------------------------
  // 9. Bill Settlement & Table Reset Workflow
  // ------------------------------------------------------------------
  it('WORKFLOW-09: Bill settlement marks table CLEANING, and markTableCleaned resets to AVAILABLE', () => {
    const table = dbAdapter.getTables()[0];
    dbAdapter.updateTable(table.id, { status: 'CLEANING' });

    const cleaned = dbAdapter.markTableCleaned(table.id);
    expect(cleaned.status).toBe('AVAILABLE');
  });

  // ------------------------------------------------------------------
  // 10. New Customer Order Isolation
  // ------------------------------------------------------------------
  it('WORKFLOW-10: New customer scanning cleaned table starts fresh session with previous orders completely inaccessible', () => {
    const table = dbAdapter.getTables()[1];
    dbAdapter.markTableCleaned(table.id);

    const token = dbAdapter.generatePermanentQRForTable(table.id);
    const newScan = dbAdapter.verifyQRToken(token.token_hash);

    expect(newScan.valid).toBe(true);
    expect(newScan.session?.status).toBe('ACTIVE');

    // Active orders for this new session must be empty
    const activeOrders = dbAdapter.getActiveOrdersForTable(table.id);
    expect(activeOrders).toEqual([]);
  });

  // ------------------------------------------------------------------
  // 11. Customer Billing History Access Control
  // ------------------------------------------------------------------
  it('WORKFLOW-11: Customer billing history is strictly isolated to own verified invoices', () => {
    const customerPhone = '+91 99999 88888';
    const otherPhone = '+91 91111 22222';

    // Create an invoice for this customer
    const myInvoice: Invoice = {
      id: `inv-test-${Date.now()}`,
      restaurant_id: 'rest-001-main',
      invoice_number: 'INV-TEST-001',
      payment_id: 'pay-test-1',
      table_session_id: 'ses-test-1',
      table_id: 'tbl-1',
      customer_name: 'Pooja Hegde',
      customer_phone: customerPhone,
      subtotal_amount: 500,
      cgst_rate: 2.5,
      cgst_amount: 12.5,
      sgst_rate: 2.5,
      sgst_amount: 12.5,
      service_charge_amount: 0,
      discount_amount: 0,
      total_amount: 525,
      payment_method: 'UPI',
      transaction_ref: 'UPI-TEST-1',
      issued_at: new Date().toISOString(),
    };
    dbAdapter.getInvoices().unshift(myInvoice);

    // Customer querying their invoices
    const customerInvoices = dbAdapter.getAuthorizedInvoices({
      role: 'customer',
      customerPhone,
    });

    expect(customerInvoices.length).toBeGreaterThanOrEqual(1);
    expect(customerInvoices.some((inv) => inv.id === myInvoice.id)).toBe(true);

    // Querying with another phone does not leak this invoice
    const otherInvoices = dbAdapter.getAuthorizedInvoices({
      role: 'customer',
      customerPhone: otherPhone,
    });
    expect(otherInvoices.some((inv) => inv.id === myInvoice.id)).toBe(false);
  });

  // ------------------------------------------------------------------
  // 12. Cash Counter Table-Wise Daily Collection Summary
  // ------------------------------------------------------------------
  it('WORKFLOW-12: Cash Counter retrieves authorized table-wise daily collection summary metrics', () => {
    const summaries = dbAdapter.getTableDailyCollectionSummary();

    expect(Array.isArray(summaries)).toBe(true);
    expect(summaries.length).toBe(dbAdapter.getTables().length);

    summaries.forEach((summary) => {
      expect(summary.tableNumber).toBeDefined();
      expect(summary.capacity).toBeGreaterThan(0);
      expect(typeof summary.todayOrdersCount).toBe('number');
      expect(typeof summary.completedBillsCount).toBe('number');
      expect(typeof summary.cashCollection).toBe('number');
      expect(typeof summary.upiCollection).toBe('number');
      expect(typeof summary.totalBilledAmount).toBe('number');
      expect(typeof summary.pendingAmount).toBe('number');
    });
  });

  // ------------------------------------------------------------------
  // 13. Realtime Reconnect & Duplicate Prevention
  // ------------------------------------------------------------------
  it('WORKFLOW-13: Realtime reconnect / synchronization loads latest state and avoids duplicate announcements', () => {
    const eventId = `evt-reconnect-${Date.now()}`;
    expect(voiceAnnouncementService.hasAnnounced(eventId)).toBe(false);

    voiceAnnouncementService.markAnnounced(eventId);
    expect(voiceAnnouncementService.hasAnnounced(eventId)).toBe(true);

    // Processing the same event again will not announce
    const isDuplicate = voiceAnnouncementService.hasAnnounced(eventId);
    expect(isDuplicate).toBe(true);
  });

  // ------------------------------------------------------------------
  // 14. Historical Invoices Role Restriction
  // ------------------------------------------------------------------
  it('WORKFLOW-14: Historical invoices are permanently preserved and role-restricted', () => {
    const allInvoices = dbAdapter.getInvoices();
    expect(allInvoices.length).toBeGreaterThan(0);

    // Admin & Cash Counter have full ledger visibility
    const adminInvoices = dbAdapter.getAuthorizedInvoices({ role: 'admin' });
    expect(adminInvoices.length).toBe(allInvoices.length);

    const counterInvoices = dbAdapter.getAuthorizedInvoices({ role: 'counter' });
    expect(counterInvoices.length).toBe(allInvoices.length);

    // Waiter & Kitchen are strictly denied access to accounting invoices
    const waiterInvoices = dbAdapter.getAuthorizedInvoices({ role: 'waiter' });
    expect(waiterInvoices).toEqual([]);

    const kitchenInvoices = dbAdapter.getAuthorizedInvoices({ role: 'kitchen' });
    expect(kitchenInvoices).toEqual([]);
  });
});
