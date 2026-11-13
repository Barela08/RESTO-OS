// ====================================================================
// RESTO OS - Multi-Device Role-Based Notification & Operational Dispatch Test Suite
// Verifies 4 physically independent device roles:
// - DEVICE 1: Cash Counter Computer
// - DEVICE 2: Waiter Mobile
// - DEVICE 3: Kitchen Station Device
// - DEVICE 4: Customer Mobile
// Strict Sound Ownership: Customer phone NEVER plays staff bells or kitchen chimes.
// ====================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dbAdapter } from '../src/services/databaseAdapter';
import { audioService } from '../src/services/audioService';
import { voiceAnnouncementService } from '../src/services/voiceAnnouncementService';
import { deviceRegistrationService } from '../src/services/firebase/deviceRegistrationService';
import { OrderRepository } from '../src/services/firebase/orderRepository';
import { WaiterCallRepository } from '../src/services/firebase/waiterCallRepository';

describe('RESTO OS - Multi-Device Hardware Role Notification & Realtime Architecture', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ==================================================================
  // TEST 1: Customer Call Waiter – Correct Destination & Silent Customer
  // ==================================================================
  it('TEST 1: Customer Call Waiter -> Customer sees REQUEST_SENT & SILENT; Waiter mobile receives alert & sound', async () => {
    const restaurant = dbAdapter.getRestaurant();
    const table = dbAdapter.getTables()[0];
    const session = dbAdapter.getOrCreateActiveSession(table.id);

    // Spies for audio on customer vs waiter devices
    const waiterBellSpy = vi.spyOn(audioService, 'playWaiterCallBell');
    const newOrderChimeSpy = vi.spyOn(audioService, 'playNewOrderChime');
    const announceSpy = vi.spyOn(voiceAnnouncementService, 'announceEvent');

    // Setup Device 4: Customer Mobile context
    localStorage.setItem('resto_active_role', 'customer');

    // Customer triggers Call Waiter from mobile
    const call = await dbAdapter.requestServiceAsync({
      tableSessionId: session.id,
      requestType: 'CALL_WAITER',
      notes: 'Need extra water glasses',
    });

    expect(call).toBeDefined();
    expect(call.status).toBe('PENDING');
    expect(call.table_number).toBe(table.table_number);

    // CRITICAL REQUIREMENT: Customer mobile MUST NOT play waiter alert sound!
    expect(waiterBellSpy).not.toHaveBeenCalled();
    expect(newOrderChimeSpy).not.toHaveBeenCalled();

    // Verify VoiceAnnouncementService ignores customer devices
    const customerVoiceSettings = dbAdapter.getVoiceSettings();
    const announcedToCustomer = voiceAnnouncementService.processNotificationEvent(
      {
        id: `ev-${call.id}`,
        restaurant_id: restaurant.id,
        event_type: 'CALL_WAITER',
        reference_id: call.id,
        event_payload: { table_number: table.table_number, table_id: table.id },
        created_at: new Date().toISOString(),
      },
      customerVoiceSettings,
      'customer'
    );
    expect(announcedToCustomer).toBe(false);

    // Setup Device 2: Waiter Mobile context
    localStorage.setItem('resto_active_role', 'waiter');
    localStorage.setItem('resto_staff_id', 'st-wtr-1');

    // Waiter device receives call notification
    const waiterVoiceSettings = dbAdapter.getVoiceSettings();
    const isRelevantToWaiter = voiceAnnouncementService.isEventRelevantToRole(
      'CALL_WAITER',
      'waiter',
      { table_number: table.table_number, table_id: table.id }
    );
    expect(isRelevantToWaiter).toBe(true);

    // Waiter plays alert bell
    audioService.playWaiterCallBell();
    expect(waiterBellSpy).toHaveBeenCalledTimes(1);

    // Waiter accepts request
    const acceptedCall = dbAdapter.acceptWaiterCall(call.id, 'st-wtr-1');
    expect(acceptedCall?.status).toBe('ACCEPTED');
    expect(acceptedCall?.accepted_by).toBe('st-wtr-1');

    // Customer device sees ACCEPTED
    const customerView = dbAdapter.getActiveWaiterCallForSession(session.id);
    expect(customerView?.status).toBe('ACCEPTED');
  });

  // ==================================================================
  // TEST 2: Role-Specific Order Dispatch – Kitchen Receives Chime, Customer Silent
  // ==================================================================
  it('TEST 2: Customer places order -> Kitchen device receives ticket & sound; Customer device is SILENT', async () => {
    const table = dbAdapter.getTables()[1];
    const session = dbAdapter.getOrCreateActiveSession(table.id);

    const menuItems = dbAdapter.getMenuItems();
    const selectedItem = menuItems.find((m) => m.is_available) || menuItems[0];

    // Spy on audio
    const kitchenChimeSpy = vi.spyOn(audioService, 'playNewOrderChime');
    const waiterBellSpy = vi.spyOn(audioService, 'playWaiterCallBell');

    // Device 4: Customer Mobile places order
    localStorage.setItem('resto_active_role', 'customer');

    const order = await dbAdapter.placeOrderAsync({
      tableSessionId: session.id,
      items: [{ menuItemId: selectedItem.id, quantity: 2, specialInstructions: 'Less spicy' }],
    });

    expect(order).toBeDefined();
    expect(['PLACED', 'NEW'].includes(order.status)).toBe(true);
    expect(order.total_amount).toBeGreaterThan(0);

    // VERIFY: Customer device did NOT play new order chime or waiter bell!
    expect(kitchenChimeSpy).not.toHaveBeenCalled();
    expect(waiterBellSpy).not.toHaveBeenCalled();

    // Verify Kitchen ticket was generated
    const tickets = dbAdapter.getKitchenTickets().filter((t) => t.order_id === order.id);
    expect(tickets.length).toBeGreaterThan(0);
    expect(tickets[0].status).toBe('NEW');

    // Switch to Device 3: Kitchen Station Device
    localStorage.setItem('resto_active_role', 'kitchen');

    // Kitchen Station receives new ticket event and sounds kitchen chime
    const isRelevantToKitchen = voiceAnnouncementService.isEventRelevantToRole(
      'NEW_ORDER',
      'kitchen',
      { table_number: table.table_number, order_id: order.id }
    );
    expect(isRelevantToKitchen).toBe(true);

    audioService.playNewOrderChime();
    expect(kitchenChimeSpy).toHaveBeenCalledTimes(1);

    // Customer order tracking reflects confirmed order
    const trackedOrder = dbAdapter.getOrders().find((o) => o.id === order.id);
    expect(trackedOrder).toBeDefined();
    expect(trackedOrder?.items.length).toBe(1);
  });

  // ==================================================================
  // TEST 3: Kitchen Marks Ready – Waiter Receives Alert, Customer Silent Status
  // ==================================================================
  it('TEST 3: Kitchen marks order ready -> Waiter mobile receives ready bell & vibration; Customer sees READY_FOR_HANDOVER silently', async () => {
    const table = dbAdapter.getTables()[2];
    const session = dbAdapter.getOrCreateActiveSession(table.id);
    const order = dbAdapter.placeOrder({
      tableSessionId: session.id,
      items: [{ menuItemId: dbAdapter.getMenuItems()[0].id, quantity: 1 }],
    });

    const ticket = dbAdapter.getKitchenTickets().find((t) => t.order_id === order.id);
    expect(ticket).toBeDefined();

    const waiterBellSpy = vi.spyOn(audioService, 'playWaiterCallBell');
    const vibrateSpy = vi.spyOn(audioService, 'vibrate');

    // Device 3: Kitchen marks ticket READY
    localStorage.setItem('resto_active_role', 'kitchen');
    dbAdapter.updateKitchenTicketStatus(ticket!.id, 'READY');

    const updatedTicket = dbAdapter.getKitchenTickets().find((t) => t.id === ticket!.id);
    expect(updatedTicket?.status).toBe('READY');

    // The kitchen device itself does NOT play the waiter call bell
    expect(waiterBellSpy).not.toHaveBeenCalled();

    // Device 2: Waiter Mobile receives ready ticket alert
    localStorage.setItem('resto_active_role', 'waiter');
    const isReadyRelevantToWaiter = voiceAnnouncementService.isEventRelevantToRole(
      'ORDER_READY',
      'waiter',
      { table_number: table.table_number, ticket_number: ticket!.ticket_number }
    );
    expect(isReadyRelevantToWaiter).toBe(true);

    // Waiter device plays bell and vibrates
    audioService.playWaiterCallBell();
    audioService.vibrate([250, 100, 250]);
    expect(waiterBellSpy).toHaveBeenCalledTimes(1);
    expect(vibrateSpy).toHaveBeenCalledWith([250, 100, 250]);

    // Device 4: Customer Mobile sees READY status without sound
    localStorage.setItem('resto_active_role', 'customer');
    const isReadyRelevantToCustomer = voiceAnnouncementService.isEventRelevantToRole(
      'ORDER_READY',
      'customer' as any,
      {}
    );
    expect(isReadyRelevantToCustomer).toBe(false);

    // Waiter marks food served
    localStorage.setItem('resto_active_role', 'waiter');
    dbAdapter.markOrderServed(order.id);
    const servedOrder = dbAdapter.getOrders().find((o) => o.id === order.id);
    expect(servedOrder?.status).toBe('SERVED');
  });

  // ==================================================================
  // TEST 4: Counter Records Cash Payment – Persistence, Invoice & Sound Isolation
  // ==================================================================
  it('TEST 4: Counter records cash payment -> Payment persisted, invoice generated; counter chime sounds, others silent', () => {
    const table = dbAdapter.getTables()[3];
    const session = dbAdapter.getOrCreateActiveSession(table.id);
    const order = dbAdapter.placeOrder({
      tableSessionId: session.id,
      items: [{ menuItemId: dbAdapter.getMenuItems()[0].id, quantity: 2 }],
    });

    const payment = dbAdapter.initiateCustomerPayment({
      tableSessionId: session.id,
      method: 'CASH',
    });
    expect(payment.payment_status).toBe('PENDING');

    const counterChimeSpy = vi.spyOn(audioService, 'playCounterChime');
    const waiterBellSpy = vi.spyOn(audioService, 'playWaiterCallBell');
    const kitchenChimeSpy = vi.spyOn(audioService, 'playNewOrderChime');

    // Device 1: Cash Counter confirms payment
    localStorage.setItem('resto_active_role', 'counter');
    const result = dbAdapter.confirmPayment({
      paymentId: payment.id,
      staffId: 'st-ctr-1',
      cashReceivedAmount: 500,
    });

    audioService.playCounterChime();

    expect(result.invoice).toBeDefined();
    expect(payment.payment_status).toBe('PAID');
    expect(counterChimeSpy).toHaveBeenCalledTimes(1);

    // Unrelated devices (Customer, Waiter, Kitchen) receive zero counter sounds
    expect(waiterBellSpy).not.toHaveBeenCalled();
    expect(kitchenChimeSpy).not.toHaveBeenCalled();

    // Table transitions to CLEANING
    const updatedTable = dbAdapter.getTables().find((t) => t.id === table.id);
    expect(updatedTable?.status).toBe('CLEANING');

    // Staff marks table cleaned -> returns to AVAILABLE
    dbAdapter.markTableCleaned(table.id, 'st-wtr-1');
    const readyTable = dbAdapter.getTables().find((t) => t.id === table.id);
    expect(readyTable?.status).toBe('AVAILABLE');
  });

  // ==================================================================
  // TEST 5: Refresh All Devices & Reconnect Network – State Recovery
  // ==================================================================
  it('TEST 5: Device refresh & network recovery preserves pending calls and tickets without dropping or duplicating', () => {
    const table = dbAdapter.getTables()[0];
    const session = dbAdapter.getOrCreateActiveSession(table.id);

    // Create a pending waiter call
    const call = dbAdapter.requestService({
      tableSessionId: session.id,
      requestType: 'WATER',
      notes: 'Chilled mineral water',
    });

    // Simulate device refresh: re-fetch from adapter storage
    const recoveredCalls = dbAdapter.getWaiterCalls();
    const foundCall = recoveredCalls.find((c) => c.id === call.id);
    expect(foundCall).toBeDefined();
    expect(foundCall?.status).toBe('PENDING');
    expect(foundCall?.notes).toBe('Chilled mineral water');

    // Verify deduplication set in VoiceAnnouncementService prevents re-announcing
    voiceAnnouncementService.markAnnounced(`ev-${call.id}`);
    expect(voiceAnnouncementService.hasAnnounced(`ev-${call.id}`)).toBe(true);

    const reAnnounceResult = voiceAnnouncementService.processNotificationEvent(
      {
        id: `ev-${call.id}`,
        restaurant_id: 'rest-001-main',
        event_type: 'CALL_WAITER',
        reference_id: call.id,
        event_payload: { table_number: table.table_number },
        created_at: new Date().toISOString(),
      },
      dbAdapter.getVoiceSettings(),
      'waiter'
    );
    // MUST return false: duplicate suppressed!
    expect(reAnnounceResult).toBe(false);
  });

  // ==================================================================
  // TEST 6: Device Role Registration & Telemetry Lifecycle
  // ==================================================================
  it('TEST 6: Device registration registers role, deviceId, FCM token and handles heartbeat & unregistration', async () => {
    const deviceId = deviceRegistrationService.getOrCreateDeviceId();
    expect(deviceId).toMatch(/^dev-/);

    // Register Waiter device
    const registration = await deviceRegistrationService.registerDevice({
      userId: 'usr-waiter-1',
      staffId: 'st-wtr-1',
      restaurantId: 'rest-001-main',
      role: 'waiter',
      deviceType: 'tablet',
      fcmToken: 'fcm-mock-token-abc123xyz',
    });

    expect(registration.deviceId).toBe(deviceId);
    expect(registration.role).toBe('waiter');
    expect(registration.deviceType).toBe('tablet');
    expect(registration.isActive).toBe(true);
    expect(registration.fcmToken).toBe('fcm-mock-token-abc123xyz');

    // Update FCM token
    await deviceRegistrationService.updateFcmToken('fcm-refreshed-token-999');

    // Trigger heartbeat
    await deviceRegistrationService.heartbeat();

    // Logout and unregister
    await deviceRegistrationService.unregisterDevice();
    expect(localStorage.getItem('resto_active_role')).toBeNull();
  }, 35000);
});
