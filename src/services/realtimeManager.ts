// ====================================================================
// RESTO OS: Realtime Subscriptions Manager
// Centralized PostgreSQL change subscriptions with deduplication,
// reconnect recovery, audio announcement dispatch & state sync
// ====================================================================

import { supabase, isLiveSupabaseConfigured } from './supabase';
import { audioService } from './audioService';
import { voiceAnnouncementService } from './voiceAnnouncementService';
import { dbAdapter } from './databaseAdapter';
import { RealtimeChannel } from '@supabase/supabase-js';

type RealtimeEventHandler = (eventType: string, payload: any) => void;

class RealtimeManager {
  private channel: RealtimeChannel | null = null;
  private isSubscribed = false;
  private processedEventIds = new Set<string>();
  private handlers = new Set<RealtimeEventHandler>();
  private reconnectTimer: any = null;

  constructor() {
    // Periodically clean up old processed event IDs to prevent memory growth
    setInterval(() => {
      if (this.processedEventIds.size > 2000) {
        this.processedEventIds.clear();
      }
    }, 10 * 60 * 1000);
  }

  public subscribe(restaurantId = 'rest-001-main') {
    if (this.isSubscribed || !isLiveSupabaseConfigured()) {
      return;
    }

    try {
      this.channel = supabase.channel(`resto-realtime-${restaurantId}`, {
        config: {
          broadcast: { self: true },
          presence: { key: restaurantId },
        },
      });

      // 1. ORDERS
      this.channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => this.handleEvent('orders', payload)
      );

      // 2. KITCHEN TICKETS
      this.channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kitchen_tickets' },
        (payload) => this.handleEvent('kitchen_tickets', payload)
      );

      // 3. WAITER CALLS
      this.channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waiter_calls' },
        (payload) => this.handleEvent('waiter_calls', payload)
      );

      // 4. PAYMENTS
      this.channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        (payload) => this.handleEvent('payments', payload)
      );

      // 5. INVOICES
      this.channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices' },
        (payload) => this.handleEvent('invoices', payload)
      );

      // 6. RESTAURANT TABLES
      this.channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'restaurant_tables' },
        (payload) => this.handleEvent('restaurant_tables', payload)
      );

      // 7. TABLE SESSIONS
      this.channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'table_sessions' },
        (payload) => this.handleEvent('table_sessions', payload)
      );

      // 8. NOTIFICATION EVENTS (Voice & Dashboard alerts)
      this.channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notification_events' },
        (payload) => this.handleNotificationEvent(payload)
      );

      this.channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.isSubscribed = true;
          console.log(`[RESTO Realtime] Subscribed to live events for ${restaurantId}`);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          this.isSubscribed = false;
          this.scheduleReconnect(restaurantId);
        }
      });
    } catch (err) {
      console.error('[RESTO Realtime] Subscription error:', err);
    }
  }

  private handleEvent(table: string, payload: any) {
    const recordId = payload.new?.id || payload.old?.id;
    const eventKey = `${table}:${payload.eventType}:${recordId}:${payload.commit_timestamp || ''}`;

    // Deduplication check
    if (this.processedEventIds.has(eventKey)) {
      return;
    }
    this.processedEventIds.add(eventKey);

    // Notify registered UI / Store listeners
    for (const handler of this.handlers) {
      try {
        handler(table, payload);
      } catch (err) {
        console.error('[RESTO Realtime] Handler exception:', err);
      }
    }
  }

  private handleNotificationEvent(payload: any) {
    const notif = payload.new;
    if (!notif) return;

    const eventKey = `notif:${notif.id}`;
    if (this.processedEventIds.has(eventKey)) return;
    this.processedEventIds.add(eventKey);

    // Role-Filtered Audio & Voice Announcements
    try {
      const activeRole = (typeof window !== 'undefined'
        ? (localStorage.getItem('resto_active_role') || localStorage.getItem('resto_staff_role'))
        : null) as string | null;

      // Customers and unauthenticated devices NEVER play staff alert sounds
      if (activeRole && activeRole !== 'customer') {
        const evType = notif.event_type || 'NEW_ORDER';

        if (
          (evType === 'CALL_WAITER' || evType === 'ORDER_READY') &&
          (activeRole === 'waiter' || activeRole === 'admin' || activeRole === 'owner')
        ) {
          audioService.playWaiterCallBell();
          audioService.vibrate([250, 100, 250]);
        } else if (
          evType === 'NEW_ORDER' &&
          (activeRole === 'kitchen' || activeRole === 'admin' || activeRole === 'owner')
        ) {
          audioService.playNewOrderChime();
        } else if (
          (evType === 'REQUEST_BILL' || evType === 'BILL_REQUESTED' || evType === 'PAYMENT_RECEIVED') &&
          (activeRole === 'counter' || activeRole === 'admin' || activeRole === 'owner')
        ) {
          audioService.playCounterChime();
        }

        if (notif.message_hi || notif.message_en || notif.title) {
          const currentSettings = dbAdapter.getVoiceSettings();
          voiceAnnouncementService.announceEvent(
            {
              id: notif.id,
              restaurant_id: notif.restaurant_id || 'rest-001-main',
              event_type: notif.event_type || 'NEW_ORDER',
              reference_id: notif.reference_id || notif.id,
              event_payload: {
                table_id: notif.table_id,
                table_number: notif.table_number,
                order_id: notif.order_id,
              },
              created_at: notif.created_at || new Date().toISOString(),
            },
            currentSettings
          );
        }
      }
    } catch {
      // Audio autoplay policy may restrict before interaction
    }

    // Pass to general handlers
    for (const handler of this.handlers) {
      try {
        handler('notification_events', payload);
      } catch (err) {
        console.error(err);
      }
    }
  }

  private scheduleReconnect(restaurantId: string) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      console.log('[RESTO Realtime] Attempting reconnection...');
      this.subscribe(restaurantId);
    }, 5000);
  }

  public addListener(handler: RealtimeEventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  public unsubscribe() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.isSubscribed = false;
  }
}

export const realtimeManager = new RealtimeManager();
