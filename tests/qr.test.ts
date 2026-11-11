import { describe, it, expect, beforeEach } from 'vitest';
import { dbAdapter } from '../src/services/databaseAdapter';
import { QRService } from '../src/services/qrService';

describe('Daily Dynamic QR & Session Verification System', () => {
  beforeEach(() => {
    dbAdapter.ensureTodayQRs();
  });

  it('QR-01: Generates active daily tokens for all dining tables', () => {
    const tokens = dbAdapter.getQRTokens();
    const tables = dbAdapter.getTables();
    expect(tokens.length).toBeGreaterThanOrEqual(tables.length);

    const firstToken = tokens[0];
    expect(firstToken.is_revoked).toBe(false);
    expect(firstToken.token_hash).toContain('qr-');
  });

  it('QR-02: Successfully verifies a valid daily token and returns table session', () => {
    const token = dbAdapter.getQRTokens().find(t => !t.is_revoked);
    expect(token).toBeDefined();

    if (token) {
      const result = dbAdapter.verifyQRToken(token.token_hash);
      expect(result.valid).toBe(true);
      expect(result.table).toBeDefined();
    }
  });

  it('QR-03: Rejects unknown / invalid token hashes', () => {
    const result = dbAdapter.verifyQRToken('invalid-fake-token-hash-1234');
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('INVALID_TOKEN');
  });

  it('QR-04: Rejects revoked QR codes with REVOKED_TOKEN code', () => {
    const token = dbAdapter.getQRTokens()[0];
    dbAdapter.revokeQRToken(token.id, 'Compromised photo');

    const result = dbAdapter.verifyQRToken(token.token_hash);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('REVOKED_TOKEN');
  });

  it('QR-05: Detects repeat scan on active session and notifies cash counter', () => {
    // Pick an available table
    const table = dbAdapter.getTables().find(t => t.status === 'AVAILABLE') || dbAdapter.getTables()[1];
    const token = dbAdapter.getQRTokens().find(t => t.table_id === table.id && !t.is_revoked);
    expect(token).toBeDefined();

    if (token) {
      // First scan establishes session
      const firstScan = dbAdapter.verifyQRToken(token.token_hash);
      expect(firstScan.valid).toBe(true);

      // Second scan on the same session triggers repeat scan alert
      const secondScan = dbAdapter.verifyQRToken(token.token_hash);
      expect(secondScan.valid).toBe(true);
      expect(secondScan.isRepeatScan).toBe(true);
      expect(secondScan.repeatRequestId).toBeDefined();
    }
  });
});
