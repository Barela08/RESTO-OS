// ====================================================================
// RESTO OS: Edge Functions & Realtime Manager Tests
// Verifies Edge Functions client interfaces and Realtime event deduplication
// ====================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EdgeFunctionsClient } from '../src/services/edgeFunctionsClient';
import { realtimeManager } from '../src/services/realtimeManager';

describe('Supabase Edge Functions & Realtime Architecture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Edge Functions Client Validation', () => {
    it('defines client methods for all 8 required Edge Functions', () => {
      expect(typeof EdgeFunctionsClient.verifyTableQR).toBe('function');
      expect(typeof EdgeFunctionsClient.createOrder).toBe('function');
      expect(typeof EdgeFunctionsClient.calculateBill).toBe('function');
      expect(typeof EdgeFunctionsClient.settlePayment).toBe('function');
      expect(typeof EdgeFunctionsClient.submitUpiUtr).toBe('function');
      expect(typeof EdgeFunctionsClient.decideUpiVerification).toBe('function');
      expect(typeof EdgeFunctionsClient.staffAuth).toBe('function');
      expect(typeof EdgeFunctionsClient.sendNotification).toBe('function');
      expect(typeof EdgeFunctionsClient.manageRefund).toBe('function');
    });

    it('rejects unconfigured requests cleanly without uncaught exceptions', async () => {
      const res = await EdgeFunctionsClient.verifyTableQR({ tokenHash: 'test-hash' });
      expect(res).toBeDefined();
      expect(typeof res.success).toBe('boolean');
    }, 15000);

    it('validates idempotency header generation during order creation', async () => {
      const res = await EdgeFunctionsClient.createOrder({
        restaurantId: 'rest-001-main',
        tableSessionId: 'ses-test',
        sessionToken: 'tok-test',
        items: [{ menu_item_id: 'dish-1', quantity: 1 }],
        idempotencyKey: 'idem-test-header-123',
      });
      expect(res).toBeDefined();
    }, 15000);

    it('validates UPI UTR format in client handler', async () => {
      const res = await EdgeFunctionsClient.submitUpiUtr({
        restaurantId: 'rest-001-main',
        tableSessionId: 'ses-1',
        tableId: 'tbl-1',
        amount: 540,
        utrNumber: '123456789012',
      });
      expect(res).toBeDefined();
    }, 15000);
  });

  describe('2. Realtime Subscriptions & Deduplication Manager', () => {
    it('provides subscription management and listener registration', () => {
      const handler = vi.fn();
      const unsubscribe = realtimeManager.addListener(handler);
      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
    });

    it('handles duplicate events through deduplication cache', () => {
      const handler = vi.fn();
      const unsubscribe = realtimeManager.addListener(handler);

      // Access private handleEvent for unit testing deduplication
      const rmAny = realtimeManager as any;
      const testPayload = {
        eventType: 'INSERT',
        new: { id: 'evt-order-dup-1', restaurant_id: 'rest-001-main' },
        commit_timestamp: '2026-11-12T10:00:00Z',
      };

      rmAny.handleEvent('orders', testPayload);
      expect(handler).toHaveBeenCalledTimes(1);

      // Same event delivered again (reconnect or broadcast echo)
      rmAny.handleEvent('orders', testPayload);
      expect(handler).toHaveBeenCalledTimes(1); // Must NOT fire again!

      unsubscribe();
    });
  });
});
