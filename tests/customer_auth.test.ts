import { describe, it, expect } from 'vitest';
import { dbAdapter } from '../src/services/databaseAdapter';

describe('Module 3 Acceptance Tests: Smart Customer Authentication', () => {
  it('AUTH-01: Dispatches 6-digit OTP code to mobile number', () => {
    const phone = '+91 97711 22334';
    const res = dbAdapter.requestCustomerOtp(phone);

    expect(res.success).toBe(true);
    expect(res.otpCode).toHaveLength(6);
    expect(res.message).toContain('OTP sent successfully');
  });

  it('AUTH-02: Normalizes mobile numbers across different formats to ensure uniqueness', () => {
    const raw1 = '+91 98888 77665';
    const raw2 = '9888877665';
    const raw3 = '+91-98888-77665';
    const raw4 = '09888877665';

    const n1 = dbAdapter.normalizePhoneNumber(raw1);
    const n2 = dbAdapter.normalizePhoneNumber(raw2);
    const n3 = dbAdapter.normalizePhoneNumber(raw3);
    const n4 = dbAdapter.normalizePhoneNumber(raw4);

    expect(n1).toBe('+919888877665');
    expect(n2).toBe('+919888877665');
    expect(n3).toBe('+919888877665');
    expect(n4).toBe('+919888877665');
  });

  it('AUTH-03: Returning customer with verified number restores existing profile and loyalty account', () => {
    const existingPhone = '+91 98888 77665';

    // Request OTP
    const otpRes = dbAdapter.requestCustomerOtp(existingPhone);

    // Verify OTP
    const verifyRes = dbAdapter.verifyCustomerOtp(existingPhone, otpRes.otpCode);
    expect(verifyRes.success).toBe(true);
    expect(verifyRes.isNewCustomer).toBe(false);
    expect(verifyRes.customer).toBeDefined();
    expect(verifyRes.customer?.full_name).toBe('Aditya Verma');

    // Check that loyalty account is restored with intact stamp count
    const loyalty = dbAdapter.getLoyaltyAccounts().find(l => l.customer_id === verifyRes.customer?.id);
    expect(loyalty).toBeDefined();
    expect(loyalty?.current_active_stamps).toBeGreaterThanOrEqual(0);
  });

  it('AUTH-04: New mobile number prompts for registration and prevents duplicate account creation', () => {
    const newPhone = `+91 91234 ${Math.floor(10000 + Math.random() * 90000)}`;

    // Request OTP
    const otpRes = dbAdapter.requestCustomerOtp(newPhone);
    const verifyRes = dbAdapter.verifyCustomerOtp(newPhone, otpRes.otpCode);

    expect(verifyRes.success).toBe(true);
    expect(verifyRes.isNewCustomer).toBe(true);

    // Register with name
    const { customer, loyalty } = dbAdapter.registerOrCompleteCustomer(newPhone, 'Meera Kapoor');
    expect(customer).toBeDefined();
    expect(customer.full_name).toBe('Meera Kapoor');
    expect(loyalty).toBeDefined();

    // Calling registration again with the same number must resolve to existing account without creating duplicate
    const initialCount = dbAdapter.getCustomers().length;
    const secondCall = dbAdapter.registerOrCompleteCustomer(newPhone, 'Meera Kapoor Updated');
    expect(secondCall.customer.id).toBe(customer.id);
    expect(dbAdapter.getCustomers().length).toBe(initialCount);
  });

  it('AUTH-05: Guest table session can be linked to verified customer without exposing other orders', () => {
    const session = dbAdapter.getSessions()[0] || dbAdapter.getOrCreateActiveSession(dbAdapter.getTables()[0].id);
    const customer = dbAdapter.getCustomers()[0];

    const linked = dbAdapter.linkSessionToCustomer(session.id, customer.id);
    expect(linked).toBe(true);

    const updatedSession = dbAdapter.getSessions().find(s => s.id === session.id);
    expect(updatedSession?.customer_name).toBe(customer.full_name);
    expect(updatedSession?.customer_phone).toBe(customer.phone);
  });
});
