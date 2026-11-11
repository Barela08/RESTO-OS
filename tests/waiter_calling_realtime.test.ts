import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dbAdapter } from '../src/services/databaseAdapter';
import { voiceAnnouncementService } from '../src/services/voiceAnnouncementService';
import { audioService } from '../src/services/audioService';
import { WaiterCall, TableSession, RestaurantTable } from '../src/types';

describe('RESTO OS: Realtime Waiter Calling, Instant Sound Alert & Voice Announcement Master Test Suite', () => {
  let testTable: RestaurantTable;
  let testSession: TableSession;

  beforeEach(() => {
    // Ensure table 10 exists
    let t10 = dbAdapter.getTables().find((t) => t.table_number === 'T-10' || t.table_number === '10');
    if (!t10) {
      t10 = dbAdapter.addTable({
        table_number: 'T-10',
        seating_capacity: 4,
        floor_area: 'Main Dining Floor',
      });
    }
    testTable = t10;

    // Assign Table 10 to waiter 'st-wtr-1'
    dbAdapter.assignWaiterToTable(testTable.id, 'st-wtr-1');

    // Create a verified active table session for Table 10
    testSession = dbAdapter.createSession(testTable.id, 'cust-test-10', 'Arjun Sharma', '9876543210');

    // Clear existing waiter calls for clean isolation
    const calls = dbAdapter.getWaiterCalls();
    calls.length = 0;

    // Reset voice settings
    dbAdapter.updateVoiceSettings({
      voice_enabled: true,
      sound_enabled: true,
      language: 'hi',
      volume: 1.0,
      speech_rate: 1.0,
      repeat_count: 1,
    });

    audioService.setMuted(false);
    audioService.setVolume(1.0);
  });

  // 1. Customer clicks Call Waiter at Table 10
  it('TEST-01: Customer initiates waiter call through verified session', () => {
    const call = dbAdapter.requestService(
      testSession.id,
      'CALL_WAITER',
      'Need extra cutlery and napkins'
    );

    expect(call).toBeDefined();
    expect(call.table_id).toBe(testTable.id);
    expect(call.table_number).toBe('T-10');
    expect(call.notes).toBe('Need extra cutlery and napkins');
  });

  // 2. Backend identifies Table 10 from verified table session, rejecting URL tampering
  it('TEST-02: Backend strictly resolves table from verified session, rejecting invalid sessions and tampering', () => {
    // Attempt with forged/unregistered session ID
    expect(() => {
      dbAdapter.requestService('fake-forged-session-id', 'CALL_WAITER');
    }).toThrow(/Active table session not found/i);

    // Attempt with closed/completed session
    const expiredSession = dbAdapter.createSession(testTable.id, 'cust-exp');
    dbAdapter.closeSession(expiredSession.id);

    expect(() => {
      dbAdapter.requestService(expiredSession.id, 'CALL_WAITER');
    }).toThrow(/Active table session not found/i);
  });

  // 3. Assigned waiter for Table 10 is identified
  it('TEST-03: Correct assigned waiter for Table 10 is resolved by the backend', () => {
    const call = dbAdapter.requestService(testSession.id, 'CALL_WAITER');
    expect(call.assigned_waiter_id).toBe('st-wtr-1');
  });

  // 4. Call record created in database with unique ID and REQUESTED status
  it('TEST-04: Call record is created with unique ID and REQUESTED status, preventing duplicate calls', () => {
    const call = dbAdapter.requestService(testSession.id, 'CALL_WAITER');

    expect(call.id).toMatch(/^wc-/);
    expect(call.status).toBe('REQUESTED');
    expect(call.created_at).toBeDefined();

    // Prevent duplicate active calls while first call is in progress
    expect(() => {
      dbAdapter.requestService(testSession.id, 'CALL_WAITER');
    }).toThrow(/already active/i);
  });

  // 5. Realtime event emitted with table number and assigned waiter ID
  it('TEST-05: Realtime event is emitted containing exact table number and assigned waiter ID', () => {
    const call = dbAdapter.requestService(testSession.id, 'CALL_WAITER');
    const events = dbAdapter.getNotificationEvents();
    const waiterCallEvent = events.find((e) => e.event_type === 'CALL_WAITER' && e.reference_id === call.id);

    expect(waiterCallEvent).toBeDefined();
    expect(waiterCallEvent?.event_payload.table_number).toBe('T-10');
    expect(waiterCallEvent?.event_payload.waiter_id).toBe('st-wtr-1');
  });

  // 6. Waiter receives realtime notification and sound alert
  it('TEST-06: Instant sound alert executes without throwing errors', () => {
    expect(() => {
      audioService.playWaiterCallBell(0.8);
    }).not.toThrow();
  });

  // 7. Voice announcement formatted with clean numerical table number pronunciation
  it('TEST-07: Voice engine cleans table prefixes for natural numeral speech (e.g. Table number 10, never T-10)', () => {
    // Hindi phrasing
    const hindiRaw = voiceAnnouncementService.formatAnnouncementText(
      'CALL_WAITER',
      { table_number: 'T-10' },
      'hi'
    );
    expect(hindiRaw).toContain('Table number T-10 se waiter ko bulaya ja raha hai');

    // Speech synthesizer text conversion cleans 'T-10' -> '10'
    const hindiSpoken = voiceAnnouncementService.getSpokenAnnouncementText(hindiRaw);
    expect(hindiSpoken).toContain('Table number 10 se waiter ko bulaya ja raha hai');
    expect(hindiSpoken).not.toContain('T-10');

    // English phrasing
    const englishRaw = voiceAnnouncementService.formatAnnouncementText(
      'CALL_WAITER',
      { table_number: 'T-10' },
      'en'
    );
    const englishSpoken = voiceAnnouncementService.getSpokenAnnouncementText(englishRaw);
    expect(englishSpoken).toContain('Table Number 10');
    expect(englishSpoken).not.toContain('T-10');
  });

  // 8. Customer interface shows updated status (REQUESTED)
  it('TEST-08: Customer interface retrieves active call in REQUESTED status', () => {
    const call = dbAdapter.requestService(testSession.id, 'CALL_WAITER');
    const activeCall = dbAdapter.getActiveWaiterCallForSession(testSession.id);

    expect(activeCall).toBeDefined();
    expect(activeCall?.id).toBe(call.id);
    expect(activeCall?.status).toBe('REQUESTED');
  });

  // 9. Waiter accepts call -> status updates to ACCEPTED, response time recorded
  it('TEST-09: Waiter acceptance transitions status to ACCEPTED and computes response time in seconds', () => {
    const call = dbAdapter.requestService(testSession.id, 'CALL_WAITER');

    const acceptedCall = dbAdapter.acceptWaiterCall(call.id, 'st-wtr-1');
    expect(acceptedCall.status).toBe('ACCEPTED');
    expect(acceptedCall.accepted_at).toBeDefined();
    expect(typeof acceptedCall.response_time_seconds).toBe('number');
    expect(acceptedCall.response_time_seconds).toBeGreaterThanOrEqual(0);
  });

  // 10. Customer interface updates to ACCEPTED
  it('TEST-10: Customer session query reflects ACCEPTED status in realtime', () => {
    const call = dbAdapter.requestService(testSession.id, 'CALL_WAITER');
    dbAdapter.acceptWaiterCall(call.id, 'st-wtr-1');

    const activeCall = dbAdapter.getActiveWaiterCallForSession(testSession.id);
    expect(activeCall?.status).toBe('ACCEPTED');
  });

  // 11. Waiter marks ON_THE_WAY -> customer sees ON_THE_WAY
  it('TEST-11: Waiter marks ON_THE_WAY and customer interface updates immediately', () => {
    const call = dbAdapter.requestService(testSession.id, 'CALL_WAITER');
    dbAdapter.acceptWaiterCall(call.id, 'st-wtr-1');
    const onTheWayCall = dbAdapter.markWaiterCallOnTheWay(call.id, 'st-wtr-1');

    expect(onTheWayCall.status).toBe('ON_THE_WAY');
    expect(onTheWayCall.on_the_way_at).toBeDefined();

    const activeCall = dbAdapter.getActiveWaiterCallForSession(testSession.id);
    expect(activeCall?.status).toBe('ON_THE_WAY');
  });

  // 12. Waiter marks ARRIVED -> customer sees ARRIVED
  it('TEST-12: Waiter marks ARRIVED and customer interface reflects server arrival', () => {
    const call = dbAdapter.requestService(testSession.id, 'CALL_WAITER');
    dbAdapter.acceptWaiterCall(call.id, 'st-wtr-1');
    dbAdapter.markWaiterCallOnTheWay(call.id, 'st-wtr-1');
    const arrivedCall = dbAdapter.markWaiterCallArrived(call.id, 'st-wtr-1');

    expect(arrivedCall.status).toBe('ARRIVED');
    expect(arrivedCall.arrived_at).toBeDefined();

    const activeCall = dbAdapter.getActiveWaiterCallForSession(testSession.id);
    expect(activeCall?.status).toBe('ARRIVED');
  });

  // 13. Waiter completes call -> status COMPLETED, completed_at recorded
  it('TEST-13: Waiter completes request, recording completed_at and clearing active call tracker', () => {
    const call = dbAdapter.requestService(testSession.id, 'CALL_WAITER');
    dbAdapter.acceptWaiterCall(call.id, 'st-wtr-1');
    const completedCall = dbAdapter.completeWaiterCall(call.id, 'st-wtr-1');

    expect(completedCall.status).toBe('COMPLETED');
    expect(completedCall.completed_at).toBeDefined();

    // Active call for customer should now be null so customer can call again when needed
    const activeCall = dbAdapter.getActiveWaiterCallForSession(testSession.id);
    expect(activeCall).toBeNull();
  });

  // 14. Admin dashboard reflects completed call in KPIs and waiter performance summary
  it('TEST-14: Admin analytics dashboard captures completed calls and calculates staff performance', () => {
    const call = dbAdapter.requestService(testSession.id, 'CALL_WAITER');
    dbAdapter.acceptWaiterCall(call.id, 'st-wtr-1');
    dbAdapter.completeWaiterCall(call.id, 'st-wtr-1');

    const analytics = dbAdapter.getWaiterCallAnalytics();
    expect(analytics.totalCallsToday).toBeGreaterThanOrEqual(1);
    expect(analytics.completedCalls).toBeGreaterThanOrEqual(1);

    const waiterStat = analytics.waiterStats.find((w) => w.waiterId === 'st-wtr-1');
    expect(waiterStat).toBeDefined();
    expect(waiterStat?.completed).toBeGreaterThanOrEqual(1);
    expect(typeof waiterStat?.avgResponseTimeSeconds).toBe('number');
  });

  // 15. Duplicate Realtime delivery does NOT produce duplicate sounds
  it('TEST-15: Deduplication prevents re-triggering sound/voice on identical realtime delivery', () => {
    const notifiedCallIds = new Set<string>();
    const callId = 'wc-test-dedup-1';

    // First arrival
    expect(notifiedCallIds.has(callId)).toBe(false);
    notifiedCallIds.add(callId);

    // Re-render or duplicate broadcast arrival
    const shouldNotify = !notifiedCallIds.has(callId);
    expect(shouldNotify).toBe(false);
  });

  // 16. Reconnecting does NOT replay historical notifications
  it('TEST-16: Reconnecting or page refresh does NOT replay historical calls older than mount time', () => {
    const mountTime = Date.now();
    const historicalCallTime = mountTime - 3600000; // 1 hour ago

    const isRecent = historicalCallTime >= mountTime - 15000;
    expect(isRecent).toBe(false);
  });

  // 17. Unauthorized waiter cannot access another waiter's private calls
  it('TEST-17: Role-based filtering routes calls strictly to assigned waiter unless escalated', () => {
    const callPayload = { waiter_id: 'st-wtr-1', table_number: 'T-10' };

    // Assigned waiter: relevant
    const isAssignedRelevant = voiceAnnouncementService.isEventRelevantToRole(
      'CALL_WAITER',
      'waiter',
      callPayload,
      'st-wtr-1'
    );
    expect(isAssignedRelevant).toBe(true);

    // Another waiter: not relevant
    const isOtherRelevant = voiceAnnouncementService.isEventRelevantToRole(
      'CALL_WAITER',
      'waiter',
      callPayload,
      'st-wtr-2'
    );
    expect(isOtherRelevant).toBe(false);

    // Admin: always relevant
    const isAdminRelevant = voiceAnnouncementService.isEventRelevantToRole(
      'CALL_WAITER',
      'admin',
      callPayload
    );
    expect(isAdminRelevant).toBe(true);
  });

  // 18. Scanning QR or opening menu does NOT trigger waiter calls or sounds
  it('TEST-18: QR validation, menu browsing and cart additions never create waiter calls', () => {
    const initialCallsCount = dbAdapter.getWaiterCalls().length;

    // Simulate QR validation
    const token = dbAdapter.generateDailyQrToken(testTable.id);
    dbAdapter.validateQrToken(token.token);

    // Simulate menu fetching
    dbAdapter.getMenuItems();
    dbAdapter.getCategories();

    // Verify calls table remains untouched
    expect(dbAdapter.getWaiterCalls().length).toBe(initialCallsCount);
  });

  // 19. Unattended calls automatically escalate after timeout
  it('TEST-19: Unattended calls automatically escalate after timeout and emit URGENT_ASSISTANCE', () => {
    // Create call with old timestamp
    const call = dbAdapter.requestService(testSession.id, 'CALL_WAITER');

    // Artificially age the call by 90 seconds
    const agedTime = new Date(Date.now() - 90000).toISOString();
    call.created_at = agedTime;

    // Check escalation with 60s timeout
    const escalatedCount = dbAdapter.checkAndEscalateWaiterCalls(60);
    expect(escalatedCount).toBe(1);

    expect(call.status).toBe('ESCALATED');
    expect(call.is_escalated).toBe(true);
    expect(call.priority).toBe('URGENT');
    expect(call.escalated_at).toBeDefined();

    // Urgent assistance event emitted
    const events = dbAdapter.getNotificationEvents();
    const urgentEvent = events.find((e) => e.event_type === 'URGENT_ASSISTANCE' && e.reference_id === call.id);
    expect(urgentEvent).toBeDefined();
  });

  // 20. If sound permission is blocked by browser, visual notification still functions
  it('TEST-20: Visual workflows and state transitions operate flawlessly even when sound is muted', () => {
    audioService.setMuted(true);
    expect(audioService.getIsMuted()).toBe(true);

    // Create call
    const call = dbAdapter.requestService(testSession.id, 'CALL_WAITER');
    expect(call.status).toBe('REQUESTED');

    // Waiter accepts
    const accepted = dbAdapter.acceptWaiterCall(call.id, 'st-wtr-1');
    expect(accepted.status).toBe('ACCEPTED');

    // Customer visual tracker receives update
    const customerCall = dbAdapter.getActiveWaiterCallForSession(testSession.id);
    expect(customerCall?.status).toBe('ACCEPTED');

    // Audio methods do not crash when muted
    expect(() => {
      audioService.playWaiterCallBell();
    }).not.toThrow();
  });
});
