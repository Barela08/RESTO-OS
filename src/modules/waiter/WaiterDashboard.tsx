import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { dbAdapter } from '../../services/databaseAdapter';
import { audioService } from '../../services/audioService';
import { voiceAnnouncementService } from '../../services/voiceAnnouncementService';
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
  Volume2,
  VolumeX,
  Mic,
  Settings,
  Radio,
  Sliders,
} from 'lucide-react';

export const WaiterDashboard: React.FC = () => {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  const [readyTickets, setReadyTickets] = useState<KitchenTicket[]>([]);

  // Current authenticated waiter identity
  const { currentProfile } = useAuthStore();
  const currentWaiterId = currentProfile?.id || 'st-wtr-1';

  // Navigation & Filtering State
  const [activeTab, setActiveTab] = useState<'ALL' | 'FOOD_TABLES' | 'READY_AT_PASS' | 'SERVICE_CALLS' | 'REWARDS'>('ALL');
  const [tableFilter, setTableFilter] = useState<'MY_ASSIGNED' | 'ALL'>('MY_ASSIGNED');
  const [callFilter, setCallFilter] = useState<'MY_CALLS' | 'ALL_CALLS'>('MY_CALLS');

  // Interactive Table Action Modal
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);

  // Sound and Voice Settings Modal
  const [isAlertSettingsOpen, setIsAlertSettingsOpen] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState(dbAdapter.getVoiceSettings());
  const [soundVolume, setSoundVolume] = useState(audioService.getVolume());
  const [isMuted, setIsMuted] = useState(audioService.getIsMuted());

  // Reward code verification state
  const [rewardCodeInput, setRewardCodeInput] = useState<string>('');
  const [verifiedReward, setVerifiedReward] = useState<{
    valid: boolean;
    reward?: LoyaltyReward;
    customer?: Customer;
    message: string;
  } | null>(null);
  const [redemptionSuccessMsg, setRedemptionSuccessMsg] = useState<string | null>(null);

  // Set of call IDs already announced to prevent duplicate audio/voice on re-renders
  const notifiedCallIdsRef = useRef<Set<string>>(new Set());
  const initialMountTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    const updateState = () => {
      setTables([...dbAdapter.getTables()]);
      setOrders([...dbAdapter.getOrders()]);
      setWaiterCalls([...dbAdapter.getWaiterCalls()]);
      setReadyTickets(dbAdapter.getKitchenTickets().filter((t) => t.status === 'READY'));
      setVoiceSettings(dbAdapter.getVoiceSettings());
    };
    updateState();
    return dbAdapter.subscribe(updateState);
  }, []);

  // Periodic automatic escalation check
  useEffect(() => {
    const interval = setInterval(() => {
      dbAdapter.checkAndEscalateWaiterCalls();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Realtime audio chime and voice announcement listener
  useEffect(() => {
    const myNewCalls = waiterCalls.filter((c) => {
      const isMyCall = c.assigned_waiter_id === currentWaiterId || !c.assigned_waiter_id;
      const isNew = ['REQUESTED', 'SENT', 'PENDING'].includes(c.status);
      const isNotNotified = !notifiedCallIdsRef.current.has(c.id);
      const callTime = new Date(c.created_at).getTime();
      const isRecent = callTime >= initialMountTimeRef.current - 15000;
      return isMyCall && isNew && isNotNotified && isRecent;
    });

    if (myNewCalls.length > 0) {
      myNewCalls.forEach((call) => {
        notifiedCallIdsRef.current.add(call.id);
        // Play notification bell
        audioService.playWaiterCallBell();
        // Play voice announcement
        voiceAnnouncementService.announceEvent(
          {
            id: `ev-${call.id}`,
            restaurant_id: call.restaurant_id,
            event_type: 'CALL_WAITER',
            reference_id: call.id,
            event_payload: {
              table_number: call.table_number,
              table_id: call.table_id,
              waiter_id: call.assigned_waiter_id,
              call_id: call.id,
              notes: call.notes,
            },
            created_at: call.created_at,
          },
          dbAdapter.getVoiceSettings()
        );
      });
    }
  }, [waiterCalls]);

  const displayedCalls = waiterCalls.filter((c) => {
    if (c.status === 'COMPLETED' || c.status === 'CANCELLED') return false;
    if (callFilter === 'MY_CALLS') {
      return c.assigned_waiter_id === currentWaiterId || !c.assigned_waiter_id;
    }
    return true;
  });

  const activeOrders = orders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');

  // Filtered tables by assignment
  const displayedTables = tables.filter((t) => {
    if (tableFilter === 'MY_ASSIGNED') {
      return t.current_waiter_id === currentWaiterId;
    }
    return true;
  });

  const handleAcceptCall = (callId: string) => {
    dbAdapter.acceptWaiterCall(callId, currentWaiterId);
  };

  const handleOnTheWayCall = (callId: string) => {
    dbAdapter.markWaiterCallOnTheWay(callId, currentWaiterId);
  };

  const handleArrivedCall = (callId: string) => {
    dbAdapter.markWaiterCallArrived(callId, currentWaiterId);
  };

  const handleCompleteCall = (callId: string) => {
    dbAdapter.completeWaiterCall(callId, currentWaiterId);
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

  const handleToggleSound = () => {
    const next = !isMuted;
    audioService.setMuted(next);
    setIsMuted(next);
  };

  const handleToggleVoice = () => {
    const next = !voiceSettings.voice_enabled;
    const updated = dbAdapter.updateVoiceSettings({ voice_enabled: next });
    setVoiceSettings(updated);
  };

  const handleChangeLanguage = (lang: 'hi' | 'en') => {
    const updated = dbAdapter.updateVoiceSettings({ language: lang });
    setVoiceSettings(updated);
  };

  const handleChangeVolume = (vol: number) => {
    audioService.setVolume(vol);
    setSoundVolume(vol);
    const updated = dbAdapter.updateVoiceSettings({ volume: vol });
    setVoiceSettings(updated);
  };

  const handleChangeSpeechRate = (rate: number) => {
    const updated = dbAdapter.updateVoiceSettings({ speech_rate: rate });
    setVoiceSettings(updated);
  };

  const handleTestAlertSound = () => {
    audioService.playWaiterCallBell();
  };

  const handleTestVoice = () => {
    voiceAnnouncementService.testSpeech(undefined, voiceSettings.language, voiceSettings.volume, voiceSettings.speech_rate);
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
      actions={
        <button
          onClick={() => setIsAlertSettingsOpen(true)}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-colors border border-slate-700"
          title="Notification & Sound Alert Settings"
        >
          <Sliders className="w-3.5 h-3.5 text-brand-orange" />
          <span className="hidden sm:inline font-semibold text-[11px]">Alert Settings</span>
        </button>
      }
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
            <span>Service Calls ({displayedCalls.length})</span>
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
        {(activeTab === 'ALL' || activeTab === 'SERVICE_CALLS') && displayedCalls.length > 0 && (
          <div className="bg-amber-950/40 border-2 border-amber-500/60 rounded-3xl p-5 shadow-elevated animate-pulse-subtle">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-amber-500/30">
              <div className="flex items-center gap-2.5">
                <Bell className="w-6 h-6 text-amber-400 animate-bounce" />
                <div>
                  <h3 className="font-black text-base uppercase tracking-wider text-amber-300">
                    Active Table Service Calls ({displayedCalls.length})
                  </h3>
                  <p className="text-xs text-amber-200/80">Real-time alerts with sound chime and voice announcements</p>
                </div>
              </div>

              {/* Calls Filter Toggle */}
              <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-amber-500/30 text-xs">
                <button
                  onClick={() => setCallFilter('MY_CALLS')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    callFilter === 'MY_CALLS'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  My Tables
                </button>
                <button
                  onClick={() => setCallFilter('ALL_CALLS')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    callFilter === 'ALL_CALLS'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Tables ({waiterCalls.filter(c => c.status !== 'COMPLETED' && c.status !== 'CANCELLED').length})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {displayedCalls.map((call) => {
                const cleanTableNumber = call.table_number.replace(/^T-?/i, '');
                return (
                  <div
                    key={call.id}
                    className="bg-slate-900 border-2 border-amber-500/60 rounded-2xl p-4 sm:p-5 shadow-card space-y-3"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0">
                          <Bell className="w-4 h-4 animate-bounce" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest bg-amber-400 text-slate-950 px-2 py-0.5 rounded font-mono">
                              NEW WAITER CALL
                            </span>
                            {call.priority === 'URGENT' && (
                              <span className="text-[10px] font-black uppercase tracking-widest bg-red-600 text-white px-2 py-0.5 rounded animate-pulse">
                                URGENT
                              </span>
                            )}
                            {call.is_escalated && (
                              <span className="text-[10px] font-black uppercase tracking-widest bg-orange-600 text-white px-2 py-0.5 rounded">
                                ESCALATED
                              </span>
                            )}
                          </div>
                          <h4 className="text-base font-black text-white mt-1">
                            Table Number: {cleanTableNumber}
                          </h4>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-lg border ${
                          call.status === 'ARRIVED'
                            ? 'bg-green-500/20 text-green-300 border-green-500/30'
                            : call.status === 'ON_THE_WAY' || call.status === 'IN_PROGRESS'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                            : call.status === 'ACCEPTED' || call.status === 'ACKNOWLEDGED'
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
                        }`}
                      >
                        {call.status === 'IN_PROGRESS'
                          ? 'ON THE WAY'
                          : call.status === 'ACKNOWLEDGED'
                          ? 'ACCEPTED'
                          : call.status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Notification Message */}
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
                      <p className="text-amber-300 font-bold">
                        "A customer at Table Number {cleanTableNumber} is requesting assistance."
                      </p>
                      {call.notes && (
                        <p className="text-slate-300 mt-1.5 text-[11px] bg-slate-900 p-2 rounded border border-slate-800">
                          <strong className="text-slate-400">Customer Request:</strong> "{call.notes}"
                        </p>
                      )}
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/80">
                      <div>
                        <span className="text-[9px] text-slate-500 font-semibold block uppercase">Call ID</span>
                        <span className="font-mono text-slate-300 text-[10px] font-bold">{call.id.slice(0, 14)}...</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 font-semibold block uppercase">Call Time</span>
                        <span className="text-slate-300 font-medium">{formatTime(call.created_at)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 font-semibold block uppercase">Customer</span>
                        <span className="text-slate-300 font-bold">{call.customer_name || 'Dining Guest'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 font-semibold block uppercase">Assigned Waiter</span>
                        <span className="text-brand-orange font-bold">{call.assigned_waiter_name || call.assigned_waiter_id || 'Server'}</span>
                      </div>
                    </div>

                    {/* Action Workflow Buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                      {['REQUESTED', 'SENT', 'PENDING'].includes(call.status) && (
                        <Button
                          size="sm"
                          variant="orange"
                          className="text-xs py-1.5 px-3.5 font-bold"
                          onClick={() => handleAcceptCall(call.id)}
                        >
                          Accept Call
                        </Button>
                      )}
                      {['ACCEPTED', 'ACKNOWLEDGED'].includes(call.status) && (
                        <Button
                          size="sm"
                          className="text-xs py-1.5 px-3.5 font-bold bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => handleOnTheWayCall(call.id)}
                        >
                          On The Way
                        </Button>
                      )}
                      {['ON_THE_WAY', 'IN_PROGRESS'].includes(call.status) && (
                        <Button
                          size="sm"
                          className="text-xs py-1.5 px-3.5 font-bold bg-purple-600 hover:bg-purple-700 text-white"
                          onClick={() => handleArrivedCall(call.id)}
                        >
                          Arrived at Table
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="success"
                        className="text-xs py-1.5 px-3.5 font-bold"
                        onClick={() => handleCompleteCall(call.id)}
                      >
                        Complete Request
                      </Button>
                    </div>
                  </div>
                );
              })}
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

      {/* Sound & Voice Alert Settings Modal */}
      <Modal
        isOpen={isAlertSettingsOpen}
        onClose={() => setIsAlertSettingsOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            <span>Sound Alert & Voice Settings</span>
          </div>
        }
        maxWidth="lg"
      >
        <div className="space-y-5 text-sm">
          {/* Sound Notification Alert Section */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isMuted ? (
                  <VolumeX className="w-5 h-5 text-red-400" />
                ) : (
                  <Volume2 className="w-5 h-5 text-green-400" />
                )}
                <div>
                  <h4 className="font-bold text-white text-sm">Instant Sound Chime</h4>
                  <p className="text-xs text-slate-400">Harmonic dual-tone alert on new waiter calls</p>
                </div>
              </div>
              <button
                onClick={handleToggleSound}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  isMuted
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30'
                    : 'bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30'
                }`}
              >
                {isMuted ? 'Muted (Click to Unmute)' : 'Active (Audible)'}
              </button>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1 font-semibold">
                <span>Chime Volume</span>
                <span>{Math.round(soundVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={soundVolume}
                disabled={isMuted}
                onChange={(e) => handleChangeVolume(parseFloat(e.target.value))}
                className="w-full accent-amber-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <Button
                size="sm"
                variant="outline"
                className="text-xs border-amber-600/40 text-amber-300 hover:bg-amber-950/40"
                onClick={handleTestAlertSound}
              >
                <Bell className="w-3.5 h-3.5 mr-1" />
                Test Alert Sound
              </Button>
              {isMuted && (
                <span className="text-[11px] text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Visual alerts still active when muted
                </span>
              )}
            </div>
          </div>

          {/* Voice Announcement Section */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="w-5 h-5 text-indigo-400" />
                <div>
                  <h4 className="font-bold text-white text-sm">Spoken Voice Announcement</h4>
                  <p className="text-xs text-slate-400">Natural SpeechSynthesis identifying exact table number</p>
                </div>
              </div>
              <button
                onClick={handleToggleVoice}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  voiceSettings.voice_enabled
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                }`}
              >
                {voiceSettings.voice_enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            {voiceSettings.voice_enabled && (
              <>
                {/* Language Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Announcement Language
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleChangeLanguage('hi')}
                      className={`p-2 rounded-lg text-xs font-bold text-center border transition-all ${
                        voiceSettings.language === 'hi'
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      हिंदी (Hindi)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChangeLanguage('en')}
                      className={`p-2 rounded-lg text-xs font-bold text-center border transition-all ${
                        voiceSettings.language === 'en'
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      English
                    </button>
                  </div>
                </div>

                {/* Speech Rate Slider */}
                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1 font-semibold">
                    <span>Speech Rate (Pacing)</span>
                    <span>{voiceSettings.speech_rate || 1.0}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.7"
                    max="1.4"
                    step="0.05"
                    value={voiceSettings.speech_rate || 1.0}
                    onChange={(e) => handleChangeSpeechRate(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Numerical Table Identification Note */}
                <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-800/40 text-[11px] text-indigo-200">
                  <span className="font-bold">Natural Table Pronunciation:</span> Table prefixes are automatically cleaned (e.g. "Table Number 10") so the voice engine announces clearly in natural numerals.
                </div>

                {/* Test Voice Button */}
                <div className="pt-1 flex items-center justify-between">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs border-indigo-600/40 text-indigo-300 hover:bg-indigo-950/40"
                    onClick={handleTestVoice}
                  >
                    <Mic className="w-3.5 h-3.5 mr-1" />
                    Test Voice Announcement
                  </Button>
                </div>
              </>
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAlertSettingsOpen(false)}
            >
              Done & Save
            </Button>
          </div>
        </div>
      </Modal>
    </StaffLayout>
  );
};
