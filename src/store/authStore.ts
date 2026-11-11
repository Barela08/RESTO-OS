// ====================================================================
// RESTO OS - Authentication & Staff Role Store
// ====================================================================

import { create } from 'zustand';
import { Profile, StaffRoleType } from '../types';
import { dbAdapter } from '../services/databaseAdapter';

interface AuthState {
  currentProfile: Profile | null;
  role: StaffRoleType | null;
  isAuthenticated: boolean;
  loginAsRole: (role: StaffRoleType) => void;
  loginWithCredentials: (email: string, role: StaffRoleType) => boolean;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Check if session stored in localStorage
  let storedProfile: string | null = null;
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    storedProfile = localStorage.getItem('resto_auth_profile');
  }
  let initialProfile: Profile | null = null;
  let initialRole: StaffRoleType | null = null;

  if (storedProfile) {
    try {
      initialProfile = JSON.parse(storedProfile);
      initialRole = initialProfile?.role_id || null;
    } catch {
      // Ignored
    }
  }

  // Default to Admin in development if not set, or let user log in
  if (!initialProfile) {
    const adminProfile = dbAdapter.getProfiles().find(p => p.role_id === 'admin') || null;
    initialProfile = adminProfile;
    initialRole = 'admin';
  }

  return {
    currentProfile: initialProfile,
    role: initialRole,
    isAuthenticated: !!initialProfile,

    loginAsRole: (role: StaffRoleType) => {
      const profile = dbAdapter.getProfiles().find(p => p.role_id === role);
      if (profile) {
        localStorage.setItem('resto_auth_profile', JSON.stringify(profile));
        set({
          currentProfile: profile,
          role: profile.role_id,
          isAuthenticated: true,
        });
      }
    },

    loginWithCredentials: (email: string, role: StaffRoleType) => {
      const profile = dbAdapter.getProfiles().find(p => p.email.toLowerCase() === email.toLowerCase());
      if (profile) {
        localStorage.setItem('resto_auth_profile', JSON.stringify(profile));
        set({
          currentProfile: profile,
          role: profile.role_id,
          isAuthenticated: true,
        });
        return true;
      } else {
        // Create an ad-hoc profile for demo staff login
        const newProf: Profile = {
          id: `p-${Date.now()}`,
          restaurant_id: 'rest-001-main',
          email,
          full_name: email.split('@')[0].toUpperCase(),
          role_id: role,
          is_active: true,
          created_at: new Date().toISOString(),
        };
        localStorage.setItem('resto_auth_profile', JSON.stringify(newProf));
        set({
          currentProfile: newProf,
          role: newProf.role_id,
          isAuthenticated: true,
        });
        return true;
      }
    },

    logout: () => {
      localStorage.removeItem('resto_auth_profile');
      set({
        currentProfile: null,
        role: null,
        isAuthenticated: false,
      });
    },
  };
});
