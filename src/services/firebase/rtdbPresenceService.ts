// ====================================================================
// RESTO OS - Firebase Realtime Database Presence & Operational Signal Bus
// Tracks online/offline presence, device health & live operational alerts
// ====================================================================

import { rtdb } from '../../lib/firebase';
import {
  ref,
  set,
  onValue,
  onDisconnect,
  serverTimestamp as rtdbServerTimestamp,
  push,
  query,
  limitToLast,
  Unsubscribe,
} from 'firebase/database';
import { RTDBPresence, RTDBLiveEvent, RTDBDeviceStatus } from '../../types/firestore';
import { StaffRoleType } from '../../types';

export class RTDBPresenceService {
  private static instance: RTDBPresenceService;
  private unsubscribers: Map<string, Unsubscribe> = new Map();
  private processedEventIds = new Set<string>();

  public static getInstance(): RTDBPresenceService {
    if (!RTDBPresenceService.instance) {
      RTDBPresenceService.instance = new RTDBPresenceService();
    }
    return RTDBPresenceService.instance;
  }

  /**
   * Register staff user presence with automatic onDisconnect handler
   */
  public registerPresence(
    restaurantId: string,
    userId: string,
    role: StaffRoleType | 'customer',
    name?: string
  ): void {
    if (!rtdb) return;

    try {
      const presenceRef = ref(rtdb, `presence/${restaurantId}/${userId}`);
      const connectedRef = ref(rtdb, '.info/connected');

      onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
          // When disconnected, mark status as offline
          onDisconnect(presenceRef).set({
            status: 'offline',
            role,
            name: name || 'Staff Member',
            lastSeen: rtdbServerTimestamp(),
          });

          // Mark currently online
          set(presenceRef, {
            status: 'online',
            role,
            name: name || 'Staff Member',
            lastSeen: rtdbServerTimestamp(),
          });
        }
      });
    } catch (err) {
      console.warn('[RTDB Presence] Error setting presence:', err);
    }
  }

  /**
   * Subscribe to floor staff presence for floor manager / owner overview
   */
  public subscribeToStaffPresence(
    restaurantId: string,
    onPresenceChange: (presenceMap: Record<string, RTDBPresence>) => void
  ): () => void {
    if (!rtdb) return () => {};

    const presenceRef = ref(rtdb, `presence/${restaurantId}`);
    const unsub = onValue(presenceRef, (snap) => {
      const data = snap.val() || {};
      onPresenceChange(data);
    });

    const key = `presence_${restaurantId}`;
    this.unsubscribers.set(key, unsub);

    return () => {
      unsub();
      this.unsubscribers.delete(key);
    };
  }

  /**
   * Broadcast a fast operational signal across restaurant devices (Zero-cost event bus)
   */
  public async emitLiveSignal(
    restaurantId: string,
    event: Omit<RTDBLiveEvent, 'eventId' | 'timestamp'>
  ): Promise<string | null> {
    if (!rtdb) return null;

    try {
      const eventsRef = ref(rtdb, `liveEvents/${restaurantId}`);
      const newEventRef = push(eventsRef);
      const eventId = newEventRef.key || `evt-${Date.now()}`;

      await set(newEventRef, {
        eventId,
        ...event,
        timestamp: rtdbServerTimestamp(),
      });

      return eventId;
    } catch (err) {
      console.warn('[RTDB Signal] Failed to broadcast signal:', err);
      return null;
    }
  }

  /**
   * Listen for live operational events with duplicate prevention
   */
  public subscribeToLiveSignals(
    restaurantId: string,
    onSignal: (event: RTDBLiveEvent) => void
  ): () => void {
    if (!rtdb) return () => {};

    const eventsRef = query(ref(rtdb, `liveEvents/${restaurantId}`), limitToLast(25));
    const unsub = onValue(eventsRef, (snap) => {
      const eventsObj = snap.val();
      if (!eventsObj) return;

      Object.keys(eventsObj).forEach((key) => {
        if (!this.processedEventIds.has(key)) {
          this.processedEventIds.add(key);
          const event = eventsObj[key] as RTDBLiveEvent;
          onSignal(event);
        }
      });
    });

    return unsub;
  }

  /**
   * Update hardware/device telemetry (battery, audio volume, app version)
   */
  public async reportDeviceStatus(
    restaurantId: string,
    deviceId: string,
    status: Partial<RTDBDeviceStatus>
  ): Promise<void> {
    if (!rtdb) return;

    try {
      const deviceRef = ref(rtdb, `deviceStatus/${restaurantId}/${deviceId}`);
      await set(deviceRef, {
        deviceId,
        ...status,
        lastPing: rtdbServerTimestamp(),
      });
    } catch (err) {
      console.warn('[RTDB Device] Failed to report device status:', err);
    }
  }

  public cleanup(): void {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers.clear();
  }
}

export const rtdbPresenceService = RTDBPresenceService.getInstance();
