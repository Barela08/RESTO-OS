// ====================================================================
// RESTO OS - Firestore Security Audit Log Repository
// Immutable append-only activity & administrative audit trail
// ====================================================================

import { db } from '../../lib/firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { FirestoreAuditLog } from '../../types/firestore';

export class AuditLogRepository {
  /**
   * Record a security audit event
   */
  public static async recordEvent(params: {
    restaurantId: string;
    eventType: string;
    userId?: string;
    username?: string;
    role?: string;
    ipAddress?: string;
    details?: Record<string, any>;
  }): Promise<void> {
    if (!db) return;

    try {
      const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const logRef = doc(db, 'auditLogs', logId);

      const payload: FirestoreAuditLog = {
        logId,
        restaurantId: params.restaurantId,
        eventType: params.eventType,
        userId: params.userId,
        username: params.username,
        role: params.role,
        ipAddress: params.ipAddress || 'client',
        details: params.details || {},
        createdAt: serverTimestamp(),
      };

      await setDoc(logRef, payload);
    } catch (err) {
      console.warn('[Audit Log] Failed to write audit event:', err);
    }
  }

  /**
   * Fetch recent audit logs for owner/admin inspection
   */
  public static async getRecentAuditLogs(
    restaurantId: string,
    maxLimit = 50
  ): Promise<FirestoreAuditLog[]> {
    if (!db) return [];

    const q = query(
      collection(db, 'auditLogs'),
      where('restaurantId', '==', restaurantId),
      orderBy('createdAt', 'desc'),
      limit(maxLimit)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), logId: d.id } as FirestoreAuditLog));
  }
}
