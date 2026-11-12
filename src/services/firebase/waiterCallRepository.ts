// ====================================================================
// RESTO OS - Firestore Waiter Calling & Assistance Repository
// Multi-device waiter call workflow with sound alert triggers & status sync
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
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { FirestoreWaiterCall } from '../../types/firestore';
import { WaiterCall, WaiterCallStatus } from '../../types';
import { rtdbPresenceService } from './rtdbPresenceService';

export interface CreateWaiterCallInput {
  restaurantId: string;
  tableId: string;
  tableNumber: string;
  tableSessionId: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  requestType: 'CALL_WAITER' | 'WATER' | 'REQUEST_BILL' | 'CLEANING' | 'ASSISTANCE';
  requestMessage?: string;
  priority?: 'NORMAL' | 'URGENT';
  assignedWaiterId?: string;
  assignedWaiterName?: string;
}

export class WaiterCallRepository {
  /**
   * Submit a waiter assistance request with duplicate prevention
   * Initial status: PENDING
   */
  public static async requestWaiter(input: CreateWaiterCallInput): Promise<FirestoreWaiterCall> {
    if (!input.restaurantId || !input.tableId || !input.tableSessionId) {
      throw new Error('Valid restaurantId, tableId, and tableSessionId are required');
    }

    if (!db) {
      throw new Error('Firestore is not initialized');
    }

    // 1. Prevent duplicate active calls for the same session and request type
    try {
      const ongoingQuery = query(
        collection(db, 'waiterCalls'),
        where('restaurantId', '==', input.restaurantId),
        where('tableSessionId', '==', input.tableSessionId)
      );
      const snap = await getDocs(ongoingQuery);
      const ongoingCall = snap.docs
        .map((d) => ({ ...d.data(), callId: d.id } as FirestoreWaiterCall))
        .find(
          (c) =>
            c.requestType === input.requestType &&
            ['PENDING', 'REQUESTED', 'SENT', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED'].includes(c.status)
        );

      if (ongoingCall) {
        return ongoingCall;
      }
    } catch (queryErr) {
      console.warn('[WaiterCallRepository] Active call query check warning:', queryErr);
    }

    // 2. Create unique persistent waiterCall document
    const callId = `call-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const callRef = doc(db, 'waiterCalls', callId);

    const callPayload: any = {
      callId,
      restaurantId: input.restaurantId,
      tableId: input.tableId,
      tableNumber: input.tableNumber,
      tableSessionId: input.tableSessionId,
      customerId: input.customerId || null,
      customerName: input.customerName || 'Mobile Diner',
      customerPhone: input.customerPhone || null,
      requestType: input.requestType,
      requestMessage: input.requestMessage || null,
      priority: input.priority || 'NORMAL',
      status: 'PENDING',
      assignedWaiterId: input.assignedWaiterId || null,
      assignedWaiterName: input.assignedWaiterName || null,
      acceptedAt: null,
      onTheWayAt: null,
      arrivedAt: null,
      completedAt: null,
      cancelledAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // 3. Await Firestore write confirmation
    await setDoc(callRef, callPayload);

    // 4. Emit live signal to Realtime Database if available
    try {
      rtdbPresenceService.emitLiveSignal(input.restaurantId, {
        eventType: 'CALL_WAITER',
        tableNumber: input.tableNumber,
        waiterId: input.assignedWaiterId,
        payload: {
          callId,
          requestType: input.requestType,
          priority: input.priority || 'NORMAL',
        },
      });
    } catch {
      // Non-blocking RTDB presence
    }

    return callPayload;
  }

  /**
   * Update waiter call status across the workflow:
   * PENDING -> ACCEPTED -> ON_THE_WAY -> ARRIVED -> COMPLETED / CANCELLED
   */
  public static async updateCallStatus(
    restaurantId: string,
    callId: string,
    status: WaiterCallStatus,
    waiterId?: string,
    waiterName?: string
  ): Promise<void> {
    if (!db) return;

    const callRef = doc(db, 'waiterCalls', callId);
    const updatePayload: Record<string, any> = {
      status,
      updatedAt: serverTimestamp(),
    };

    if (status === 'ACCEPTED') {
      updatePayload.acceptedAt = serverTimestamp();
    } else if (status === 'ON_THE_WAY') {
      updatePayload.onTheWayAt = serverTimestamp();
    } else if (status === 'ARRIVED') {
      updatePayload.arrivedAt = serverTimestamp();
    } else if (status === 'COMPLETED') {
      updatePayload.completedAt = serverTimestamp();
    } else if (status === 'CANCELLED') {
      updatePayload.cancelledAt = serverTimestamp();
    }

    if (waiterId) {
      updatePayload.assignedWaiterId = waiterId;
    }
    if (waiterName) {
      updatePayload.assignedWaiterName = waiterName;
    }

    await updateDoc(callRef, updatePayload);
  }

  /**
   * Listen to active waiter calls for floor staff with error recovery
   */
  public static subscribeToWaiterCalls(
    restaurantId: string,
    assignedWaiterId?: string,
    callback?: (calls: FirestoreWaiterCall[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    if (!db || !callback) return () => {};

    const q = query(
      collection(db, 'waiterCalls'),
      where('restaurantId', '==', restaurantId)
    );

    return onSnapshot(
      q,
      (snap) => {
        let calls = snap.docs.map(
          (d) => ({ ...d.data(), callId: d.id } as FirestoreWaiterCall)
        );

        // Filter active calls only
        calls = calls.filter((c) =>
          ['PENDING', 'REQUESTED', 'SENT', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED'].includes(c.status)
        );

        // Sort descending by creation timestamp
        calls.sort((a, b) => {
          const timeA = (a.createdAt as any)?.toMillis?.() || new Date(a.createdAt as any).getTime() || 0;
          const timeB = (b.createdAt as any)?.toMillis?.() || new Date(b.createdAt as any).getTime() || 0;
          return timeB - timeA;
        });

        // Filter by assigned waiter if specified and not 'ALL'
        if (assignedWaiterId && assignedWaiterId !== 'ALL') {
          calls = calls.filter(
            (c) =>
              !c.assignedWaiterId ||
              c.assignedWaiterId === assignedWaiterId ||
              ['PENDING', 'REQUESTED'].includes(c.status)
          );
        }

        callback(calls);
      },
      (err) => {
        console.warn('[WaiterCallRepository] onSnapshot subscription warning:', err);
        if (onError) onError(err);
      }
    );
  }

  /**
   * Listen to active waiter call for a customer table session in real time
   * Reflects ACCEPTED, ON_THE_WAY, ARRIVED, COMPLETED back to customer device
   */
  public static subscribeToCallForSession(
    restaurantId: string,
    tableSessionId: string,
    callback?: (call: FirestoreWaiterCall | null) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    if (!db || !callback) return () => {};

    const q = query(
      collection(db, 'waiterCalls'),
      where('restaurantId', '==', restaurantId),
      where('tableSessionId', '==', tableSessionId)
    );

    return onSnapshot(
      q,
      (snap) => {
        const calls = snap.docs.map(
          (d) => ({ ...d.data(), callId: d.id } as FirestoreWaiterCall)
        );

        // Find current ongoing call
        const active = calls.find((c) =>
          ['PENDING', 'REQUESTED', 'SENT', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED'].includes(c.status)
        );

        callback(active || null);
      },
      (err) => {
        console.warn('[WaiterCallRepository] Customer call session subscription warning:', err);
        if (onError) onError(err);
      }
    );
  }
}

/**
 * Maps a Firestore waiter call document into the local WaiterCall application model
 */
export function mapFirestoreCallToWaiterCall(fc: FirestoreWaiterCall): WaiterCall {
  const parseTime = (val: any): string => {
    if (!val) return new Date().toISOString();
    if (typeof val === 'string') return val;
    if (typeof val.toDate === 'function') return val.toDate().toISOString();
    if (typeof val.toMillis === 'function') return new Date(val.toMillis()).toISOString();
    if (val.seconds) return new Date(val.seconds * 1000).toISOString();
    return new Date().toISOString();
  };

  return {
    id: fc.callId,
    restaurant_id: fc.restaurantId,
    table_id: fc.tableId,
    table_number: fc.tableNumber,
    table_session_id: fc.tableSessionId,
    customer_id: fc.customerId,
    customer_name: fc.customerName,
    customer_phone: fc.customerPhone,
    assigned_waiter_id: fc.assignedWaiterId,
    assigned_waiter_name: fc.assignedWaiterName,
    request_type: fc.requestType as any,
    request_message: fc.requestMessage,
    status: fc.status,
    priority: fc.priority || 'NORMAL',
    notes: fc.requestMessage,
    accepted_at: fc.acceptedAt ? parseTime(fc.acceptedAt) : undefined,
    on_the_way_at: fc.onTheWayAt ? parseTime(fc.onTheWayAt) : undefined,
    arrived_at: fc.arrivedAt ? parseTime(fc.arrivedAt) : undefined,
    completed_at: fc.completedAt ? parseTime(fc.completedAt) : undefined,
    created_at: parseTime(fc.createdAt),
    updated_at: fc.updatedAt ? parseTime(fc.updatedAt) : undefined,
  };
}
