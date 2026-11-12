// ====================================================================
// RESTO OS - Firestore Table & QR Session Repository
// Handles table state, cryptographic QR verification & dining sessions
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
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import {
  FirestoreRestaurantTable,
  FirestoreQRToken,
  FirestoreTableSession,
} from '../../types/firestore';
import { TableStatus } from '../../types';

export class TableRepository {
  /**
   * Fetch all tables for a restaurant
   */
  public static async getTables(restaurantId: string): Promise<FirestoreRestaurantTable[]> {
    if (!db) return [];
    const q = query(
      collection(db, 'restaurantTables'),
      where('restaurantId', '==', restaurantId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), tableId: d.id } as FirestoreRestaurantTable));
  }

  /**
   * Listen to real-time table floor changes
   */
  public static subscribeToTables(
    restaurantId: string,
    callback: (tables: FirestoreRestaurantTable[]) => void
  ): Unsubscribe {
    if (!db) return () => {};
    const q = query(
      collection(db, 'restaurantTables'),
      where('restaurantId', '==', restaurantId)
    );
    return onSnapshot(q, (snap) => {
      const tables = snap.docs.map(
        (d) => ({ ...d.data(), tableId: d.id } as FirestoreRestaurantTable)
      );
      callback(tables);
    });
  }

  /**
   * Update table status (e.g. AVAILABLE, OCCUPIED, PAYMENT_PENDING, CLEANING)
   */
  public static async updateTableStatus(
    restaurantId: string,
    tableId: string,
    status: TableStatus,
    currentWaiterId?: string
  ): Promise<void> {
    if (!db) return;
    const tableRef = doc(db, 'restaurantTables', tableId);
    const updatePayload: Record<string, any> = {
      status,
      updatedAt: serverTimestamp(),
    };
    if (currentWaiterId !== undefined) {
      updatePayload.currentWaiterId = currentWaiterId;
    }
    await updateDoc(tableRef, updatePayload);
  }

  /**
   * Cryptographically verify table permanent QR token
   */
  public static async verifyQRToken(tokenHash: string): Promise<{
    valid: boolean;
    token?: FirestoreQRToken;
    table?: FirestoreRestaurantTable;
    session?: FirestoreTableSession;
    message: string;
  }> {
    if (!db) {
      return { valid: false, message: 'Database not initialized' };
    }

    if (!tokenHash || typeof tokenHash !== 'string' || !tokenHash.trim()) {
      return {
        valid: false,
        message: 'Invalid or expired QR token. Please contact restaurant staff.',
      };
    }

    try {
      const tokensRef = collection(db, 'qrTokens');
      const q = query(
        tokensRef,
        where('tokenHash', '==', tokenHash),
        where('isRevoked', '==', false)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        return {
          valid: false,
          message: 'Invalid or expired QR token. Please contact restaurant staff.',
        };
      }

      const tokenDoc = snap.docs[0];
      const token = { ...tokenDoc.data(), tokenId: tokenDoc.id } as FirestoreQRToken;

      // Fetch corresponding table
      const tableSnap = await getDoc(doc(db, 'restaurantTables', token.tableId));
      if (!tableSnap.exists()) {
        return { valid: false, message: 'Assigned table could not be found.' };
      }
      const table = { ...tableSnap.data(), tableId: tableSnap.id } as FirestoreRestaurantTable;

      // Check if an active session exists on this table
      const sessionQuery = query(
        collection(db, 'tableSessions'),
        where('tableId', '==', table.tableId),
        where('status', '==', 'ACTIVE')
      );
      const sessionSnap = await getDocs(sessionQuery);

      let activeSession: FirestoreTableSession | undefined;
      if (!sessionSnap.empty) {
        const sDoc = sessionSnap.docs[0];
        activeSession = { ...sDoc.data(), sessionId: sDoc.id } as FirestoreTableSession;
      } else {
        // Create new active session seamlessly
        const newSessionId = `ses-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newSessionRef = doc(db, 'tableSessions', newSessionId);
        const sessionPayload: FirestoreTableSession = {
          sessionId: newSessionId,
          restaurantId: table.restaurantId,
          tableId: table.tableId,
          tableNumber: table.tableNumber,
          qrTokenId: token.tokenId,
          sessionToken: `tok_${Math.random().toString(36).substring(2, 12)}`,
          status: 'ACTIVE',
          guestCount: 2,
          totalAmount: 0,
          openedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(newSessionRef, sessionPayload);
        activeSession = sessionPayload;

        // Browsing session created. Table remains in its current status (AVAILABLE) until an order is placed.
      }

      return {
        valid: true,
        token,
        table,
        session: activeSession,
        message: 'Table session active. You can start dining and ordering.',
      };
    } catch (err: any) {
      return {
        valid: false,
        message: 'Invalid or expired QR token. Please contact restaurant staff.',
      };
    }
  }

  /**
   * Listen to active table session updates (status, customer info, bill requests)
   */
  public static subscribeToTableSession(
    sessionId: string,
    callback: (session: FirestoreTableSession | null) => void
  ): Unsubscribe {
    if (!db) return () => {};
    const sessionRef = doc(db, 'tableSessions', sessionId);
    return onSnapshot(sessionRef, (snap) => {
      if (!snap.exists()) {
        callback(null);
      } else {
        callback({ ...snap.data(), sessionId: snap.id } as FirestoreTableSession);
      }
    });
  }
}
