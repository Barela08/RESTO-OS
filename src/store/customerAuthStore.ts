// ====================================================================
// RESTO OS - Customer Authentication & Verified Identity Store
// Supports Mobile OTP verification, Existing User Recognition & Loyalty Sync
// ====================================================================

import { create } from 'zustand';
import { Customer, LoyaltyAccount, LoyaltyReward } from '../types';
import { dbAdapter } from '../services/databaseAdapter';
import { useSessionStore } from './sessionStore';

interface CustomerAuthState {
  customer: Customer | null;
  loyaltyAccount: LoyaltyAccount | null;
  rewards: LoyaltyReward[];
  isLoggedIn: boolean;
  isOtpSent: boolean;
  otpPhone: string;
  activeOtpCode?: string; // Stored for test/demo ease in UI
  loginError: string | null;

  // Actions
  requestOtp: (phone: string) => { success: boolean; message: string; otpCode?: string };
  verifyOtp: (phone: string, otpCode: string) => {
    success: boolean;
    isExistingCustomer: boolean;
    customer?: Customer;
    message: string;
  };
  completeRegistration: (phone: string, fullName: string) => Customer;
  updateProfileName: (name: string) => void;
  logout: () => void;
  refreshLoyaltyData: () => void;
}

const safeStorage = {
  get: (key: string): string | null => {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try { return localStorage.getItem(key); } catch { return null; }
    }
    return null;
  },
  set: (key: string, value: string): void => {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try { localStorage.setItem(key, value); } catch {}
    }
  },
  remove: (key: string): void => {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try { localStorage.removeItem(key); } catch {}
    }
  },
};

export const useCustomerAuthStore = create<CustomerAuthState>((set, get) => {
  // Check if customer session is preserved in localStorage
  const savedCustomerJson = safeStorage.get('resto_customer_auth');

  let initialCustomer: Customer | null = null;
  let initialLoyalty: LoyaltyAccount | null = null;
  let initialRewards: LoyaltyReward[] = [];

  if (savedCustomerJson) {
    try {
      const parsed = JSON.parse(savedCustomerJson);
      // Validate customer against live DB adapter
      const existing = dbAdapter.getCustomers().find(c => c.id === parsed.id || c.phone === parsed.phone);
      if (existing) {
        initialCustomer = existing;
        initialLoyalty = dbAdapter.getLoyaltyAccounts().find(a => a.customer_id === existing.id) || null;
        if (initialLoyalty) {
          initialRewards = dbAdapter.getLoyaltyRewards().filter(r => r.loyalty_account_id === initialLoyalty?.id);
        }
      }
    } catch {
      // Ignored
    }
  }

  // Fallback demo customer if already in DB for immediate exploration
  if (!initialCustomer) {
    const demoCust = dbAdapter.getCustomers()[0];
    if (demoCust) {
      initialCustomer = demoCust;
      initialLoyalty = dbAdapter.getLoyaltyAccounts().find(a => a.customer_id === demoCust.id) || null;
      if (initialLoyalty) {
        initialRewards = dbAdapter.getLoyaltyRewards().filter(r => r.loyalty_account_id === initialLoyalty?.id);
      }
    }
  }

  return {
    customer: initialCustomer,
    loyaltyAccount: initialLoyalty,
    rewards: initialRewards,
    isLoggedIn: !!initialCustomer,
    isOtpSent: false,
    otpPhone: '',
    activeOtpCode: undefined,
    loginError: null,

    requestOtp: (phone: string) => {
      set({ loginError: null });
      try {
        const result = dbAdapter.requestCustomerOtp(phone);
        set({
          isOtpSent: true,
          otpPhone: dbAdapter.normalizePhoneNumber(phone),
          activeOtpCode: result.otp,
        });
        return {
          success: true,
          message: result.message,
          otpCode: result.otp,
        };
      } catch (err: any) {
        set({ loginError: err.message || 'Failed to send OTP' });
        return {
          success: false,
          message: err.message || 'Failed to send OTP',
        };
      }
    },

    verifyOtp: (phone: string, otpCode: string) => {
      set({ loginError: null });
      const res = dbAdapter.verifyCustomerOtp(phone, otpCode);
      if (!res.success) {
        set({ loginError: res.message });
        return {
          success: false,
          isExistingCustomer: false,
          message: res.message,
        };
      }

      if (res.customer) {
        // Existing registered customer recognized!
        const cust = res.customer;
        const loyalty = dbAdapter.getLoyaltyAccounts().find(a => a.customer_id === cust.id) || null;
        const rewards = loyalty ? dbAdapter.getLoyaltyRewards().filter(r => r.loyalty_account_id === loyalty.id) : [];

        safeStorage.set('resto_customer_auth', JSON.stringify(cust));

        // Sync with active table session if present
        const currentSession = useSessionStore.getState().currentSession;
        if (currentSession) {
          dbAdapter.linkSessionToCustomer(currentSession.id, cust.id);
          useSessionStore.getState().setCustomerInfo(cust.full_name, cust.phone);
        }

        set({
          customer: cust,
          loyaltyAccount: loyalty,
          rewards,
          isLoggedIn: true,
          isOtpSent: false,
          otpPhone: '',
          activeOtpCode: undefined,
          loginError: null,
        });

        return {
          success: true,
          isExistingCustomer: true,
          customer: cust,
          message: 'Welcome back! Your existing account and loyalty rewards have been restored.',
        };
      }

      // Customer is new, phone is verified, needs name registration
      return {
        success: true,
        isExistingCustomer: false,
        message: 'Phone verified! Please enter your full name to complete registration.',
      };
    },

    completeRegistration: (phone: string, fullName: string) => {
      const { customer, loyalty } = dbAdapter.registerOrCompleteCustomer({ phone, fullName });
      const rewards = dbAdapter.getLoyaltyRewards().filter(r => r.loyalty_account_id === loyalty.id);

      safeStorage.set('resto_customer_auth', JSON.stringify(customer));

      // Link to table session
      const currentSession = useSessionStore.getState().currentSession;
      if (currentSession) {
        dbAdapter.linkSessionToCustomer(currentSession.id, customer.id);
        useSessionStore.getState().setCustomerInfo(customer.full_name, customer.phone);
      }

      set({
        customer,
        loyaltyAccount: loyalty,
        rewards,
        isLoggedIn: true,
        isOtpSent: false,
        otpPhone: '',
        activeOtpCode: undefined,
        loginError: null,
      });

      return customer;
    },

    updateProfileName: (name: string) => {
      const current = get().customer;
      if (!current) return;
      current.full_name = name;
      safeStorage.set('resto_customer_auth', JSON.stringify(current));
      set({ customer: { ...current } });

      const currentSession = useSessionStore.getState().currentSession;
      if (currentSession) {
        useSessionStore.getState().setCustomerInfo(name, current.phone);
      }
    },

    logout: () => {
      safeStorage.remove('resto_customer_auth');
      set({
        customer: null,
        loyaltyAccount: null,
        rewards: [],
        isLoggedIn: false,
        isOtpSent: false,
        otpPhone: '',
        activeOtpCode: undefined,
        loginError: null,
      });
    },

    refreshLoyaltyData: () => {
      const current = get().customer;
      if (!current) return;
      const loyalty = dbAdapter.getLoyaltyAccounts().find(a => a.customer_id === current.id) || null;
      const rewards = loyalty ? dbAdapter.getLoyaltyRewards().filter(r => r.loyalty_account_id === loyalty.id) : [];
      set({ loyaltyAccount: loyalty, rewards });
    },
  };
});
