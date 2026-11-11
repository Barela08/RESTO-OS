// ====================================================================
// RESTO OS - Digital Loyalty & Stamp Engine
// Rule: Exactly 1 stamp per completed order >= min amount for registered members
// Milestone: 8 stamps = 1 automatic reward voucher
// ====================================================================

import { Customer, LoyaltyAccount, LoyaltyReward } from '../types';

export class LoyaltyService {
  /**
   * Evaluates if an order qualifies for a stamp
   */
  public static isOrderEligibleForStamp(
    orderAmount: number,
    minThreshold: number = 250,
    hasCustomerPhone: boolean
  ): boolean {
    return hasCustomerPhone && orderAmount >= minThreshold;
  }

  /**
   * Generates a unique secure reward voucher code
   */
  public static generateVoucherCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'RW-';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
