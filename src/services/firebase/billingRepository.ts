// ====================================================================
// RESTO OS - Firestore Billing, Invoicing & Settlement Repository
// Handles invoice compilation, payment verification & daily collections
// ====================================================================

import { db } from '../../lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import {
  FirestoreInvoice,
  FirestorePayment,
  FirestoreOrder,
} from '../../types/firestore';
import { PaymentMethod } from '../../types';
import { TableRepository } from './tableRepository';

export interface SettlePaymentInput {
  restaurantId: string;
  invoiceId: string;
  tableSessionId: string;
  tableId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionReference?: string;
  cashTenderedAmount?: number;
  verifiedByUserId: string;
}

export class BillingRepository {
  /**
   * Aggregate active orders for a table session into a formal GST tax invoice
   */
  public static async generateInvoiceForSession(
    restaurantId: string,
    tableSessionId: string
  ): Promise<FirestoreInvoice> {
    if (!db) {
      throw new Error('Database not initialized');
    }

    // Check if invoice already exists
    const existingQ = query(
      collection(db, 'invoices'),
      where('tableSessionId', '==', tableSessionId)
    );
    const existingSnap = await getDocs(existingQ);
    if (!existingSnap.empty) {
      const d = existingSnap.docs[0];
      return { ...d.data(), invoiceId: d.id } as FirestoreInvoice;
    }

    // Fetch session
    const sessionSnap = await getDoc(doc(db, 'tableSessions', tableSessionId));
    if (!sessionSnap.exists()) {
      throw new Error('Table session not found');
    }
    const sessionData = sessionSnap.data();

    // Fetch all orders for this session
    const ordersQ = query(
      collection(db, 'orders'),
      where('tableSessionId', '==', tableSessionId)
    );
    const ordersSnap = await getDocs(ordersQ);
    const orders = ordersSnap.docs.map((d) => d.data() as FirestoreOrder);

    const orderIds = ordersSnap.docs.map((d) => d.id);
    const subtotal = orders.reduce((sum, o) => sum + (o.subtotalAmount || 0), 0);
    const cgstAmount = Math.round(subtotal * 0.025 * 100) / 100;
    const sgstAmount = Math.round(subtotal * 0.025 * 100) / 100;
    const discountAmount = orders.reduce((sum, o) => sum + (o.discountAmount || 0), 0);
    const netAmount = Math.round((subtotal + cgstAmount + sgstAmount - discountAmount) * 100) / 100;

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const invoiceId = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const invoiceNumber = `INV-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;

    const invoicePayload: FirestoreInvoice = {
      invoiceId,
      invoiceNumber,
      restaurantId,
      tableSessionId,
      tableId: sessionData.tableId,
      tableNumber: sessionData.tableNumber,
      customerId: sessionData.customerId,
      customerName: sessionData.customerName,
      customerPhone: sessionData.customerPhone,
      orderIds,
      subtotalAmount: subtotal,
      cgstAmount,
      sgstAmount,
      discountAmount,
      netAmount,
      status: 'ISSUED',
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'invoices', invoiceId), invoicePayload);

    // Update table session status to PAYMENT_PENDING
    await updateDoc(doc(db, 'tableSessions', tableSessionId), {
      status: 'PAYMENT_PENDING',
      totalAmount: netAmount,
      updatedAt: serverTimestamp(),
    });

    return invoicePayload;
  }

  /**
   * Settle invoice payment atomically and update table status to CLEANING
   */
  public static async settlePayment(input: SettlePaymentInput): Promise<FirestorePayment> {
    if (!db) {
      throw new Error('Database not initialized');
    }

    // 1. Check for duplicate payment on this invoice
    const existingPaymentQ = query(
      collection(db, 'payments'),
      where('invoiceId', '==', input.invoiceId),
      where('status', '==', 'PAID')
    );
    const existingPaymentSnap = await getDocs(existingPaymentQ);
    if (!existingPaymentSnap.empty) {
      const d = existingPaymentSnap.docs[0];
      return { ...d.data(), paymentId: d.id } as FirestorePayment;
    }

    const paymentId = `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const cashChangeAmount =
      input.paymentMethod === 'CASH' && input.cashTenderedAmount
        ? Math.max(0, input.cashTenderedAmount - input.amount)
        : 0;

    const paymentPayload: FirestorePayment = {
      paymentId,
      restaurantId: input.restaurantId,
      invoiceId: input.invoiceId,
      tableSessionId: input.tableSessionId,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      status: 'PAID',
      transactionReference: input.transactionReference,
      cashTenderedAmount: input.cashTenderedAmount,
      cashChangeAmount,
      verifiedByUserId: input.verifiedByUserId,
      createdAt: serverTimestamp(),
      completedAt: serverTimestamp(),
    };

    const batch = writeBatch(db);

    // Save payment record
    const payRef = doc(db, 'payments', paymentId);
    batch.set(payRef, paymentPayload);

    // Mark invoice PAID
    const invRef = doc(db, 'invoices', input.invoiceId);
    batch.update(invRef, {
      status: 'PAID',
      paidAt: serverTimestamp(),
    });

    // Close table session
    const sessionRef = doc(db, 'tableSessions', input.tableSessionId);
    batch.update(sessionRef, {
      status: 'COMPLETED',
      closedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Mark all session orders PAID
    const ordersQ = query(
      collection(db, 'orders'),
      where('tableSessionId', '==', input.tableSessionId)
    );
    const ordersSnap = await getDocs(ordersQ);
    ordersSnap.docs.forEach((oDoc) => {
      batch.update(oDoc.ref, {
        paymentStatus: 'PAID',
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();

    // Set Table Status to CLEANING
    await TableRepository.updateTableStatus(input.restaurantId, input.tableId, 'CLEANING');

    return paymentPayload;
  }

  /**
   * Daily Collection metrics report calculation
   */
  public static async getDailyCollectionSummary(
    restaurantId: string
  ): Promise<{
    totalRevenue: number;
    cashRevenue: number;
    upiRevenue: number;
    cardRevenue: number;
    paidInvoicesCount: number;
  }> {
    if (!db) {
      return { totalRevenue: 0, cashRevenue: 0, upiRevenue: 0, cardRevenue: 0, paidInvoicesCount: 0 };
    }

    const q = query(
      collection(db, 'payments'),
      where('restaurantId', '==', restaurantId),
      where('status', '==', 'PAID')
    );
    const snap = await getDocs(q);

    let totalRevenue = 0;
    let cashRevenue = 0;
    let upiRevenue = 0;
    let cardRevenue = 0;

    snap.docs.forEach((d) => {
      const p = d.data() as FirestorePayment;
      totalRevenue += p.amount || 0;
      if (p.paymentMethod === 'CASH') cashRevenue += p.amount || 0;
      else if (p.paymentMethod === 'UPI') upiRevenue += p.amount || 0;
      else if (p.paymentMethod === 'CARD') cardRevenue += p.amount || 0;
    });

    return {
      totalRevenue,
      cashRevenue,
      upiRevenue,
      cardRevenue,
      paidInvoicesCount: snap.size,
    };
  }

  /**
   * Listen to active invoices for cash counter
   */
  public static subscribeToInvoices(
    restaurantId: string,
    callback: (invoices: FirestoreInvoice[]) => void
  ): Unsubscribe {
    if (!db) return () => {};
    const q = query(
      collection(db, 'invoices'),
      where('restaurantId', '==', restaurantId),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      const invoices = snap.docs.map((d) => ({ ...d.data(), invoiceId: d.id } as FirestoreInvoice));
      callback(invoices);
    });
  }
}
