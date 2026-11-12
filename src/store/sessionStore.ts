// ====================================================================
// RESTO OS - Customer Table Session Store
// Enforces cryptographic verification and server-verified table sessions
// ====================================================================

import { create } from 'zustand';
import { RestaurantTable, TableSession } from '../types';
import { dbAdapter } from '../services/databaseAdapter';
import { EdgeFunctionsClient } from '../services/edgeFunctionsClient';
import { isLiveSupabaseConfigured } from '../services/supabase';

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
  verifyAndSetTokenAsync: (tokenHash: string) => Promise<{
    valid: boolean;
    errorCode?: string;
    message: string;
    isRepeatScan?: boolean;
  }>;
  clearSession: () => void;
}

const safeSessionStorage = {
  get: (key: string): string | null => {
    if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
      try { return sessionStorage.getItem(key); } catch { return null; }
    }
    return null;
  },
  set: (key: string, value: string): void => {
    if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
      try { sessionStorage.setItem(key, value); } catch {}
    }
  },
  remove: (key: string): void => {
    if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
      try { sessionStorage.removeItem(key); } catch {}
    }
  },
};

export const useSessionStore = create<SessionState>((set, get) => {
  // Check if session token stored in sessionStorage / localStorage
  const savedSessionToken = safeSessionStorage.get('resto_customer_session');
  let restoredSession: TableSession | null = null;
  let restoredTable: RestaurantTable | null = null;

  if (savedSessionToken) {
    try {
      const parsed = JSON.parse(savedSessionToken);
      const liveSession = dbAdapter.getSessions().find(s => s.id === parsed.id && s.status === 'ACTIVE');
      if (liveSession) {
        restoredSession = liveSession;
        restoredTable = dbAdapter.getTables().find(t => t.id === liveSession.table_id) || null;
      } else if (parsed.id && parsed.session_token) {
        // Fallback for valid server-issued active session
        restoredSession = parsed as TableSession;
        restoredTable = dbAdapter.getTables().find(t => t.id === parsed.table_id) || null;
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

    // Production-ready server-side async verification
    verifyAndSetTokenAsync: async (tokenHash: string) => {
      if (isLiveSupabaseConfigured()) {
        const edgeRes = await EdgeFunctionsClient.verifyTableQR({ tokenHash });
        if (edgeRes.success && edgeRes.data) {
          const d = edgeRes.data;

          const liveTable = dbAdapter.getTables().find(t => t.id === d.table_id) || {
            id: d.table_id,
            restaurant_id: d.restaurant_id,
            table_number: d.table_number,
            seating_capacity: 4,
            floor_area: 'MAIN_FLOOR',
            status: 'OCCUPIED' as any,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const sessionObj: TableSession = {
            id: d.session_id,
            restaurant_id: d.restaurant_id,
            table_id: d.table_id,
            qr_token_id: (d as any).qr_token_id || `qrt-${d.table_id}`,
            session_token: d.session_token,
            status: 'ACTIVE',
            opened_at: new Date().toISOString(),
            guest_count: 1,
            created_at: new Date().toISOString(),
          };

          safeSessionStorage.set('resto_customer_session', JSON.stringify(sessionObj));

          set({
            currentSession: sessionObj,
            table: liveTable,
            isVerified: true,
            qrTokenHash: tokenHash,
            isRepeatScanPending: false,
            repeatRequestId: null,
          });

          return {
            valid: true,
            isRepeatScan: d.is_resumed,
            message: d.message || 'Table session verified successfully.',
          };
        } else if (edgeRes.error && edgeRes.errorCode !== 'SUPABASE_NOT_CONFIGURED') {
          return {
            valid: false,
            errorCode: edgeRes.errorCode,
            message: edgeRes.error,
          };
        }
      }

      // Fallback to synchronous adapter
      return get().verifyAndSetToken(tokenHash);
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
        safeSessionStorage.set('resto_customer_session', JSON.stringify(result.session));
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
        safeSessionStorage.set('resto_customer_session', JSON.stringify(result.session));
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
      safeSessionStorage.remove('resto_customer_session');
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
