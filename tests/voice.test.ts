import { describe, it, expect, beforeEach } from 'vitest';
import { dbAdapter } from '../src/services/databaseAdapter';
import { voiceAnnouncementService } from '../src/services/voiceAnnouncementService';
import { VoiceSettings, NotificationEvent } from '../src/types';

describe('Module 1 Acceptance Tests: Smart Voice Announcement System', () => {
  beforeEach(() => {
    // Reset voice settings to standard defaults
    dbAdapter.updateVoiceSettings({
      voice_enabled: true,
      sound_enabled: true,
      language: 'hi',
      volume: 1.0,
      speech_rate: 1.0,
      repeat_count: 1,
    });
  });

  it('VOICE-01: Formulates accurate Hindi & English announcements for new order', () => {
    const payload = { table_number: 'T-05', waiter_name: 'Rahul', amount: 850 };

    const hindiCounter = voiceAnnouncementService.formatAnnouncementText('NEW_ORDER', payload, 'hi', 'counter');
    expect(hindiCounter).toContain('Table number T-05 se naya order aaya hai');

    const englishCounter = voiceAnnouncementService.formatAnnouncementText('NEW_ORDER', payload, 'en', 'counter');
    expect(englishCounter).toContain('Table Number T-05');
    expect(englishCounter).toContain('new order has been received');

    const hindiWaiter = voiceAnnouncementService.formatAnnouncementText('NEW_ORDER', payload, 'hi', 'waiter');
    expect(hindiWaiter).toContain('Waiter Rahul');
    expect(hindiWaiter).toContain('Table number T-05 se naya order aaya hai');

    const englishWaiter = voiceAnnouncementService.formatAnnouncementText('NEW_ORDER', payload, 'en', 'waiter');
    expect(englishWaiter).toContain('Waiter Rahul');
    expect(englishWaiter).toContain('Table Number T-05');
  });

  it('VOICE-02: Formulates waiter call, bill request, food ready and repeat QR announcements', () => {
    const payload = { table_number: 'T-02' };

    // Waiter Call
    const waiterCallHi = voiceAnnouncementService.formatAnnouncementText('CALL_WAITER', payload, 'hi');
    expect(waiterCallHi).toContain('Table number T-02 se waiter ko bulaya ja raha hai');
    const waiterCallEn = voiceAnnouncementService.formatAnnouncementText('CALL_WAITER', payload, 'en');
    expect(waiterCallEn).toContain('waiter has been requested from Table Number T-02');

    // Bill Request
    const billHi = voiceAnnouncementService.formatAnnouncementText('REQUEST_BILL', payload, 'hi');
    expect(billHi).toContain('Table number T-02 se bill request aayi hai');
    const billEn = voiceAnnouncementService.formatAnnouncementText('REQUEST_BILL', payload, 'en');
    expect(billEn).toContain('bill has been requested from Table Number T-02');

    // Food Ready
    const foodHi = voiceAnnouncementService.formatAnnouncementText('ORDER_READY', payload, 'hi');
    expect(foodHi).toContain('Table number T-02 ka order ready hai');
    const foodEn = voiceAnnouncementService.formatAnnouncementText('ORDER_READY', payload, 'en');
    expect(foodEn).toContain('Order for Table Number T-02 is ready');

    // Repeat QR
    const repeatHi = voiceAnnouncementService.formatAnnouncementText('REPEAT_SCAN', payload, 'hi');
    expect(repeatHi).toContain('repeat QR scan detect hua hai');
  });

  it('VOICE-03: Filters events strictly based on device staff role', () => {
    const orderPayload = { table_number: 'T-01', waiter_id: 'st-wtr-1' };

    // Counter role relevance
    expect(voiceAnnouncementService.isEventRelevantToRole('NEW_ORDER', 'counter', orderPayload)).toBe(true);
    expect(voiceAnnouncementService.isEventRelevantToRole('REQUEST_BILL', 'counter', orderPayload)).toBe(true);
    expect(voiceAnnouncementService.isEventRelevantToRole('REPEAT_SCAN', 'counter', orderPayload)).toBe(true);
    expect(voiceAnnouncementService.isEventRelevantToRole('ORDER_READY', 'counter', orderPayload)).toBe(false);

    // Waiter role relevance (assigned waiter vs other waiter)
    expect(voiceAnnouncementService.isEventRelevantToRole('NEW_ORDER', 'waiter', orderPayload, 'st-wtr-1')).toBe(true);
    expect(voiceAnnouncementService.isEventRelevantToRole('NEW_ORDER', 'waiter', orderPayload, 'st-wtr-other')).toBe(false);
    expect(voiceAnnouncementService.isEventRelevantToRole('CALL_WAITER', 'waiter', orderPayload)).toBe(true);
    expect(voiceAnnouncementService.isEventRelevantToRole('ORDER_READY', 'waiter', orderPayload)).toBe(true);
    expect(voiceAnnouncementService.isEventRelevantToRole('REQUEST_BILL', 'waiter', orderPayload)).toBe(false);

    // Kitchen role relevance
    expect(voiceAnnouncementService.isEventRelevantToRole('NEW_ORDER', 'kitchen', orderPayload)).toBe(true);
    expect(voiceAnnouncementService.isEventRelevantToRole('ORDER_CANCELLED', 'kitchen', orderPayload)).toBe(true);
    expect(voiceAnnouncementService.isEventRelevantToRole('CALL_WAITER', 'kitchen', orderPayload)).toBe(false);

    // Admin receives all events
    expect(voiceAnnouncementService.isEventRelevantToRole('NEW_ORDER', 'admin', orderPayload)).toBe(true);
    expect(voiceAnnouncementService.isEventRelevantToRole('CALL_WAITER', 'admin', orderPayload)).toBe(true);
    expect(voiceAnnouncementService.isEventRelevantToRole('REPEAT_SCAN', 'admin', orderPayload)).toBe(true);
  });

  it('VOICE-04: Respects muted settings and does not speak when voice is disabled', () => {
    const settings: VoiceSettings = {
      ...dbAdapter.getVoiceSettings(),
      voice_enabled: false,
    };

    const event: NotificationEvent = {
      id: `ev-test-${Date.now()}`,
      restaurant_id: 'rest-001-main',
      event_type: 'NEW_ORDER',
      event_payload: { table_number: 'T-01' },
      created_at: new Date().toISOString(),
    };

    const announced = voiceAnnouncementService.processNotificationEvent(event, settings, 'counter');
    expect(announced).toBe(false);
  });

  it('VOICE-05: Deduplicates events and ignores historical events on reconnect', () => {
    const settings = dbAdapter.getVoiceSettings();
    const eventId = `ev-dedup-${Date.now()}`;

    const liveEvent: NotificationEvent = {
      id: eventId,
      restaurant_id: 'rest-001-main',
      event_type: 'NEW_ORDER',
      event_payload: { table_number: 'T-01' },
      created_at: new Date().toISOString(),
    };

    // First emission processes
    const firstCall = voiceAnnouncementService.processNotificationEvent(liveEvent, settings, 'counter');
    expect(firstCall).toBe(true);

    // Duplicate emission with same event ID is rejected
    const secondCall = voiceAnnouncementService.processNotificationEvent(liveEvent, settings, 'counter');
    expect(secondCall).toBe(false);

    // Stale historical event from 2 hours ago is rejected
    const historicalEvent: NotificationEvent = {
      id: `ev-old-${Date.now()}`,
      restaurant_id: 'rest-001-main',
      event_type: 'NEW_ORDER',
      event_payload: { table_number: 'T-01' },
      created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    };
    const historicalCall = voiceAnnouncementService.processNotificationEvent(historicalEvent, settings, 'counter');
    expect(historicalCall).toBe(false);
  });
});
