// ====================================================================
// RESTO OS - Firebase Cloud Messaging (FCM) Service
// Manages device token registration, foreground alerts & voice triggers
// ====================================================================

import { getFCM, firebaseConfig } from '../../lib/firebase';
import { getToken, onMessage, MessagePayload } from 'firebase/messaging';
import { audioService } from '../audioService';
import { voiceAnnouncementService } from '../voiceAnnouncementService';
import { deviceRegistrationService } from './deviceRegistrationService';

export class FCMService {
  private static instance: FCMService;
  private currentToken: string | null = null;
  private isListening = false;

  public static getInstance(): FCMService {
    if (!FCMService.instance) {
      FCMService.instance = new FCMService();
    }
    return FCMService.instance;
  }

  /**
   * Request browser notification permission and register FCM device token
   */
  public async requestPermissionAndGetToken(): Promise<string | null> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('[FCM] Notifications not supported in this browser environment');
      return null;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.info('[FCM] Notification permission denied by user');
        return null;
      }

      const messaging = await getFCM();
      if (!messaging) {
        console.warn('[FCM] Messaging service not available');
        return null;
      }

      // Register service worker if supported
      let serviceWorkerRegistration: ServiceWorkerRegistration | undefined;
      if ('serviceWorker' in navigator) {
        try {
          serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        } catch (swErr) {
          console.warn('[FCM] Service worker registration error:', swErr);
        }
      }

      const vapidKey = firebaseConfig.vapidKey || undefined;
      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration,
      });

      if (token) {
        this.currentToken = token;
        deviceRegistrationService.updateFcmToken(token).catch(() => {});
        this.startForegroundListener();
        return token;
      }

      return null;
    } catch (error) {
      console.warn('[FCM] Failed to retrieve device token:', error);
      return null;
    }
  }

  /**
   * Listen for foreground messages and trigger audio bells & spoken announcements
   */
  public async startForegroundListener(
    onCustomMessage?: (payload: MessagePayload) => void
  ): Promise<void> {
    if (this.isListening) return;

    const messaging = await getFCM();
    if (!messaging) return;

    try {
      onMessage(messaging, (payload) => {
        console.log('[FCM Foreground] Received message:', payload);

        const eventType = payload.data?.eventType || 'ALERT';
        const tableNumber = payload.data?.tableNumber;

        const activeRole = (typeof window !== 'undefined'
          ? (localStorage.getItem('resto_active_role') || localStorage.getItem('resto_staff_role'))
          : null) as string | null;

        // Strictly role-gated sound delivery: customer devices NEVER play staff bells
        if (activeRole && activeRole !== 'customer') {
          if ((eventType === 'CALL_WAITER' || eventType === 'ORDER_READY') && (activeRole === 'waiter' || activeRole === 'admin' || activeRole === 'owner')) {
            audioService.playWaiterCallBell();
            audioService.vibrate([250, 100, 250]);
          } else if (eventType === 'NEW_ORDER' && (activeRole === 'kitchen' || activeRole === 'admin' || activeRole === 'owner')) {
            audioService.playNewOrderBeep();
          } else if ((eventType === 'REQUEST_BILL' || eventType === 'PAYMENT_RECEIVED') && (activeRole === 'counter' || activeRole === 'admin' || activeRole === 'owner')) {
            audioService.playCounterChime();
          }

          // Trigger multilingual voice announcement if configured for staff
          if (payload.data?.spokenText) {
            voiceAnnouncementService.speakImmediate(payload.data.spokenText);
          }
        }

        if (onCustomMessage) {
          onCustomMessage(payload);
        }
      });

      this.isListening = true;
    } catch (err) {
      console.warn('[FCM] Foreground listener error:', err);
    }
  }

  public getCurrentToken(): string | null {
    return this.currentToken;
  }
}

export const fcmService = FCMService.getInstance();
