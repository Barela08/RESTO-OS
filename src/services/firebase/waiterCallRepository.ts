// ====================================================================
// RESTO OS - Firestore Waiter Calling & Assistance Repository
// Multi-device waiter call workflow with sound alert triggers
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
  orderBy,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { FirestoreWaiterCall } from '../../types/firestore';
import { WaiterCallStatus } from '../../types';
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
   */
  public static async requestWaiter(input: CreateWaiterCallInput): Promise<FirestoreWaiterCall> {
    if (!db) {
      throw new Error('Database not initialized');
    }

    // Check for existing ongoing call for the same session and request type
    const ongoingQuery = query(
      collection(db, 'waiterCalls'),
      where('tableSessionId', '==', input.tableSessionId),
      where('requestType', '==', input.requestType)
    );
    const snap = await getDocs(ongoingQuery);
    const ongoingCall = snap.docs
      .map((d) => ({ ...d.data(), callId: d.id } as FirestoreWaiterCall))
      .find((c) =>
        ['REQUESTED', 'SENT', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED'].includes(c.status)
      );

    if (ongoingCall) {
      return ongoingCall;
    }

    const callId = `call-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
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
      status: 'REQUESTED',
      assignedWaiterId: input.assignedWaiterId || 'st-wtr-01',
      assignedWaiterName: input.assignedWaiterName || 'Floor Captain',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(callRef, callPayload);

    // Emit live signal to Realtime Database
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

    return callPayload;
  }

  /**
   * Update waiter call status across the workflow
   */
  public static async updateCallStatus(
    restaurantId: string,
    callId: string,
    status: WaiterCallStatus,
    waiterId?: string
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
    }

    if (waiterId) {
      updatePayload.assignedWaiterId = waiterId;
    }

    await updateDoc(callRef, updatePayload);
  }

  /**
   * Listen to active waiter calls for floor staff
   */
  public static subscribeToWaiterCalls(
    restaurantId: string,
    assignedWaiterId?: string,
    callback?: (calls: FirestoreWaiterCall[]) => void
  ): Unsubscribe {
    if (!db || !callback) return () => {};

    let q = query(
      collection(db, 'waiterCalls'),
      where('restaurantId', '==', restaurantId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snap) => {
      let calls = snap.docs.map(
        (d) => ({ ...d.data(), callId: d.id } as FirestoreWaiterCall)
      );

      // Filter in memory if waiter ID is specified
      if (assignedWaiterId) {
        calls = calls.filter(
          (c) =>
            !c.assignedWaiterId ||
            c.assignedWaiterId === assignedWaiterId ||
            c.status === 'REQUESTED'
        );
      }

      callback(calls);
    });
  }
}
