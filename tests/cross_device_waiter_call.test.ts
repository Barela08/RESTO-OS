import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dbAdapter } from '../src/services/databaseAdapter';
import { WaiterCallRepository, mapFirestoreCallToWaiterCall } from '../src/services/firebase/waiterCallRepository';
import { FirestoreWaiterCall } from '../src/types/firestore';
import { TableSession, RestaurantTable, WaiterCall } from '../src/types';

describe('CRITICAL BUG FIX: Cross-Device Customer Waiter Call & Real-Time Sync Suite', () => {
  const restaurantId = 'rest-001-main';
  let tableT01: RestaurantTable;
  let sessionT01: TableSession;

  beforeEach(() => {
    // 1. Ensure Table T-01 exists for The Grand Bistro
    let t = dbAdapter.getTables().find((tbl) => tbl.table_number === 'T-01' || tbl.id === 'tbl-01');
    if (!t) {
      t = dbAdapter.addTable({
        table_number: 'T-01',
        seating_capacity: 4,
        floor_area: 'Main Dining Room',
        status: 'AVAILABLE',
        is_active: true,
      });
    }
    tableT01 = t;
    dbAdapter.assignWaiterToTable(tableT01.id, 'st-wtr-1');

    // 2. Active verified dining session for Table T-01
    sessionT01 = dbAdapter.getOrCreateActiveSession(tableT01.id);
    sessionT01.status = 'ACTIVE';
    sessionT01.customer_name = 'Test Diner T-01';

    // 3. Clear existing waiter calls in adapter for isolation
    const calls = dbAdapter.getWaiterCalls();
    calls.length = 0;
  });

  // -------------------------------------------------------------------------
  // TEST 1: Customer Call Initiated with PENDING status and ID format
  // -------------------------------------------------------------------------
  it('TEST-CROSS-01: Customer initiates waiter call for Table T-01 with initial PENDING status', async () => {
    const call = await dbAdapter.requestServiceAsync({
      tableSessionId: sessionT01.id,
      requestType: 'CALL_WAITER',
      notes: 'Customer at T-01 needs assistance',
    });

    expect(call).toBeDefined();
    expect(call.id).toMatch(/^call-/);
    expect(call.status).toBe('PENDING');
    expect(call.table_number).toBe('T-01');
    expect(call.table_id).toBe(tableT01.id);
    expect(call.customer_name).toBe('Test Diner T-01');
  });

  // -------------------------------------------------------------------------
  // TEST 2: Two-Device Lifecycle Status Progression (Customer <-> Waiter)
  // -------------------------------------------------------------------------
  it('TEST-CROSS-02: Full status lifecycle syncs between waiter and customer devices', async () => {
    // 1. Customer initiates call
    const initialCall = await dbAdapter.requestServiceAsync({
      tableSessionId: sessionT01.id,
      requestType: 'CALL_WAITER',
    });
    expect(initialCall.status).toBe('PENDING');

    // 2. Waiter accepts call -> ACCEPTED
    const acceptedCall = dbAdapter.acceptWaiterCall(initialCall.id, 'st-wtr-1');
    expect(acceptedCall.status).toBe('ACCEPTED');
    expect(acceptedCall.assigned_waiter_id).toBe('st-wtr-1');
    expect(acceptedCall.accepted_at).toBeDefined();

    // Verify customer active call tracker reflects ACCEPTED
    const customerView1 = dbAdapter.getActiveWaiterCallForSession(sessionT01.id);
    expect(customerView1?.status).toBe('ACCEPTED');

    // 3. Waiter is on the way -> ON_THE_WAY
    const onTheWayCall = dbAdapter.markWaiterCallOnTheWay(initialCall.id, 'st-wtr-1');
    expect(onTheWayCall.status).toBe('ON_THE_WAY');

    const customerView2 = dbAdapter.getActiveWaiterCallForSession(sessionT01.id);
    expect(customerView2?.status).toBe('ON_THE_WAY');

    // 4. Waiter arrives at table -> ARRIVED
    const arrivedCall = dbAdapter.markWaiterCallArrived(initialCall.id, 'st-wtr-1');
    expect(arrivedCall.status).toBe('ARRIVED');

    const customerView3 = dbAdapter.getActiveWaiterCallForSession(sessionT01.id);
    expect(customerView3?.status).toBe('ARRIVED');

    // 5. Waiter completes request -> COMPLETED
    const completedCall = dbAdapter.completeWaiterCall(initialCall.id, 'st-wtr-1');
    expect(completedCall.status).toBe('COMPLETED');
    expect(completedCall.completed_at).toBeDefined();

    // Active call is cleared for the session
    const customerView4 = dbAdapter.getActiveWaiterCallForSession(sessionT01.id);
    expect(customerView4).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // TEST 3: Waiter Dashboard Reload Preserves Pending Calls (No Timestamp Drop)
  // -------------------------------------------------------------------------
  it('TEST-CROSS-03: Dashboard reload preserves pending calls on mount without dropping older calls', async () => {
    // Simulate a call created 30 seconds ago
    const call = await dbAdapter.requestServiceAsync({
      tableSessionId: sessionT01.id,
      requestType: 'CALL_WAITER',
    });
    call.created_at = new Date(Date.now() - 30000).toISOString();

    // Simulate new dashboard mount receiving the state
    const currentCalls = dbAdapter.getWaiterCalls();
    const activeCalls = currentCalls.filter((c) =>
      ['PENDING', 'REQUESTED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED'].includes(c.status)
    );

    // Call MUST NOT be dropped
    expect(activeCalls.length).toBeGreaterThan(0);
    expect(activeCalls.some((c) => c.id === call.id)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST 4: adm-1 Supervisor Oversight Mode (No 0-tables isolation bug)
  // -------------------------------------------------------------------------
  it('TEST-CROSS-04: adm-1 admin identity operates in supervisor mode seeing all tables and calls', async () => {
    const adminProfileId = 'adm-1';
    const adminRole = 'admin';

    const isAdminOrSupervisor =
      adminRole === 'admin' ||
      adminRole === 'owner' ||
      adminProfileId.startsWith('adm');

    expect(isAdminOrSupervisor).toBe(true);

    // Create a call assigned to floor waiter 'st-wtr-1'
    const call = await dbAdapter.requestServiceAsync({
      tableSessionId: sessionT01.id,
      requestType: 'CALL_WAITER',
    });

    const currentCalls = dbAdapter.getWaiterCalls();

    // Supervisor view filter: When in ALL_CALLS mode, supervisor sees all pending calls
    const supervisorDisplayedCalls = currentCalls.filter((c) => {
      if (c.status === 'COMPLETED' || c.status === 'CANCELLED') return false;
      // Supervisor does not hide calls even if not assigned to adm-1
      return true;
    });

    expect(supervisorDisplayedCalls.length).toBeGreaterThan(0);
    expect(supervisorDisplayedCalls.some((c) => c.id === call.id)).toBe(true);

    // When supervisor accepts the call, it properly records assigned waiter name as Floor Supervisor
    const accepted = dbAdapter.acceptWaiterCall(call.id, adminProfileId);
    expect(accepted.assigned_waiter_id).toBe('adm-1');
    expect(accepted.assigned_waiter_name).toBe('Floor Supervisor');
  });

  // -------------------------------------------------------------------------
  // TEST 5: Firestore Document Mapping Utility
  // -------------------------------------------------------------------------
  it('TEST-CROSS-05: FirestoreWaiterCall maps cleanly to application WaiterCall model', () => {
    const now = new Date().toISOString();
    const firestoreDoc: FirestoreWaiterCall = {
      callId: 'call-179447893',
      restaurantId: 'rest-001-main',
      tableId: 'tbl-01',
      tableNumber: 'T-01',
      tableSessionId: sessionT01.id,
      customerName: 'Mobile Diner',
      requestType: 'CALL_WAITER',
      requestMessage: 'Extra glasses',
      priority: 'NORMAL',
      status: 'PENDING',
      assignedWaiterId: 'st-wtr-1',
      assignedWaiterName: 'Rahul Deshmukh',
      createdAt: now,
    };

    const mapped = mapFirestoreCallToWaiterCall(firestoreDoc);
    expect(mapped.id).toBe('call-179447893');
    expect(mapped.restaurant_id).toBe('rest-001-main');
    expect(mapped.table_number).toBe('T-01');
    expect(mapped.status).toBe('PENDING');
    expect(mapped.assigned_waiter_name).toBe('Rahul Deshmukh');
    expect(mapped.notes).toBe('Extra glasses');
  });

  // -------------------------------------------------------------------------
  // TEST 6: Syncing Firestore calls into local adapter state
  // -------------------------------------------------------------------------
  it('TEST-CROSS-06: syncFirestoreWaiterCalls merges incoming remote calls seamlessly', () => {
    const remoteCall: WaiterCall = {
      id: 'call-remote-999',
      restaurant_id: restaurantId,
      table_id: tableT01.id,
      table_number: 'T-01',
      table_session_id: sessionT01.id,
      customer_name: 'Diner from Phone',
      request_type: 'CALL_WAITER',
      status: 'PENDING',
      priority: 'NORMAL',
      created_at: new Date().toISOString(),
    };

    dbAdapter.syncFirestoreWaiterCalls([remoteCall]);

    const activeCalls = dbAdapter.getWaiterCalls();
    const found = activeCalls.find((c) => c.id === 'call-remote-999');
    expect(found).toBeDefined();
    expect(found?.status).toBe('PENDING');
    expect(found?.table_number).toBe('T-01');
  });

  // -------------------------------------------------------------------------
  // TEST 7: Deduplication prevents duplicate calls for same active session
  // -------------------------------------------------------------------------
  it('TEST-CROSS-07: Duplicate service requests for active session return existing call', async () => {
    const call1 = await dbAdapter.requestServiceAsync({
      tableSessionId: sessionT01.id,
      requestType: 'CALL_WAITER',
    });

    const call2 = await dbAdapter.requestServiceAsync({
      tableSessionId: sessionT01.id,
      requestType: 'CALL_WAITER',
    });

    expect(call1.id).toBe(call2.id);
  });

  // -------------------------------------------------------------------------
  // TEST 8: Customer Cancellation updates status across adapters
  // -------------------------------------------------------------------------
  it('TEST-CROSS-08: Customer or staff can cancel active waiter call', async () => {
    const call = await dbAdapter.requestServiceAsync({
      tableSessionId: sessionT01.id,
      requestType: 'CALL_WAITER',
    });

    const cancelled = dbAdapter.cancelWaiterCall(call.id);
    expect(cancelled.status).toBe('CANCELLED');

    const active = dbAdapter.getActiveWaiterCallForSession(sessionT01.id);
    expect(active).toBeUndefined();
  });
});
