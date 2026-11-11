// ====================================================================
// RESTO OS - Customer Table Session Store
// Enforces cryptographic verification and server-verified table sessions
// ====================================================================

import { create } from 'zustand';
import { RestaurantTable, TableSession } from '../types';
import { dbAdapter } from '../services/databaseAdapter';

interface SessionState {
  currentSession: TableSession | null;
  table: RestaurantTable | null;
  isVerified: boolean;
  qrTokenHash: string | null;
  isRepeatScanPending: boolean;
  repeatRequestId: string | null;
  customerName: string;
  customerPhone: string;
  setCustomerInfo: (name: string, phone: string) => void;
  verifyAndSetToken: (tokenHash: string) => {
    valid: boolean;
    errorCode?: string;
    message: string;
    isRepeatScan?: boolean;
  };
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => {
  // Check if session token stored in sessionStorage / localStorage
  let savedSessionToken: string | null = null;
  if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
    savedSessionToken = sessionStorage.getItem('resto_customer_session');
  }
  let restoredSession: TableSession | null = null;
  let restoredTable: RestaurantTable | null = null;

  if (savedSessionToken) {
    try {
      const parsed = JSON.parse(savedSessionToken);
      const liveSession = dbAdapter.getSessions().find(s => s.id === parsed.id && s.status === 'ACTIVE');
      if (liveSession) {
        restoredSession = liveSession;
        restoredTable = dbAdapter.getTables().find(t => t.id === liveSession.table_id) || null;
      }
    } catch {
      // Ignored
    }
  }

  return {
    currentSession: restoredSession,
    table: restoredTable,
    isVerified: !!restoredSession,
    qrTokenHash: null,
    isRepeatScanPending: false,
    repeatRequestId: null,
    customerName: restoredSession?.customer_name || '',
    customerPhone: restoredSession?.customer_phone || '',

    setCustomerInfo: (name: string, phone: string) => {
      set({ customerName: name, customerPhone: phone });
      const current = get().currentSession;
      if (current) {
        current.customer_name = name;
        current.customer_phone = phone;
      }
    },

    verifyAndSetToken: (tokenHash: string) => {
      const result = dbAdapter.verifyQRToken(tokenHash);

      if (!result.valid) {
        return {
          valid: false,
          errorCode: result.errorCode,
          message: result.message,
        };
      }

      if (result.isRepeatScan && result.session) {
        sessionStorage.setItem('resto_customer_session', JSON.stringify(result.session));
        set({
          isRepeatScanPending: false,
          repeatRequestId: null,
          currentSession: result.session,
          table: result.table || null,
          isVerified: true,
          qrTokenHash: tokenHash,
        });
        return {
          valid: true,
          isRepeatScan: true,
          message: result.message,
        };
      }

      if (result.session && result.table) {
        sessionStorage.setItem('resto_customer_session', JSON.stringify(result.session));
        set({
          currentSession: result.session,
          table: result.table,
          isVerified: true,
          qrTokenHash: tokenHash,
          isRepeatScanPending: false,
        });
      }

      return {
        valid: true,
        isRepeatScan: false,
        message: result.message,
      };
    },

    clearSession: () => {
      sessionStorage.removeItem('resto_customer_session');
      set({
        currentSession: null,
        table: null,
        isVerified: false,
        qrTokenHash: null,
        isRepeatScanPending: false,
        repeatRequestId: null,
      });
    },
  };
});
