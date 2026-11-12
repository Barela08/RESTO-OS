import { describe, it, expect, beforeEach } from 'vitest';
import { dbAdapter } from '../src/services/databaseAdapter';
import { TableStatus, OrderStatus, KitchenTicketStatus } from '../src/types';

describe('Table Management & KDS Fulfillment Pipeline Test Suite', () => {
  beforeEach(() => {
    dbAdapter.ensureTodayQRs();
    dbAdapter.ensurePermanentQRs();
  });

  // ------------------------------------------------------------------
  // 1. Table Management & QR Browsing Lifecycle
  // ------------------------------------------------------------------
  it('TEST-TM-01: Table defaults to AVAILABLE and stays AVAILABLE when QR is scanned for browsing', () => {
    const table = dbAdapter.getTables()[0];
    dbAdapter.updateTable(table.id, { status: 'AVAILABLE' });
    expect(dbAdapter.getTables().find((t) => t.id === table.id)?.status).toBe('AVAILABLE');

    const permQR = dbAdapter.getPermanentQRForTable(table.id) || dbAdapter.generatePermanentQRForTable(table.id);
    const verifyResult = dbAdapter.verifyQRToken(permQR.token_hash);

    expect(verifyResult.valid).toBe(true);
    expect(verifyResult.session).toBeDefined();
    expect(verifyResult.session?.status).toBe('ACTIVE');

    // Browsing session alone must NOT mark table as OCCUPIED
    const tableAfterScan = dbAdapter.getTables().find((t) => t.id === table.id);
    expect(tableAfterScan?.status).toBe('AVAILABLE');
  });

  it('TEST-TM-02: Placing an order marks the table OCCUPIED', async () => {
    const table = dbAdapter.getTables()[1];
    dbAdapter.updateTable(table.id, { status: 'AVAILABLE' });

    const session = dbAdapter.getOrCreateActiveSession(table.id);
    const menuItems = dbAdapter.getMenuItems();
    const availableItem = menuItems.find((m) => m.is_available) || menuItems[0];

    const order = await dbAdapter.placeOrderAsync({
      tableSessionId: session.id,
      items: [{ menuItemId: availableItem.id, quantity: 2 }],
      customerName: 'Aarav Patel',
      customerPhone: '9876543210',
    });

    expect(order).toBeDefined();
    expect(order.table_id).toBe(table.id);
    expect(order.status).toBe('PLACED');

    // Table must now be OCCUPIED
    const tableAfterOrder = dbAdapter.getTables().find((t) => t.id === table.id);
    expect(tableAfterOrder?.status).toBe('OCCUPIED');
  });

  it('TEST-TM-03: Cancelling order reverts table to AVAILABLE if no other active orders exist', () => {
    const table = dbAdapter.getTables()[2];
    dbAdapter.updateTable(table.id, { status: 'AVAILABLE' });

    const session = dbAdapter.getOrCreateActiveSession(table.id);
    const item = dbAdapter.getMenuItems()[0];

    const order = dbAdapter.placeOrder({
      tableSessionId: session.id,
      items: [{ menuItemId: item.id, quantity: 1 }],
    });

    expect(dbAdapter.getTables().find((t) => t.id === table.id)?.status).toBe('OCCUPIED');

    // Cancel the order
    dbAdapter.updateOrderStatus(order.id, 'CANCELLED', 'Customer changed mind');

    // Table should revert to AVAILABLE
    const tableAfterCancel = dbAdapter.getTables().find((t) => t.id === table.id);
    expect(tableAfterCancel?.status).toBe('AVAILABLE');
  });

  it('TEST-TM-04: Confirming payment transitions table to CLEANING, staff marks cleaned transitions to AVAILABLE', () => {
    const table = dbAdapter.getTables()[3];
    dbAdapter.updateTable(table.id, { status: 'AVAILABLE' });

    const session = dbAdapter.getOrCreateActiveSession(table.id);
    const item = dbAdapter.getMenuItems()[0];

    const order = dbAdapter.placeOrder({
      tableSessionId: session.id,
      items: [{ menuItemId: item.id, quantity: 1 }],
    });

    expect(dbAdapter.getTables().find((t) => t.id === table.id)?.status).toBe('OCCUPIED');

    // Create a payment record via initiateCustomerPayment
    const payment = dbAdapter.initiateCustomerPayment({
      tableSessionId: session.id,
      method: 'CASH',
    });
    expect(payment).toBeDefined();

    // Confirm payment at cash counter
    dbAdapter.confirmPayment({
      paymentId: payment.id,
      staffId: 'st-ctr-1',
      cashReceivedAmount: Math.ceil(payment.amount),
    });

    // Table must now transition to CLEANING
    const tableAfterPayment = dbAdapter.getTables().find((t) => t.id === table.id);
    expect(tableAfterPayment?.status).toBe('CLEANING');

    // Staff cleans table -> AVAILABLE
    const cleanedTable = dbAdapter.markTableCleaned(table.id);
    expect(cleanedTable.status).toBe('AVAILABLE');
    expect(dbAdapter.getTables().find((t) => t.id === table.id)?.status).toBe('AVAILABLE');
  });

  // ------------------------------------------------------------------
  // 2. KDS Kitchen Display Pipeline & Lifecycle Transitions
  // ------------------------------------------------------------------
  it('TEST-KDS-01: Order generates kitchen tickets by station with initial NEW status', () => {
    const table = dbAdapter.getTables()[4];
    const session = dbAdapter.getOrCreateActiveSession(table.id);
    const items = dbAdapter.getMenuItems().slice(0, 2);

    const order = dbAdapter.placeOrder({
      tableSessionId: session.id,
      items: items.map((it) => ({ menuItemId: it.id, quantity: 1 })),
    });

    const tickets = dbAdapter.getKitchenTickets().filter((t) => t.order_id === order.id);
    expect(tickets.length).toBeGreaterThan(0);
    tickets.forEach((t) => {
      expect(t.status).toBe('NEW');
      expect(t.table_number).toBe(table.table_number);
      expect(t.items.length).toBeGreaterThan(0);
    });
  });

  it('TEST-KDS-02: Kitchen status progression ACCEPTED -> PREPARING -> READY updates parent order', () => {
    const table = dbAdapter.getTables()[5];
    const session = dbAdapter.getOrCreateActiveSession(table.id);
    const item = dbAdapter.getMenuItems()[0];

    const order = dbAdapter.placeOrder({
      tableSessionId: session.id,
      items: [{ menuItemId: item.id, quantity: 1 }],
    });

    const ticket = dbAdapter.getKitchenTickets().find((t) => t.order_id === order.id)!;
    expect(ticket).toBeDefined();

    // 1. Accept Ticket
    dbAdapter.updateKitchenTicketStatus(ticket.id, 'ACCEPTED');
    expect(dbAdapter.getKitchenTickets().find((t) => t.id === ticket.id)?.status).toBe('ACCEPTED');
    expect(dbAdapter.getOrders().find((o) => o.id === order.id)?.status).toBe('ACCEPTED');

    // 2. Start Cooking
    dbAdapter.updateKitchenTicketStatus(ticket.id, 'PREPARING');
    expect(dbAdapter.getKitchenTickets().find((t) => t.id === ticket.id)?.status).toBe('PREPARING');
    expect(dbAdapter.getOrders().find((o) => o.id === order.id)?.status).toBe('PREPARING');

    // 3. Mark Dishes Ready
    dbAdapter.updateKitchenTicketStatus(ticket.id, 'READY');
    expect(['READY', 'READY_FOR_HANDOVER']).toContain(
      dbAdapter.getKitchenTickets().find((t) => t.id === ticket.id)?.status
    );
    expect(['READY', 'READY_FOR_HANDOVER']).toContain(
      dbAdapter.getOrders().find((o) => o.id === order.id)?.status
    );

    // 4. Mark Served by waiter
    dbAdapter.markOrderServed(order.id);
    expect(dbAdapter.getOrders().find((o) => o.id === order.id)?.status).toBe('SERVED');
  });

  // ------------------------------------------------------------------
  // 3. Authoritative Price Calculations & Idempotency
  // ------------------------------------------------------------------
  it('TEST-ORD-01: Order price calculations strictly enforce subtotal + 2.5% CGST + 2.5% SGST', () => {
    const table = dbAdapter.getTables()[6];
    const session = dbAdapter.getOrCreateActiveSession(table.id);
    const item = dbAdapter.getMenuItems()[0];

    const order = dbAdapter.placeOrder({
      tableSessionId: session.id,
      items: [{ menuItemId: item.id, quantity: 2 }],
    });

    const expectedSubtotal = item.base_price * 2;
    const expectedCGST = expectedSubtotal * 0.025;
    const expectedSGST = expectedSubtotal * 0.025;
    const expectedTotal = expectedSubtotal + expectedCGST + expectedSGST;

    expect(order.subtotal_amount).toBe(expectedSubtotal);
    expect(order.cgst_amount).toBeCloseTo(expectedCGST, 2);
    expect(order.sgst_amount).toBeCloseTo(expectedSGST, 2);
    expect(order.total_amount).toBeCloseTo(expectedTotal, 2);
  });

  it('TEST-ORD-02: Idempotent order submission prevents duplicate orders', () => {
    const table = dbAdapter.getTables()[7];
    const session = dbAdapter.getOrCreateActiveSession(table.id);
    const item = dbAdapter.getMenuItems()[0];
    const idempotencyKey = `idem-test-${Date.now()}`;

    const order1 = dbAdapter.placeOrder({
      tableSessionId: session.id,
      items: [{ menuItemId: item.id, quantity: 1 }],
      idempotencyKey,
    });

    const order2 = dbAdapter.placeOrder({
      tableSessionId: session.id,
      items: [{ menuItemId: item.id, quantity: 1 }],
      idempotencyKey,
    });

    expect(order1.id).toBe(order2.id);
  });
});
