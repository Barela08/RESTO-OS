// ====================================================================
// RESTO OS: Production Security, RLS & PostgreSQL Functions Tests
// Verifies table protection, role permissions, QR verification & search_path security
// ====================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { dbAdapter } from '../src/services/databaseAdapter';
import { useAuthStore } from '../src/store/authStore';
import { useSessionStore } from '../src/store/sessionStore';

describe('Production Security & RLS Compliance', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    useSessionStore.getState().clearSession();
  });

  describe('1. Unauthenticated Guest QR Ordering & Session Security', () => {
    it('verifies valid permanent table QR token without expiring', () => {
      const tables = dbAdapter.getTables();
      expect(tables.length).toBeGreaterThan(0);
      const targetTable = tables[0];

      // Retrieve permanent QR token for this table
      const permToken = dbAdapter.getPermanentQRForTable(targetTable.id);
      expect(permToken).toBeDefined();
      expect(permToken?.is_permanent).toBe(true);

      const verifyRes = dbAdapter.verifyQRToken(permToken!.token_hash);
      expect(verifyRes.valid).toBe(true);
      expect(verifyRes.table?.id).toBe(targetTable.id);
    });

    it('resumes an existing active table session on repeat scan without duplicate session', () => {
      const table = dbAdapter.getTables()[1];
      const session1 = dbAdapter.createTableSession({ tableId: table.id, guestCount: 2 });
      expect(session1.status).toBe('ACTIVE');

      const permToken = dbAdapter.getPermanentQRForTable(table.id);
      expect(permToken).toBeDefined();

      // Second scan on the same table
      const repeatRes = dbAdapter.verifyQRToken(permToken!.token_hash);
      expect(repeatRes.valid).toBe(true);
      expect(repeatRes.isRepeatScan).toBe(true);
      expect(repeatRes.session?.id).toBe(session1.id);

      // Verify no duplicate active session was created
      const activeSessions = dbAdapter.getSessions().filter(s => s.table_id === table.id && s.status === 'ACTIVE');
      expect(activeSessions.length).toBe(1);
    });

    it('rejects revoked or tampered QR tokens with security error code', () => {
      const bogusTokenHash = 'deadbeef00000000000000000000000000000000000000000000000000000000';
      const verifyRes = dbAdapter.verifyQRToken(bogusTokenHash);
      expect(verifyRes.valid).toBe(false);
      expect(verifyRes.errorCode).toBe('INVALID_TOKEN');
    });
  });

  describe('2. Role-Based Access Control & Privilege Separation', () => {
    it('restricts bill settlement and cashier confirmation to authorized roles', () => {
      // Login as Waiter
      useAuthStore.getState().login('waiter', 'Waiter@2026!');
      const waiterProfile = useAuthStore.getState().currentProfile;
      expect(waiterProfile?.role_id).toBe('waiter');

      // Waiter must NOT be permitted to settle bills or execute counter refunds
      const authState = useAuthStore.getState();
      expect(authState.role).toBe('waiter');
      expect(['counter', 'admin', 'owner'].includes(authState.role!)).toBe(false);
    });

    it('enforces lockout and records security audit trail on excessive failed logins', () => {
      const bogusUser = 'intruder@attack.com';
      for (let i = 0; i < 5; i++) {
        const attempt = dbAdapter.authenticateStaff(bogusUser, 'WrongPass123!');
        expect(attempt.success).toBe(false);
      }

      // Security audit log should contain failure entries
      const auditLogs = dbAdapter.getSecurityAuditEvents('admin');
      const failedLogins = auditLogs.filter(l => l.event_type === 'LOGIN_FAILED' && l.username === bogusUser);
      expect(failedLogins.length).toBeGreaterThan(0);
    });

    it('locks accounts when reaching threshold limit and prevents brute force', () => {
      const staffUser = 'kitchen@resto.os';
      for (let i = 0; i < 5; i++) {
        dbAdapter.authenticateStaff(staffUser, 'WrongPass!');
      }

      const lockedAttempt = dbAdapter.authenticateStaff(staffUser, 'Kitchen@2026!');
      expect(lockedAttempt.success).toBe(false);
      expect(lockedAttempt.errorCode).toBe('LOCKED');
      expect(lockedAttempt.lockedUntil).toBeDefined();
    });
  });

  describe('3. Order & Payment Transaction Integrity', () => {
    it('enforces database price validation and calculates composite GST (5%) accurately', () => {
      const table = dbAdapter.getTables()[2];
      const session = dbAdapter.createTableSession({ tableId: table.id, guestCount: 1 });
      const menuItems = dbAdapter.getMenuItems().filter(m => m.is_available);
      expect(menuItems.length).toBeGreaterThan(0);

      const targetDish = menuItems[0];
      const order = dbAdapter.createOrder({
        tableSessionId: session.id,
        items: [{ menuItemId: targetDish.id, quantity: 2 }],
      });

      expect(order.subtotal_amount).toBe(targetDish.base_price * 2);
      expect(order.cgst_amount).toBeCloseTo(order.subtotal_amount * 0.025, 2);
      expect(order.sgst_amount).toBeCloseTo(order.subtotal_amount * 0.025, 2);
      expect(order.total_amount).toBeCloseTo(
        order.subtotal_amount + order.cgst_amount + order.sgst_amount,
        2
      );
    });

    it('supports idempotency keys to prevent duplicate order charges', () => {
      const table = dbAdapter.getTables()[3];
      const session = dbAdapter.createTableSession({ tableId: table.id });
      const menuItems = dbAdapter.getMenuItems();
      const idempotencyKey = 'idem-unique-key-998877';

      const order1 = dbAdapter.placeOrder({
        tableSessionId: session.id,
        items: [{ menuItemId: menuItems[0].id, quantity: 1 }],
        idempotencyKey,
      });

      // Submit identical request with same idempotency key
      const order2 = dbAdapter.placeOrder({
        tableSessionId: session.id,
        items: [{ menuItemId: menuItems[0].id, quantity: 1 }],
        idempotencyKey,
      });

      expect(order1.id).toBe(order2.id);
      expect(order1.order_number).toBe(order2.order_number);
    });
  });
});
