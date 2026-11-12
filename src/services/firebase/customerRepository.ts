// ====================================================================
// RESTO OS - Firestore Customer Recognition & Loyalty Repository
// Trusted device auto-recognition, profile storage & stamp balance
// ====================================================================

import { db } from '../../lib/firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { FirestoreCustomer } from '../../types/firestore';

export class CustomerRepository {
  public static normalizePhoneNumber(phone: string): string {
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) return cleaned;
    if (cleaned.length === 10) return `+91${cleaned}`;
    if (cleaned.startsWith('0') && cleaned.length === 11) return `+91${cleaned.substring(1)}`;
    if (cleaned.startsWith('91') && cleaned.length === 12) return `+${cleaned}`;
    return cleaned;
  }

  /**
   * Look up existing customer by normalized mobile number
   */
  public static async lookupCustomer(
    restaurantId: string,
    rawPhone: string
  ): Promise<FirestoreCustomer | null> {
    if (!db) return null;

    const normalized = this.normalizePhoneNumber(rawPhone);
    const q = query(
      collection(db, 'customers'),
      where('restaurantId', '==', restaurantId),
      where('phone', '==', normalized)
    );
    const snap = await getDocs(q);

    if (snap.empty) return null;
    const d = snap.docs[0];
    return { ...d.data(), customerId: d.id } as FirestoreCustomer;
  }

  /**
   * Register a new customer
   */
  public static async registerCustomer(params: {
    restaurantId: string;
    phone: string;
    fullName: string;
    email?: string;
  }): Promise<FirestoreCustomer> {
    if (!db) {
      throw new Error('Database not initialized');
    }

    const normalized = this.normalizePhoneNumber(params.phone);
    const existing = await this.lookupCustomer(params.restaurantId, normalized);
    if (existing) {
      return existing;
    }

    const customerId = `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const custRef = doc(db, 'customers', customerId);

    const payload: FirestoreCustomer = {
      customerId,
      restaurantId: params.restaurantId,
      phone: normalized,
      fullName: params.fullName.trim(),
      email: params.email?.trim(),
      totalVisits: 1,
      totalSpend: 0,
      lastVisitAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(custRef, payload);
    return payload;
  }

  /**
   * Record visit and spend on customer record
   */
  public static async recordVisit(
    customerId: string,
    spendAmount: number
  ): Promise<void> {
    if (!db) return;
    const custRef = doc(db, 'customers', customerId);
    await updateDoc(custRef, {
      totalSpend: spendAmount,
      lastVisitAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}
