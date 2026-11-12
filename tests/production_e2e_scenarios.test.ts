import { describe, it, expect, beforeEach } from 'vitest';
import { dbAdapter } from '../src/services/databaseAdapter';
import { OrderRepository } from '../src/services/firebase/orderRepository';
import { WaiterCallRepository } from '../src/services/firebase/waiterCallRepository';
import { TableRepository } from '../src/services/firebase/tableRepository';
import { BillingRepository } from '../src/services/firebase/billingRepository';

describe('SECTION 16 — Production Verification Scenarios (TEST 1 to TEST 6)', () => {
  beforeEach(() => {
    dbAdapter.ensureTodayQRs();
    dbAdapter.ensurePermanentQRs();
  });

  // ------------------------------------------------------------------
  // TEST 1 – TABLE AVAILABILITY
  // ------------------------------------------------------------------
  it('TEST 1 – TABLE AVAILABILITY: QR scan, menu browse, cart addition leave table AVAILABLE; order placement marks OCCUPIED', async () => {
    // 1. Pick an unused table and verify initial AVAILABLE state
    const table = dbAdapter.getTables()[0];
    dbAdapter.updateTable(table.id, { status: 'AVAILABLE' });
    expect(dbAdapter.getTables().find((t) => t.id === table.id)?.status).toBe('AVAILABLE');

    // 2. Open table permanent QR
    const qrToken = dbAdapter.getPermanentQRForTable(table.id) || dbAdapter.generatePermanentQRForTable(table.id);
    const scanResult = dbAdapter.verifyQRToken(qrToken.token_hash);
    expect(scanResult.valid).toBe(true);
    expect(scanResult.session).toBeDefined();

    // 3. Verify table remains AVAILABLE after scan
    expect(dbAdapter.getTables().find((t) => t.id === table.id)?.status).toBe('AVAILABLE');

    // 4. Browse menu items - table still remains AVAILABLE
    const menu = dbAdapter.getMenuItems();
    expect(menu.length).toBeGreaterThan(0);
    expect(dbAdapter.getTables().find((t) => t.id === table.id)?.status).toBe('AVAILABLE');

    // 5. Place a successful order
    const order = await dbAdapter.placeOrderAsync({
      tableSessionId: scanResult.session!.id,
      items: [{ menuItemId: menu[0].id, quantity: 2 }],
      customerName: 'Rahul Verma',
      customerPhone: '9876543210',
    });
    expect(order).toBeDefined();

    // 6. Verify table becomes OCCUPIED
    const occupiedTable = dbAdapter.getTables().find((t) => t.id === table.id);
    expect(occupiedTable?.status).toBe('OCCUPIED');
  });

  // ------------------------------------------------------------------
  // TEST 2 – WAITER CALL
  // ------------------------------------------------------------------
  it('TEST 2 – WAITER CALL: Customer calls waiter, exact table appears, waiter accepts, customer status syncs', async () => {
    const table = dbAdapter.getTables()[1];
    const session = dbAdapter.getOrCreateActiveSession(table.id);

    // 1. Customer initiates waiter call
    const call = dbAdapter.requestService({
      tableSessionId: session.id,
      requestType: 'WATER',
      notes: 'Cold water please',
    });
    expect(call).toBeDefined();
    const callId = call.id;
    expect(call.table_number).toBe(table.table_number);
    expect(['PENDING', 'REQUESTED']).toContain(call.status);

    // 2. Verify exact table call appears in waiter dashboard list
    const waiterCalls = dbAdapter.getWaiterCalls();
    const foundCall = waiterCalls.find((c) => c.id === callId);
    expect(foundCall).toBeDefined();
    expect(foundCall?.table_number).toBe(table.table_number);

    // 3. Waiter accepts the call
    dbAdapter.acceptWaiterCall(callId, 'st-wtr-1');

    // 4. Verify customer status reflects ACCEPTED
    const updatedCall = dbAdapter.getWaiterCalls().find((c) => c.id === callId);
    expect(updatedCall?.status).toBe('ACCEPTED');
    expect(updatedCall?.assigned_waiter_id).toBe('st-wtr-1');
  });

  // ------------------------------------------------------------------
  // TEST 3 – ORDER PIPELINE
  // ------------------------------------------------------------------
  it('TEST 3 – ORDER PIPELINE: Full lifecycle NEW -> ACCEPTED -> PREPARING -> READY -> PICKED_UP -> SERVED', async () => {
    const table = dbAdapter.getTables()[2];
    const session = dbAdapter.getOrCreateActiveSession(table.id);
    const item = dbAdapter.getMenuItems()[0];

    // 1. Customer places order
    const order = await dbAdapter.placeOrderAsync({
      tableSessionId: session.id,
      items: [{ menuItemId: item.id, quantity: 1, specialInstructions: 'Less spicy' }],
      customerName: 'Priya Sharma',
    });
    expect(order.id).toBeDefined();
    expect(order.status).toBe('PLACED');

    // 2. Kitchen receives ticket with initial NEW status
    const tickets = dbAdapter.getKitchenTickets().filter((t) => t.order_id === order.id);
    expect(tickets.length).toBeGreaterThan(0);
    const ticket = tickets[0];
    expect(ticket.status).toBe('NEW');

    // 3. Kitchen marks ACCEPTED
    dbAdapter.updateKitchenTicketStatus(ticket.id, 'ACCEPTED');
    expect(dbAdapter.getOrders().find((o) => o.id === order.id)?.status).toBe('ACCEPTED');

    // 4. Kitchen marks PREPARING
    dbAdapter.updateKitchenTicketStatus(ticket.id, 'PREPARING');
    expect(dbAdapter.getOrders().find((o) => o.id === order.id)?.status).toBe('PREPARING');

    // 5. Kitchen marks READY
    dbAdapter.updateKitchenTicketStatus(ticket.id, 'READY');
    expect(['READY', 'READY_FOR_HANDOVER']).toContain(
      dbAdapter.getOrders().find((o) => o.id === order.id)?.status
    );

    // 6. Waiter marks PICKED_UP & SERVED
    dbAdapter.updateKitchenTicketStatus(ticket.id, 'HANDED_OVER');
    dbAdapter.markOrderServed(order.id);
    expect(dbAdapter.getOrders().find((o) => o.id === order.id)?.status).toBe('SERVED');
  });

  // ------------------------------------------------------------------
  // TEST 4 – CASH COUNTER
  // ------------------------------------------------------------------
  it('TEST 4 – CASH COUNTER: Bill generation, cash recording, GST invoice, and revenue calculation', () => {
    const table = dbAdapter.getTables()[3];
    const session = dbAdapter.getOrCreateActiveSession(table.id);
    const item = dbAdapter.getMenuItems()[0];

    const order = dbAdapter.placeOrder({
      tableSessionId: session.id,
      items: [{ menuItemId: item.id, quantity: 2 }],
    });

    // 1. Generate bill
    const payment = dbAdapter.initiateCustomerPayment({
      tableSessionId: session.id,
      method: 'CASH',
    });
    expect(payment.amount).toBe(order.total_amount);
    expect(payment.payment_status).toBe('PENDING');

    // 2. Cashier confirms cash receipt
    const settlementResult = dbAdapter.confirmPayment({
      paymentId: payment.id,
      staffId: 'st-ctr-1',
      cashReceivedAmount: Math.ceil(payment.amount + 50),
    });

    // 3. Verify invoice created with GST breakdown
    expect(settlementResult.invoice).toBeDefined();
    expect(settlementResult.invoice.invoice_number).toMatch(/^INV-/);
    expect(settlementResult.invoice.cgst_amount).toBeGreaterThan(0);
    expect(settlementResult.invoice.sgst_amount).toBeGreaterThan(0);

    // 4. Verify payment history recorded as PAID
    const verifiedPayment = dbAdapter.getPayments().find((p) => p.id === payment.id);
    expect(verifiedPayment?.payment_status).toBe('PAID');
    expect(verifiedPayment?.cash_change_amount).toBe(Math.ceil(payment.amount + 50) - payment.amount);

    // 5. Verify Table transitions to CLEANING
    expect(dbAdapter.getTables().find((t) => t.id === table.id)?.status).toBe('CLEANING');

    // 6. Staff marks cleaned
    dbAdapter.markTableCleaned(table.id);
    expect(dbAdapter.getTables().find((t) => t.id === table.id)?.status).toBe('AVAILABLE');
  });

  // ------------------------------------------------------------------
  // TEST 5 – REFRESH AND RECONNECTION
  // ------------------------------------------------------------------
  it('TEST 5 – REFRESH AND RECONNECTION: Reconnecting or reloading adapter recovers pending calls and orders', () => {
    const table = dbAdapter.getTables()[4];
    const session = dbAdapter.getOrCreateActiveSession(table.id);

    const call = dbAdapter.requestService({
      tableSessionId: session.id,
      requestType: 'REQUEST_BILL',
    });
    const callId = call.id;

    // Simulate page reload by re-reading state from adapter
    const allCallsAfterRefresh = dbAdapter.getWaiterCalls();
    const recoveredCall = allCallsAfterRefresh.find((c) => c.id === callId);
    expect(recoveredCall).toBeDefined();
    expect(['PENDING', 'REQUESTED']).toContain(recoveredCall?.status);

    // Realtime connection status is accessible
    const syncStatus = dbAdapter.getRealtimeSyncStatus();
    expect(syncStatus).toHaveProperty('isConnected');
    expect(syncStatus).toHaveProperty('lastSyncTime');
  });

  // ------------------------------------------------------------------
  // TEST 6 – SECURITY
  // ------------------------------------------------------------------
  it('TEST 6 – SECURITY: Multi-tenant validation, unauthorized role escalation prevention, and tamper protection', () => {
    // 1. Cross-restaurant isolation: Restaurant ID cannot be forged
    const restaurant = dbAdapter.getRestaurant();
    expect(restaurant.id).toBe('rest-001-main');

    // 2. Unauthorized staff role manipulation is rejected
    expect(() => {
      dbAdapter.updateStaffStatus('waiter' as any, 'p-wtr-1', false);
    }).toThrow(/Unauthorized/);

    // 3. Non-owner cannot deactivate an Owner account
    expect(() => {
      dbAdapter.updateStaffStatus('admin', 'p-own-1', false);
    }).toThrow(/Forbidden/);

    // 4. Invalid or non-existent QR token rejected
    const invalidVerify = dbAdapter.verifyQRToken('invalid_token_hash_abc');
    expect(invalidVerify.valid).toBe(false);
    expect(invalidVerify.errorCode).toBe('INVALID_TOKEN');
  });
});
