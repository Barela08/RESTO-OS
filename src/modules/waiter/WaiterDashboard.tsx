import React, { useState, useEffect } from 'react';
import { dbAdapter } from '../../services/databaseAdapter';
import {
  RestaurantTable,
  Order,
  WaiterCall,
  KitchenTicket,
  LoyaltyReward,
  Customer,
  TableStatus,
} from '../../types';
import { StaffLayout } from '../../components/layout/StaffLayout';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { TableStatusBadge, OrderStatusBadge } from '../../components/ui/Badge';
import { formatTime, formatDate } from '../../utils/date';
import { formatCurrency } from '../../utils/currency';
import {
  Bell,
  UtensilsCrossed,
  CheckCircle2,
  Clock,
  Gift,
  Eye,
  User,
  Filter,
  Check,
  Phone,
  Layers,
  Sparkles,
  AlertCircle,
  Brush,
} from 'lucide-react';

export const WaiterDashboard: React.FC = () => {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  const [readyTickets, setReadyTickets] = useState<KitchenTicket[]>([]);

  // Current logged in waiter
  const currentWaiterId = 'st-wtr-1';

  // Navigation & Filtering State
  const [activeTab, setActiveTab] = useState<'ALL' | 'FOOD_TABLES' | 'READY_AT_PASS' | 'SERVICE_CALLS' | 'REWARDS'>('ALL');
  const [tableFilter, setTableFilter] = useState<'MY_ASSIGNED' | 'ALL'>('MY_ASSIGNED');

  // Interactive Table Action Modal
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);

  // Reward code verification state
  const [rewardCodeInput, setRewardCodeInput] = useState<string>('');
  const [verifiedReward, setVerifiedReward] = useState<{
    valid: boolean;
    reward?: LoyaltyReward;
    customer?: Customer;
    message: string;
  } | null>(null);
  const [redemptionSuccessMsg, setRedemptionSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const updateState = () => {
      setTables([...dbAdapter.getTables()]);
      setOrders([...dbAdapter.getOrders()]);
      setWaiterCalls([...dbAdapter.getWaiterCalls()]);
      setReadyTickets(dbAdapter.getKitchenTickets().filter((t) => t.status === 'READY'));
    };
    updateState();
    return dbAdapter.subscribe(updateState);
  }, []);

  const activeCalls = waiterCalls.filter((c) => c.status === 'PENDING' || c.status === 'ACKNOWLEDGED' || c.status === 'IN_PROGRESS');
  const activeOrders = orders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');

  // Filtered tables by assignment
  const displayedTables = tables.filter((t) => {
    if (tableFilter === 'MY_ASSIGNED') {
      return t.current_waiter_id === currentWaiterId;
    }
    return true;
  });

  const handleAcknowledgeCall = (callId: string) => {
    dbAdapter.updateWaiterCallStatus(callId, 'ACKNOWLEDGED', currentWaiterId);
  };

  const handleOnTheWayCall = (callId: string) => {
    dbAdapter.updateWaiterCallStatus(callId, 'IN_PROGRESS', currentWaiterId);
  };

  const handleCompleteCall = (callId: string) => {
    dbAdapter.updateWaiterCallStatus(callId, 'COMPLETED', currentWaiterId);
  };

  const handleMarkServed = (orderId: string) => {
    dbAdapter.markOrderServed(orderId);
  };

  const handleClaimTableAssignment = (tableId: string) => {
    dbAdapter.updateTable(tableId, { current_waiter_id: currentWaiterId });
    if (selectedTable && selectedTable.id === tableId) {
      setSelectedTable({ ...selectedTable, current_waiter_id: currentWaiterId });
    }
  };

  const handleUpdateTableStatus = (tableId: string, status: TableStatus) => {
    dbAdapter.updateTable(tableId, { status });
    if (selectedTable && selectedTable.id === tableId) {
      setSelectedTable({ ...selectedTable, status });
    }
  };

  const handleVerifyReward = () => {
    if (!rewardCodeInput.trim()) return;
    const res = dbAdapter.verifyRewardCode(rewardCodeInput.trim());
    setVerifiedReward(res);
    setRedemptionSuccessMsg(null);
  };

  const handleRedeemReward = () => {
    if (!rewardCodeInput.trim()) return;
    try {
      const res = dbAdapter.redeemRewardCode({
        redemptionCode: rewardCodeInput.trim(),
        staffId: currentWaiterId,
      });
      setRedemptionSuccessMsg(`Reward "${res.reward.title}" successfully redeemed!`);
      setVerifiedReward(null);
      setRewardCodeInput('');
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to redeem reward.');
    }
  };

  // Selected table helper variables
  const tableSession = selectedTable
    ? dbAdapter.getSessions().find((s) => s.table_id === selectedTable.id && s.status === 'ACTIVE')
    : null;

  const tableOrders = tableSession
    ? orders.filter((o) => o.table_session_id === tableSession.id && o.status !== 'CANCELLED' && o.status !== 'REJECTED')
    : [];

  const tableCalls = selectedTable
    ? waiterCalls.filter((c) => c.table_id === selectedTable.id && c.status !== 'COMPLETED')
    : [];

  return (
    <StaffLayout
      title="Waiter Station & Captain Desk"
      subtitle="Floor Service, Table Assistance & Food Orders"
      activeRole="waiter"
    >
      <div className="space-y-6">
        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800 text-xs font-semibold no-scrollbar">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'ALL'
                ? 'bg-brand-orange text-white font-extrabold shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Station Feed</span>
          </button>

          <button
            onClick={() => setActiveTab('FOOD_TABLES')}
            className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'FOOD_TABLES'
                ? 'bg-brand-orange text-white font-extrabold shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>Food Tables ({displayedTables.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('READY_AT_PASS')}
            className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'READY_AT_PASS'
                ? 'bg-brand-orange text-white font-extrabold shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
            <span>Ready at Pass ({readyTickets.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('SERVICE_CALLS')}
            className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'SERVICE_CALLS'
                ? 'bg-brand-orange text-white font-extrabold shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span>Service Calls ({activeCalls.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('REWARDS')}
            className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'REWARDS'
                ? 'bg-brand-orange text-white font-extrabold shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Gift className="w-3.5 h-3.5 text-purple-400" />
            <span>Reward Verification</span>
          </button>
        </div>

        {/* 1. URGENT SERVICE CALLS FROM CUSTOMERS */}
        {(activeTab === 'ALL' || activeTab === 'SERVICE_CALLS') && activeCalls.length > 0 && (
          <div className="bg-amber-950/40 border border-amber-500/50 rounded-2xl p-4 shadow-lg animate-pulse-subtle">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-5 h-5 text-amber-400 animate-bounce" />
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-amber-300">
                Active Table Service Calls ({activeCalls.length})
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeCalls.map((call) => (
                <div
                  key={call.id}
                  className="bg-slate-900 border border-amber-500/40 rounded-xl p-3.5 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-extrabold text-xs">
                        Table {call.table_number}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          call.status === 'IN_PROGRESS'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : call.status === 'ACKNOWLEDGED'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {call.status === 'IN_PROGRESS'
                          ? 'ON THE WAY'
                          : call.status === 'ACKNOWLEDGED'
                          ? 'ACCEPTED'
                          : 'NEW'}
                      </span>
                    </div>
                    <h5 className="font-bold text-white text-xs mt-1">
                      {call.request_type.replace('_', ' ')}
                    </h5>
                    {call.notes && <p className="text-[11px] text-amber-200 mt-0.5">"{call.notes}"</p>}
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Requested at {formatTime(call.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {call.status === 'PENDING' && (
                      <Button
                        size="sm"
                        variant="orange"
                        className="text-xs py-1"
                        onClick={() => handleAcknowledgeCall(call.id)}
                      >
                        Accept
                      </Button>
                    )}
                    {(call.status === 'PENDING' || call.status === 'ACKNOWLEDGED') && (
                      <Button
                        size="sm"
                        className="text-xs py-1 bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => handleOnTheWayCall(call.id)}
                      >
                        On The Way
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="success"
                      className="text-xs py-1"
                      onClick={() => handleCompleteCall(call.id)}
                    >
                      Done
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. READY TO SERVE FROM KITCHEN */}
        {(activeTab === 'ALL' || activeTab === 'READY_AT_PASS') && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-card">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-green-400">
                  Dishes Ready to Serve at Pass ({readyTickets.length})
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">Deliver to Dining Table</span>
            </div>

            {readyTickets.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                <UtensilsCrossed className="w-8 h-8 mx-auto mb-1 opacity-30" />
                <span>No food currently waiting at kitchen pass.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {readyTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="bg-[#161F30] border border-green-500/40 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded bg-green-500/20 text-green-300 font-extrabold text-xs">
                        Table {ticket.table_number}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {ticket.station?.name}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      {ticket.items.map((i) => (
                        <p key={i.id} className="font-bold text-white">
                          <span className="text-green-400 font-extrabold mr-1">{i.quantity}x</span>
                          {i.item_name}
                        </p>
                      ))}
                    </div>

                    <Button
                      size="sm"
                      variant="success"
                      className="w-full text-xs"
                      onClick={() => handleMarkServed(ticket.order_id)}
                    >
                      Mark Food Served to Table
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. FOOD TABLES & FLOOR MANAGEMENT (PRIMARY TABLE ACTION SECTION) */}
        {(activeTab === 'ALL' || activeTab === 'FOOD_TABLES') && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-white flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-brand-orange" />
                  <span>Food Tables & Assigned Floor Overview</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Click any table card to inspect active orders, customer details, or mark service completed.
                </p>
              </div>

              {/* Table Scope Filter */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setTableFilter('MY_ASSIGNED')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    tableFilter === 'MY_ASSIGNED'
                      ? 'bg-brand-orange text-white font-extrabold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  My Assigned Tables
                </button>
                <button
                  type="button"
                  onClick={() => setTableFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    tableFilter === 'ALL'
                      ? 'bg-brand-orange text-white font-extrabold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Tables ({tables.length})
                </button>
              </div>
            </div>

            {displayedTables.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                <UtensilsCrossed className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No tables currently assigned to your waiter ID ({currentWaiterId}).</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 text-xs"
                  onClick={() => setTableFilter('ALL')}
                >
                  View All Floor Tables to Claim
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {displayedTables.map((table) => {
                  const tableSession = dbAdapter.getSessions().find(
                    (s) => s.table_id === table.id && s.status === 'ACTIVE'
                  );
                  const activeTableOrders = tableSession
                    ? orders.filter(
                        (o) =>
                          o.table_session_id === tableSession.id &&
                          o.status !== 'COMPLETED' &&
                          o.status !== 'CANCELLED' &&
                          o.status !== 'REJECTED'
                      )
                    : [];
                  const latestOrder = activeTableOrders[0];
                  const isAssignedToMe = table.current_waiter_id === currentWaiterId;

                  return (
                    <div
                      key={table.id}
                      onClick={() => setSelectedTable(table)}
                      className={`group relative p-4 rounded-2xl border transition-all cursor-pointer select-none space-y-3 ${
                        table.status === 'OCCUPIED'
                          ? 'bg-amber-950/20 border-amber-600/40 hover:border-amber-500 hover:bg-amber-950/30'
                          : table.status === 'PAYMENT_PENDING'
                          ? 'bg-orange-950/30 border-orange-500/60 hover:border-orange-400 hover:bg-orange-950/40'
                          : table.status === 'CLEANING'
                          ? 'bg-purple-950/20 border-purple-600/40 hover:border-purple-500 hover:bg-purple-950/30'
                          : 'bg-[#161F30] border-slate-800 hover:border-slate-700 hover:bg-[#1a253a]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-white text-base">
                            Table {table.table_number}
                          </span>
                          {isAssignedToMe ? (
                            <span className="px-1.5 py-0.5 rounded bg-brand-orange/20 text-brand-orange text-[9px] font-extrabold uppercase">
                              My Table
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[9px] font-mono">
                              Other
                            </span>
                          )}
                        </div>
                        <TableStatusBadge status={table.status} />
                      </div>

                      <div className="text-[11px] text-slate-400 space-y-0.5">
                        <p>{table.floor_area}</p>
                        <p>{table.seating_capacity} Seater Capacity</p>
                      </div>

                      {latestOrder ? (
                        <div className="pt-2 border-t border-slate-800 text-[10px] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Order:</span>
                            <strong className="text-brand-orange font-mono">
                              {latestOrder.order_number}
                            </strong>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Status:</span>
                            <OrderStatusBadge status={latestOrder.status} />
                          </div>
                          <p className="text-slate-400 text-[10px] truncate">
                            {latestOrder.items.map((i) => `${i.quantity}x ${i.item_name}`).join(', ')}
                          </p>
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500">
                          {table.status === 'AVAILABLE' ? 'Table Ready for Guests' : 'No Active Food Orders'}
                        </div>
                      )}

                      <div className="pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs py-1.5 border-slate-700 text-slate-200 group-hover:border-brand-orange group-hover:text-white"
                          leftIcon={<Eye className="w-3.5 h-3.5 text-brand-orange" />}
                        >
                          View Table & Orders
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 4. REWARD REDEMPTION DESK */}
        {(activeTab === 'ALL' || activeTab === 'REWARDS') && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-card">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-brand-orange" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-white">
                  Table Reward Verification
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">Verify Customer Vouchers</span>
            </div>

            <div className="flex items-center gap-2 max-w-lg">
              <input
                type="text"
                placeholder="e.g. CLM-8492-KW39"
                value={rewardCodeInput}
                onChange={(e) => setRewardCodeInput(e.target.value.toUpperCase())}
                className="p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold text-xs flex-1 uppercase focus:outline-none focus:border-brand-orange"
              />
              <Button size="sm" variant="orange" onClick={handleVerifyReward}>
                Verify
              </Button>
            </div>

            {verifiedReward && (
              <div className="mt-3 p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-2 max-w-lg">
                {verifiedReward.valid ? (
                  <>
                    <div className="flex items-center justify-between">
                      <strong className="text-white text-sm">{verifiedReward.reward?.title}</strong>
                      <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 font-bold text-[10px]">
                        ELIGIBLE
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs">
                      Customer: <strong className="text-white">{verifiedReward.customer?.full_name}</strong>
                    </p>
                    <Button size="sm" variant="success" className="w-full text-xs" onClick={handleRedeemReward}>
                      Confirm Voucher Redemption
                    </Button>
                  </>
                ) : (
                  <p className="text-red-400">{verifiedReward.message}</p>
                )}
              </div>
            )}

            {redemptionSuccessMsg && (
              <p className="mt-2 text-xs font-bold text-green-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span>{redemptionSuccessMsg}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* INTERACTIVE TABLE ACTION & SERVICE MODAL                       */}
      {/* ============================================================== */}
      <Modal
        isOpen={Boolean(selectedTable)}
        onClose={() => setSelectedTable(null)}
        title={selectedTable ? `Table ${selectedTable.table_number} Service Details` : ''}
        description={selectedTable ? `${selectedTable.floor_area} • ${selectedTable.seating_capacity} Seater` : ''}
      >
        {selectedTable && (
          <div className="space-y-4 text-xs">
            {/* Table Meta Bar */}
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-2">
                <TableStatusBadge status={selectedTable.status} />
                <span className="text-slate-400">
                  Waiter:{' '}
                  <strong className="text-white">
                    {selectedTable.current_waiter_id === currentWaiterId
                      ? 'Assigned to You'
                      : selectedTable.current_waiter_id || 'Unassigned'}
                  </strong>
                </span>
              </div>
              {selectedTable.current_waiter_id !== currentWaiterId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-[11px] py-1 border-brand-orange text-brand-orange"
                  onClick={() => handleClaimTableAssignment(selectedTable.id)}
                >
                  Assign to Me
                </Button>
              )}
            </div>

            {/* Active Table Session */}
            {tableSession ? (
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-brand-orange" />
                    <span>Customer Session Active</span>
                  </span>
                  <span className="font-mono text-[10px]">
                    Opened {formatTime(tableSession.opened_at)}
                  </span>
                </div>
                {tableSession.customer_name && (
                  <p className="text-slate-300">
                    Guest Name: <strong className="text-white">{tableSession.customer_name}</strong>
                    {tableSession.customer_phone && ` (${tableSession.customer_phone})`}
                  </p>
                )}
              </div>
            ) : (
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-slate-500 text-center">
                No active dining session established on Table {selectedTable.table_number}.
              </div>
            )}

            {/* Orders for this Table */}
            <div className="space-y-2">
              <h5 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                Orders on Table ({tableOrders.length})
              </h5>

              {tableOrders.length === 0 ? (
                <p className="text-slate-500 italic p-3 bg-slate-950 rounded-xl border border-slate-800">
                  No food orders placed on this table yet.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {tableOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-brand-orange font-mono">{ord.order_number}</strong>
                        <OrderStatusBadge status={ord.status} />
                      </div>
                      <div className="space-y-1">
                        {ord.items.map((i) => (
                          <div key={i.id} className="flex justify-between text-slate-300">
                            <span>
                              {i.quantity}x {i.item_name}
                            </span>
                            <span className="font-mono">{formatCurrency(i.total_price)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800 font-bold">
                        <span className="text-slate-400">Total:</span>
                        <span className="text-green-400 font-mono">
                          {formatCurrency(ord.total_amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Service Requests for this Table */}
            {tableCalls.length > 0 && (
              <div className="p-3 bg-amber-950/30 rounded-2xl border border-amber-600/40 space-y-2">
                <h5 className="font-bold text-amber-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5" />
                  <span>Pending Customer Requests</span>
                </h5>
                {tableCalls.map((call) => (
                  <div key={call.id} className="flex items-center justify-between text-xs">
                    <div>
                      <strong className="text-white">{call.request_type.replace('_', ' ')}</strong>
                      {call.notes && <span className="text-slate-400 block text-[10px]">"{call.notes}"</span>}
                    </div>
                    <Button
                      size="sm"
                      variant="success"
                      className="py-1 text-[11px]"
                      onClick={() => handleCompleteCall(call.id)}
                    >
                      Mark Resolved
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Waiter Quick Actions */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <h5 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                Waiter Table Operations
              </h5>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  className="text-xs"
                  onClick={() => {
                    tableOrders.forEach((o) => {
                      if (o.status === 'READY') handleMarkServed(o.id);
                    });
                    alert(`Marked food delivered for Table ${selectedTable.table_number}.`);
                  }}
                >
                  Mark Food Served
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs border-purple-800 text-purple-300 hover:bg-purple-950/60"
                  leftIcon={<Brush className="w-3 h-3" />}
                  onClick={() => {
                    handleUpdateTableStatus(selectedTable.id, 'AVAILABLE');
                    alert(`Table ${selectedTable.table_number} is now marked Cleaned & Available.`);
                  }}
                >
                  Mark Clean & Ready
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </StaffLayout>
  );
};
