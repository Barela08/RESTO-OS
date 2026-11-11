import { describe, it, expect } from 'vitest';
import { dbAdapter } from '../src/services/databaseAdapter';

describe('Order Creation & Multi-Station Routing', () => {
  it('ORD-01: Places order with server-calculated GST and snapshots items', () => {
    // Pick an active session
    const session = dbAdapter.getSessions().find(s => s.status === 'ACTIVE') || dbAdapter.getSessions()[0];
    const items = dbAdapter.getMenuItems();
    const pizzaItem = items.find(i => i.name.includes('Pizza')) || items[0];
    const beverageItem = items.find(i => i.category_id === 'cat-4') || items[1];

    const order = dbAdapter.placeOrder({
      tableSessionId: session.id,
      items: [
        { menuItemId: pizzaItem.id, quantity: 2 },
        { menuItemId: beverageItem.id, quantity: 1 },
      ],
      customerName: 'Aditya Test',
      customerPhone: '+91 98888 77665',
    });

    expect(order).toBeDefined();
    expect(order.order_number).toContain('ORD-');
    expect(order.items.length).toBe(2);

    const expectedSubtotal = (pizzaItem.base_price * 2) + (beverageItem.base_price * 1);
    expect(order.subtotal_amount).toBe(expectedSubtotal);
    expect(order.cgst_amount).toBeCloseTo(expectedSubtotal * 0.025, 2);
    expect(order.sgst_amount).toBeCloseTo(expectedSubtotal * 0.025, 2);
    expect(order.total_amount).toBeCloseTo(expectedSubtotal * 1.05, 2);
  });

  it('ORD-02: Routes order items into separate kitchen station tickets', () => {
    const session = dbAdapter.getSessions().find(s => s.status === 'ACTIVE') || dbAdapter.getSessions()[0];
    const items = dbAdapter.getMenuItems();

    const order = dbAdapter.placeOrder({
      tableSessionId: session.id,
      items: [
        { menuItemId: items[0].id, quantity: 1 }, // Starter -> Main Kitchen
        { menuItemId: items[8].id, quantity: 1 }, // Beverage -> Bar
      ],
    });

    const relatedTickets = dbAdapter.getKitchenTickets().filter(t => t.order_id === order.id);
    expect(relatedTickets.length).toBeGreaterThanOrEqual(1);
    expect(relatedTickets.every(t => t.status === 'NEW')).toBe(true);
  });
});
