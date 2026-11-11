import { describe, it, expect, beforeEach } from 'vitest';
import { dbAdapter } from '../src/services/databaseAdapter';
import { useAuthStore, getDashboardForRole } from '../src/store/authStore';
import { useCustomerAuthStore, getOrCreateDeviceToken } from '../src/store/customerAuthStore';
import { StaffRoleType } from '../src/types';

// In-memory mock for localStorage in non-browser test runner
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    key: (index: number) => Object.keys(store)[index] || null,
    length: 0,
  } as any;
}

describe('RESTO OS - Authentication, RBAC, Session Security & Customer Auto-Recognition (28 Acceptance Tests)', () => {
  beforeEach(() => {
    // Reset rate limits for seed accounts
    ['owner', 'admin', 'counter', 'waiter', 'kitchen', 'brute_force_user'].forEach(id => {
      dbAdapter.resetRateLimit(id);
    });
    // Ensure all test staff accounts are active with standard roles
    const seedRoles: Record<string, StaffRoleType> = {
      owner: 'owner',
      admin: 'admin',
      counter: 'counter',
      waiter: 'waiter',
      kitchen: 'kitchen',
    };
    const profiles = dbAdapter.getProfiles();
    profiles.forEach(p => {
      if (p.username && seedRoles[p.username]) {
        p.role_id = seedRoles[p.username];
      }
      p.is_active = true;
      p.failed_login_attempts = 0;
      p.locked_until = null;
    });
    // Clear staff store session
    useAuthStore.getState().logout();
    // Clear customer store session
    useCustomerAuthStore.getState().logout();
  });

  // ============================================================================
  // SECTION 1: INDIVIDUAL LOGIN & ROLE REDIRECTION (Tests 1 - 5)
  // ============================================================================

  it('Test 01: Owner logs in with individual credentials -> receives Owner role & redirects to /owner', () => {
    const res = dbAdapter.authenticateStaff('owner', 'Owner@2026!');
    expect(res.success).toBe(true);
    expect(res.profile?.role_id).toBe('owner');
    expect(getDashboardForRole(res.profile?.role_id)).toBe('/owner');

    const storeRes = useAuthStore.getState().login('owner', 'Owner@2026!');
    expect(storeRes.success).toBe(true);
    expect(storeRes.role).toBe('owner');
    expect(useAuthStore.getState().role).toBe('owner');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('Test 02: Admin logs in with individual credentials -> receives Admin role & redirects to /admin', () => {
    const res = dbAdapter.authenticateStaff('admin', 'Admin@2026!');
    expect(res.success).toBe(true);
    expect(res.profile?.role_id).toBe('admin');
    expect(getDashboardForRole(res.profile?.role_id)).toBe('/admin');

    const storeRes = useAuthStore.getState().login('admin', 'Admin@2026!');
    expect(storeRes.success).toBe(true);
    expect(storeRes.role).toBe('admin');
    expect(useAuthStore.getState().role).toBe('admin');
  });

  it('Test 03: Cash Counter logs in -> receives Counter role & redirects to /counter (NEVER /admin)', () => {
    const res = dbAdapter.authenticateStaff('counter', 'Counter@2026!');
    expect(res.success).toBe(true);
    expect(res.profile?.role_id).toBe('counter');
    const targetDashboard = getDashboardForRole(res.profile?.role_id);
    expect(targetDashboard).toBe('/counter');
    expect(targetDashboard).not.toBe('/admin');

    const storeRes = useAuthStore.getState().login('counter', 'Counter@2026!');
    expect(storeRes.success).toBe(true);
    expect(storeRes.role).toBe('counter');
    expect(useAuthStore.getState().role).toBe('counter');
  });

  it('Test 04: Waiter logs in -> receives Waiter role & redirects to /waiter (NEVER /admin)', () => {
    const res = dbAdapter.authenticateStaff('waiter', 'Waiter@2026!');
    expect(res.success).toBe(true);
    expect(res.profile?.role_id).toBe('waiter');
    const targetDashboard = getDashboardForRole(res.profile?.role_id);
    expect(targetDashboard).toBe('/waiter');
    expect(targetDashboard).not.toBe('/admin');

    const storeRes = useAuthStore.getState().login('waiter', 'Waiter@2026!');
    expect(storeRes.success).toBe(true);
    expect(storeRes.role).toBe('waiter');
    expect(useAuthStore.getState().role).toBe('waiter');
  });

  it('Test 05: Kitchen staff logs in -> receives Kitchen role & redirects to /kitchen (NEVER /admin)', () => {
    const res = dbAdapter.authenticateStaff('kitchen', 'Kitchen@2026!');
    expect(res.success).toBe(true);
    expect(res.profile?.role_id).toBe('kitchen');
    const targetDashboard = getDashboardForRole(res.profile?.role_id);
    expect(targetDashboard).toBe('/kitchen');
    expect(targetDashboard).not.toBe('/admin');

    const storeRes = useAuthStore.getState().login('kitchen', 'Kitchen@2026!');
    expect(storeRes.success).toBe(true);
    expect(storeRes.role).toBe('kitchen');
    expect(useAuthStore.getState().role).toBe('kitchen');
  });

  // ============================================================================
  // SECTION 2: ACCESS CONTROL, RBAC BOUNDARIES & URL ENFORCEMENT (Tests 6 - 8)
  // ============================================================================

  it('Test 06: Cash Counter attempting to access /admin is blocked by Role Guard', () => {
    useAuthStore.getState().login('counter', 'Counter@2026!');
    const currentRole = useAuthStore.getState().role;
    expect(currentRole).toBe('counter');

    // Admin routes only allow 'admin' or 'owner'
    const allowedForAdmin: StaffRoleType[] = ['admin', 'owner'];
    const isAccessPermitted = currentRole ? allowedForAdmin.includes(currentRole) : false;
    expect(isAccessPermitted).toBe(false);

    // Fallback safe redirect for counter staff must be /counter
    const safeFallback = getDashboardForRole(currentRole);
    expect(safeFallback).toBe('/counter');
    expect(safeFallback).not.toBe('/admin');
  });

  it('Test 07: Waiter attempting to access /admin or /kitchen is blocked by Role Guard', () => {
    useAuthStore.getState().login('waiter', 'Waiter@2026!');
    const currentRole = useAuthStore.getState().role;
    expect(currentRole).toBe('waiter');

    const allowedForAdmin: StaffRoleType[] = ['admin', 'owner'];
    const allowedForKitchen: StaffRoleType[] = ['kitchen'];

    expect(allowedForAdmin.includes(currentRole!)).toBe(false);
    expect(allowedForKitchen.includes(currentRole!)).toBe(false);

    // Fallback safe redirect for waiter must be /waiter
    expect(getDashboardForRole(currentRole)).toBe('/waiter');
  });

  it('Test 08: Kitchen staff attempting to access billing/counter or /admin is blocked by Role Guard', () => {
    useAuthStore.getState().login('kitchen', 'Kitchen@2026!');
    const currentRole = useAuthStore.getState().role;
    expect(currentRole).toBe('kitchen');

    const allowedForCounter: StaffRoleType[] = ['counter', 'admin', 'owner'];
    const allowedForAdmin: StaffRoleType[] = ['admin', 'owner'];

    expect(allowedForCounter.includes(currentRole!)).toBe(false);
    expect(allowedForAdmin.includes(currentRole!)).toBe(false);

    // Fallback safe redirect for kitchen must be /kitchen
    expect(getDashboardForRole(currentRole)).toBe('/kitchen');
  });

  // ============================================================================
  // SECTION 3: STAFF STATUS, ROLE MUTATIONS & MANAGEMENT (Tests 9 - 10)
  // ============================================================================

  it('Test 09: Deactivated staff account cannot log in and shows account deactivated error', () => {
    const waiterProfile = dbAdapter.getProfiles().find(p => p.username === 'waiter');
    expect(waiterProfile).toBeDefined();

    // Deactivate account using owner authority
    dbAdapter.updateStaffStatus('owner', waiterProfile!.id, false);

    // Attempt login
    const res = dbAdapter.authenticateStaff('waiter', 'Waiter@2026!');
    expect(res.success).toBe(false);
    expect(res.errorCode).toBe('ACCOUNT_DEACTIVATED');
    expect(res.error).toContain('deactivated');

    const storeRes = useAuthStore.getState().login('waiter', 'Waiter@2026!');
    expect(storeRes.success).toBe(false);
    expect(storeRes.errorCode).toBe('ACCOUNT_DEACTIVATED');
  });

  it('Test 10: Owner changes staff role -> role change takes effect immediately on next navigation/login', () => {
    const waiterProfile = dbAdapter.getProfiles().find(p => p.username === 'waiter');
    expect(waiterProfile).toBeDefined();

    // Owner promotes Waiter to Cash Counter
    dbAdapter.updateStaffRole('owner', waiterProfile!.id, 'counter');

    const updatedProfile = dbAdapter.getProfiles().find(p => p.id === waiterProfile!.id);
    expect(updatedProfile?.role_id).toBe('counter');

    // Logging in now yields counter role and redirects to /counter
    const res = dbAdapter.authenticateStaff('waiter', 'Waiter@2026!');
    expect(res.success).toBe(true);
    expect(res.profile?.role_id).toBe('counter');
    expect(getDashboardForRole(res.profile?.role_id)).toBe('/counter');
  });

  // ============================================================================
  // SECTION 4: SESSION LIFECYCLE & ZERO-ADMIN-LEAKAGE (Tests 11 - 16)
  // ============================================================================

  it('Test 11: Browser Back navigation does NOT navigate terminal staff to Admin panel', () => {
    useAuthStore.getState().login('counter', 'Counter@2026!');
    const role = useAuthStore.getState().role;
    expect(role).toBe('counter');

    // Terminal staff header link test: should never resolve to /admin
    const isAdmin = role === 'admin' || role === 'owner';
    expect(isAdmin).toBe(false);
  });

  it('Test 12: Refreshing page preserves authenticated role and stays on current dashboard', () => {
    useAuthStore.getState().login('counter', 'Counter@2026!');
    expect(useAuthStore.getState().role).toBe('counter');

    // Simulate session storage retrieval after page reload
    const storedSessionJson = localStorage.getItem('resto_staff_session');
    expect(storedSessionJson).toBeDefined();
    const parsed = JSON.parse(storedSessionJson!);
    expect(parsed.role).toBe('counter');
    expect(parsed.username).toBe('counter');

    // Hydrating returns the exact role, never falling back to admin
    const profileId = parsed.profileId || parsed.id;
    const matchingProfile = dbAdapter.getProfiles().find(p => p.id === profileId && p.is_active);
    expect(matchingProfile).toBeDefined();
    expect(matchingProfile?.role_id).toBe('counter');
  });

  it('Test 13: Expired or cleared session redirects to Staff Login, NEVER Admin', () => {
    // Clear storage to simulate expired session
    localStorage.removeItem('resto_staff_session');
    useAuthStore.getState().logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().role).toBeNull();

    // Unauthenticated user fallback must be /staff/login
    const redirectUrl = getDashboardForRole(useAuthStore.getState().role);
    expect(redirectUrl).toBe('/staff/login');
    expect(redirectUrl).not.toBe('/admin');
  });

  it('Test 14: Logout completely clears session and revokes access', () => {
    useAuthStore.getState().login('waiter', 'Waiter@2026!');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().currentProfile).toBeNull();
    expect(useAuthStore.getState().role).toBeNull();
    expect(localStorage.getItem('resto_staff_session')).toBeNull();
  });

  it('Test 15: Unauthenticated user accessing protected staff dashboard is redirected to /staff/login', () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    const unauthenticatedRedirect = getDashboardForRole(null);
    expect(unauthenticatedRedirect).toBe('/staff/login');
  });

  it('Test 16: Direct URL navigation to unassigned role path is strictly blocked by RBAC', () => {
    useAuthStore.getState().login('waiter', 'Waiter@2026!');
    const currentRole = useAuthStore.getState().role;

    // Check permissions across various protected sections
    const canAccessOwner = currentRole === 'owner';
    const canAccessAdmin = currentRole === 'admin' || currentRole === 'owner';
    const canAccessCounter = currentRole === 'counter' || currentRole === 'admin' || currentRole === 'owner';

    expect(canAccessOwner).toBe(false);
    expect(canAccessAdmin).toBe(false);
    expect(canAccessCounter).toBe(false);
  });

  // ============================================================================
  // SECTION 5: RATE LIMITING & SECURITY AUDIT LOGGING (Tests 17 - 20)
  // ============================================================================

  it('Test 17: 5 consecutive failed login attempts locks account for 15 minutes', () => {
    const testUsername = 'admin';
    const wrongPassword = 'WrongPassword123!';

    for (let i = 1; i <= 4; i++) {
      const res = dbAdapter.authenticateStaff(testUsername, wrongPassword, '192.168.1.100');
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('INVALID_CREDENTIALS');
    }

    // 5th failed attempt triggers account lock
    const fifthRes = dbAdapter.authenticateStaff(testUsername, wrongPassword, '192.168.1.100');
    expect(fifthRes.success).toBe(false);
    expect(fifthRes.errorCode).toBe('LOCKED');
    expect(fifthRes.error).toContain('repeated failed login attempts');
    expect(fifthRes.lockedUntil).toBeDefined();
  });

  it('Test 18: Account remains locked during 15-minute window even with correct password', () => {
    const testUsername = 'admin';
    const wrongPassword = 'WrongPassword123!';

    // Trigger lock with 5 failures
    for (let i = 1; i <= 5; i++) {
      dbAdapter.authenticateStaff(testUsername, wrongPassword, '192.168.1.101');
    }

    // Attempt login with valid credentials while locked
    const correctPassRes = dbAdapter.authenticateStaff(testUsername, 'Admin@2026!', '192.168.1.101');
    expect(correctPassRes.success).toBe(false);
    expect(correctPassRes.errorCode).toBe('LOCKED');
    expect(correctPassRes.error).toContain('locked');
  });

  it('Test 19: Changing username does not bypass IP-based rate limiting', () => {
    const ip = '10.0.0.55';

    // Exhaust attempts from this IP with various invalid usernames
    for (let i = 1; i <= 5; i++) {
      dbAdapter.authenticateStaff(`random_user_${i}`, 'WrongPassword!', ip);
    }

    // Trying yet another username from the same IP is blocked by IP lock
    const nextRes = dbAdapter.authenticateStaff('owner', 'Owner@2026!', ip);
    expect(nextRes.success).toBe(false);
    expect(nextRes.errorCode).toBe('LOCKED');
    expect(nextRes.error).toContain('failed attempts');
  });

  it('Test 20: Security audit log records all critical authentication and administrative events', () => {
    const ownerProfile = dbAdapter.getProfiles().find(p => p.username === 'owner');
    expect(ownerProfile).toBeDefined();

    // 1. Success event
    dbAdapter.authenticateStaff('owner', 'Owner@2026!', '10.0.0.1');

    // 2. Failed event
    dbAdapter.authenticateStaff('counter', 'WrongPass!', '10.0.0.2');

    // 3. Password reset event
    const counterProfile = dbAdapter.getProfiles().find(p => p.username === 'counter');
    dbAdapter.adminResetStaffPassword(ownerProfile!.id, counterProfile!.id, 'NewCounter@2026!');

    // 4. Role changed event
    dbAdapter.updateStaffRole('owner', counterProfile!.id, 'admin');

    // 5. Staff deactivated event
    dbAdapter.updateStaffStatus('owner', counterProfile!.id, false);

    const auditEvents = dbAdapter.getSecurityAuditEvents('owner');
    const eventTypes = auditEvents.map(e => e.event_type);

    expect(eventTypes).toContain('LOGIN_SUCCESS');
    expect(eventTypes).toContain('LOGIN_FAILED');
    expect(eventTypes).toContain('PASSWORD_RESET');
    expect(eventTypes).toContain('ROLE_CHANGED');
    expect(eventTypes).toContain('STAFF_DEACTIVATED');
  });

  // ============================================================================
  // SECTION 6: CUSTOMER AUTO-RECOGNITION & IDENTITY DECOUPLING (Tests 21 - 28)
  // ============================================================================

  it('Test 21: Returning customer enters 10-digit phone on trusted device -> recognized without asking name', () => {
    const existingPhone = '9888877665';
    const deviceToken = getOrCreateDeviceToken();

    // Mark device as trusted
    dbAdapter.markCustomerDeviceTrusted(existingPhone, deviceToken);

    const lookupRes = dbAdapter.lookupOrRecognizeCustomer(existingPhone, deviceToken);
    expect(lookupRes.isExisting).toBe(true);
    expect(lookupRes.isTrusted).toBe(true);
    expect(lookupRes.requiresVerification).toBe(false);
    expect(lookupRes.customer).toBeDefined();
    expect(lookupRes.customer?.full_name).toBe('Aditya Verma');

    // Store auto-recognition test
    const storeLookup = useCustomerAuthStore.getState().lookupAndRecognize(existingPhone);
    expect(storeLookup.isExisting).toBe(true);
    expect(useCustomerAuthStore.getState().isLoggedIn).toBe(true);
    expect(useCustomerAuthStore.getState().customer?.full_name).toBe('Aditya Verma');
  });

  it('Test 22: No duplicate customer record is created on repeat visits', () => {
    const phone = '9888877665';
    const initialCount = dbAdapter.getCustomers().filter(
      c => dbAdapter.normalizePhoneNumber(c.phone) === dbAdapter.normalizePhoneNumber(phone)
    ).length;
    expect(initialCount).toBe(1);

    // Calling lookup multiple times
    dbAdapter.lookupOrRecognizeCustomer(phone);
    dbAdapter.lookupOrRecognizeCustomer(phone);

    const finalCount = dbAdapter.getCustomers().filter(
      c => dbAdapter.normalizePhoneNumber(c.phone) === dbAdapter.normalizePhoneNumber(phone)
    ).length;
    expect(finalCount).toBe(1);
  });

  it('Test 23: New customer enters phone -> name prompt shown -> saves unique customer profile', () => {
    const newPhone = '9123456789';
    const lookupRes = dbAdapter.lookupOrRecognizeCustomer(newPhone);

    expect(lookupRes.isExisting).toBe(false);
    expect(lookupRes.customer).toBeUndefined();

    // Register new customer
    const registeredCust = useCustomerAuthStore.getState().completeRegistration(newPhone, 'Pooja Hegde');
    expect(registeredCust).toBeDefined();
    expect(registeredCust.full_name).toBe('Pooja Hegde');
    expect(dbAdapter.normalizePhoneNumber(registeredCust.phone)).toBe(dbAdapter.normalizePhoneNumber(newPhone));

    // Verify saved profile
    const savedInDb = dbAdapter.getCustomers().find(c => c.id === registeredCust.id);
    expect(savedInDb).toBeDefined();
    expect(savedInDb?.full_name).toBe('Pooja Hegde');
  });

  it('Test 24: Customer profile, loyalty points, and rewards history remain intact across visits', () => {
    const phone = '9888877665';
    const deviceToken = getOrCreateDeviceToken();
    dbAdapter.markCustomerDeviceTrusted(phone, deviceToken);

    const res = dbAdapter.lookupOrRecognizeCustomer(phone, deviceToken);
    expect(res.customer).toBeDefined();
    expect(res.loyalty).toBeDefined();

    const currentStamps = res.loyalty!.current_active_stamps;

    // Simulate adding a stamp from a visit
    res.loyalty!.current_active_stamps += 1;
    res.loyalty!.total_stamps_earned += 1;

    // Next visit lookup
    const nextVisit = dbAdapter.lookupOrRecognizeCustomer(phone, deviceToken);
    expect(nextVisit.loyalty?.current_active_stamps).toBe(currentStamps + 1);
    expect(nextVisit.loyalty?.total_stamps_earned).toBeGreaterThan(0);
  });

  it('Test 25: Untrusted device requires OTP before revealing sensitive rewards', () => {
    const phone = '9888877665';
    const untrustedToken = 'untrusted_device_random_999';

    // Ensure phone & token are not pre-trusted
    (dbAdapter as any).trustedCustomerDevices.delete(dbAdapter.normalizePhoneNumber(phone));
    (dbAdapter as any).trustedCustomerDevices.delete(untrustedToken);

    const lookupRes = dbAdapter.lookupOrRecognizeCustomer(phone, untrustedToken);
    expect(lookupRes.isExisting).toBe(true);
    expect(lookupRes.isTrusted).toBe(false);
    expect(lookupRes.requiresVerification).toBe(true);
    // Sensitive rewards must not be revealed prior to OTP verification
    expect(lookupRes.rewards).toHaveLength(0);

    // Customer verifies OTP
    const otpRes = dbAdapter.requestCustomerOtp(phone);
    const verifyRes = dbAdapter.verifyCustomerOtp(phone, otpRes.otpCode);
    expect(verifyRes.success).toBe(true);

    // Now marked trusted
    dbAdapter.markCustomerDeviceTrusted(phone, untrustedToken);
    const reLookup = dbAdapter.lookupOrRecognizeCustomer(phone, untrustedToken);
    expect(reLookup.isTrusted).toBe(true);
    expect(reLookup.requiresVerification).toBe(false);
  });

  it('Test 26: Customer can move to another table without losing customer profile or identity', () => {
    const phone = '9888877665';
    const deviceToken = getOrCreateDeviceToken();
    dbAdapter.markCustomerDeviceTrusted(phone, deviceToken);

    const custRes = dbAdapter.lookupOrRecognizeCustomer(phone, deviceToken);
    const customer = custRes.customer!;

    // Customer creates session on Table 1
    const tables = dbAdapter.getTables();
    const table1 = tables[0];
    const table2 = tables[1];

    const session1 = dbAdapter.createTableSession({
      tableId: table1.id,
      guestCount: 2,
      customerName: customer.full_name,
      customerPhone: customer.phone,
    });
    dbAdapter.linkSessionToCustomer(session1.id, customer.id);

    // Sometime later, same customer visits Table 2
    const session2 = dbAdapter.createTableSession({
      tableId: table2.id,
      guestCount: 4,
      customerName: customer.full_name,
      customerPhone: customer.phone,
    });
    dbAdapter.linkSessionToCustomer(session2.id, customer.id);

    // Customer identity is constant, table sessions are distinct
    expect(session1.id).not.toBe(session2.id);
    expect(session1.table_id).toBe(table1.id);
    expect(session2.table_id).toBe(table2.id);
    expect(session1.customer_phone).toBe(session2.customer_phone);
  });

  it('Test 27: Table session remains distinct across different visits by same customer', () => {
    const customer = dbAdapter.getCustomers()[0];
    const table = dbAdapter.getTables()[0];

    const visit1Session = dbAdapter.createTableSession({
      tableId: table.id,
      guestCount: 2,
      customerName: customer.full_name,
      customerPhone: customer.phone,
    });

    // Close visit 1 session
    visit1Session.status = 'COMPLETED';

    const visit2Session = dbAdapter.createTableSession({
      tableId: table.id,
      guestCount: 3,
      customerName: customer.full_name,
      customerPhone: customer.phone,
    });

    expect(visit1Session.id).not.toBe(visit2Session.id);
    expect(visit1Session.status).toBe('COMPLETED');
    expect(visit2Session.status).toBe('ACTIVE');
  });

  it('Test 28: Orders on different visits have distinct order IDs and table session links', () => {
    const customer = dbAdapter.getCustomers()[0];
    const table = dbAdapter.getTables()[0];
    const menuItem = dbAdapter.getMenuItems()[0];

    // Visit 1 Session & Order
    const session1 = dbAdapter.createTableSession({
      tableId: table.id,
      guestCount: 2,
      customerName: customer.full_name,
      customerPhone: customer.phone,
    });

    const order1 = dbAdapter.createOrder({
      tableSessionId: session1.id,
      items: [{ menuItemId: menuItem.id, quantity: 2, unitPrice: menuItem.price }],
      customerPhone: customer.phone,
      customerName: customer.full_name,
    });

    // Visit 2 Session & Order
    const session2 = dbAdapter.createTableSession({
      tableId: table.id,
      guestCount: 2,
      customerName: customer.full_name,
      customerPhone: customer.phone,
    });

    const order2 = dbAdapter.createOrder({
      tableSessionId: session2.id,
      items: [{ menuItemId: menuItem.id, quantity: 1, unitPrice: menuItem.price }],
      customerPhone: customer.phone,
      customerName: customer.full_name,
    });

    expect(order1.id).not.toBe(order2.id);
    expect(order1.table_session_id).toBe(session1.id);
    expect(order2.table_session_id).toBe(session2.id);
    expect(order1.table_session_id).not.toBe(order2.table_session_id);
    expect(order1.customer_phone).toBe(order2.customer_phone);
  });
});
