// ====================================================================
// RESTO OS - Hardware Device Role Registration & Telemetry Service
// Registers physical terminals (Cash Counter, Waiter, Kitchen, Customer)
// in Firestore `deviceRegistrations/{deviceId}` with active heartbeat
// ====================================================================

import { db } from '../../lib/firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { FirestoreDeviceRegistration } from '../../types/firestore';

export interface RegisterDeviceParams {
  userId: string;
  staffId?: string | null;
  restaurantId: string;
  role: 'counter' | 'waiter' | 'kitchen' | 'customer' | 'admin' | 'owner';
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  fcmToken?: string | null;
}

export class DeviceRegistrationService {
  private static instance: DeviceRegistrationService;
  private heartbeatInterval: any = null;
  private currentDeviceId: string | null = null;

  public static getInstance(): DeviceRegistrationService {
    if (!DeviceRegistrationService.instance) {
      DeviceRegistrationService.instance = new DeviceRegistrationService();
    }
    return DeviceRegistrationService.instance;
  }

  /**
   * Get or generate a persistent UUID for this physical hardware terminal
   */
  public getOrCreateDeviceId(): string {
    if (this.currentDeviceId) return this.currentDeviceId;

    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      let storedId = localStorage.getItem('resto_device_id');
      if (!storedId) {
        storedId = `dev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem('resto_device_id', storedId);
      }
      this.currentDeviceId = storedId;
      return storedId;
    }

    this.currentDeviceId = `dev-node-${Date.now()}`;
    return this.currentDeviceId;
  }

  /**
   * Detect device hardware form factor
   */
  public detectDeviceType(): 'desktop' | 'mobile' | 'tablet' {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return 'desktop';
    }
    const ua = navigator.userAgent.toLowerCase();
    if (/(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(ua)) {
      return 'tablet';
    }
    if (/(mobi|ipod|phone|blackberry|opera mini|fennec|minimo|symbian|psp|nintendo ds)/.test(ua)) {
      return 'mobile';
    }
    return 'desktop';
  }

  /**
   * Register physical device in Firestore
   */
  public async registerDevice(params: RegisterDeviceParams): Promise<FirestoreDeviceRegistration> {
    const deviceId = this.getOrCreateDeviceId();
    const deviceType = params.deviceType || this.detectDeviceType();
    const notificationPermission =
      typeof window !== 'undefined' && 'Notification' in window
        ? (Notification.permission as 'default' | 'granted' | 'denied')
        : 'default';

    const registration: FirestoreDeviceRegistration = {
      deviceId,
      userId: params.userId,
      staffId: params.staffId || null,
      restaurantId: params.restaurantId,
      role: params.role,
      deviceType,
      fcmToken: params.fcmToken || null,
      notificationPermission,
      lastActiveAt: serverTimestamp(),
      isActive: true,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'NodeJS',
      appVersion: '2.4.0',
    };

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('resto_active_role', params.role);
      localStorage.setItem('resto_device_role', params.role);
      if (params.staffId) {
        localStorage.setItem('resto_staff_id', params.staffId);
      }
    }

    if (db) {
      try {
        const deviceRef = doc(db, 'deviceRegistrations', deviceId);
        await setDoc(deviceRef, registration, { merge: true });
      } catch (err) {
        console.warn('[DeviceRegistration] Firestore registration warning:', err);
      }
    }

    // Start periodic heartbeat
    this.startHeartbeat(deviceId);

    return registration;
  }

  /**
   * Heartbeat updater to keep lastActiveAt fresh
   */
  public async heartbeat(deviceId?: string): Promise<void> {
    const id = deviceId || this.getOrCreateDeviceId();
    if (!db) return;

    try {
      const deviceRef = doc(db, 'deviceRegistrations', id);
      await updateDoc(deviceRef, {
        lastActiveAt: serverTimestamp(),
        isActive: true,
      });
    } catch {
      // Ignored for offline intervals
    }
  }

  /**
   * Start recurring heartbeat timer (every 60s)
   */
  private startHeartbeat(deviceId: string) {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.heartbeatInterval = setInterval(() => {
      this.heartbeat(deviceId);
    }, 60000);
  }

  /**
   * Mark device inactive upon logout
   */
  public async unregisterDevice(deviceId?: string): Promise<void> {
    const id = deviceId || this.getOrCreateDeviceId();
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('resto_active_role');
      localStorage.removeItem('resto_device_role');
      localStorage.removeItem('resto_staff_id');
    }

    if (!db) return;

    try {
      const deviceRef = doc(db, 'deviceRegistrations', id);
      await updateDoc(deviceRef, {
        isActive: false,
        lastActiveAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('[DeviceRegistration] Unregister error:', err);
    }
  }

  /**
   * Update registered FCM push token
   */
  public async updateFcmToken(fcmToken: string, deviceId?: string): Promise<void> {
    const id = deviceId || this.getOrCreateDeviceId();
    if (!db) return;

    try {
      const deviceRef = doc(db, 'deviceRegistrations', id);
      await updateDoc(deviceRef, {
        fcmToken,
        notificationPermission: typeof Notification !== 'undefined' ? Notification.permission : 'default',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('[DeviceRegistration] FCM token update warning:', err);
    }
  }

  /**
   * Query active devices for a given role (e.g. all online waiter tablets)
   */
  public async getActiveDevicesForRole(
    restaurantId: string,
    role: string
  ): Promise<FirestoreDeviceRegistration[]> {
    if (!db) return [];

    try {
      const q = query(
        collection(db, 'deviceRegistrations'),
        where('restaurantId', '==', restaurantId),
        where('role', '==', role),
        where('isActive', '==', true)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as FirestoreDeviceRegistration);
    } catch (err) {
      console.warn('[DeviceRegistration] Query active devices error:', err);
      return [];
    }
  }

  /**
   * Realtime subscription to a device's registration doc
   */
  public subscribeToDevice(
    deviceId: string,
    callback: (device: FirestoreDeviceRegistration | null) => void
  ): Unsubscribe {
    if (!db) return () => {};
    const ref = doc(db, 'deviceRegistrations', deviceId);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        callback(snap.data() as FirestoreDeviceRegistration);
      } else {
        callback(null);
      }
    });
  }
}

export const deviceRegistrationService = DeviceRegistrationService.getInstance();
