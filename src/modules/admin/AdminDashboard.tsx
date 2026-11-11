import React, { useState, useEffect } from 'react';
import { dbAdapter } from '../../services/databaseAdapter';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { formatCurrency } from '../../utils/currency';
import { formatTime } from '../../utils/date';
import { TableStatusBadge, OrderStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { WaiterCall } from '../../types';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  ShoppingBag,
  UtensilsCrossed,
  ChefHat,
  Banknote,
  QrCode,
  AlertTriangle,
  ArrowRight,
  Clock,
  Sparkles,
  Bell,
  Users,
  CheckCircle2,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [tables, setTables] = useState(dbAdapter.getTables());
  const [orders, setOrders] = useState(dbAdapter.getOrders());
  const [payments, setPayments] = useState(dbAdapter.getPayments());
  const [tickets, setTickets] = useState(dbAdapter.getKitchenTickets());
  const [repeatScans, setRepeatScans] = useState(dbAdapter.getRepeatScanRequests());
  const [waiterCalls, setWaiterCalls] = useState(dbAdapter.getWaiterCalls());
  const [staffMembers, setStaffMembers] = useState(dbAdapter.getStaff());
  const [reassignModalCall, setReassignModalCall] = useState<WaiterCall | null>(null);
  const [selectedNewWaiterId, setSelectedNewWaiterId] = useState<string>('');

  useEffect(() => {
    const update = () => {
      setTables([...dbAdapter.getTables()]);
      setOrders([...dbAdapter.getOrders()]);
      setPayments([...dbAdapter.getPayments()]);
      setTickets([...dbAdapter.getKitchenTickets()]);
      setRepeatScans([...dbAdapter.getRepeatScanRequests()]);
      setWaiterCalls([...dbAdapter.getWaiterCalls()]);
      setStaffMembers([...dbAdapter.getStaff()]);
    };
    return dbAdapter.subscribe(update);
  }, []);

  const totalRevenue = payments
    .filter(p => p.payment_status === 'PAID')
    .reduce((sum, p) => sum + p.amount, 0);

  const availableTables = tables.filter(t => t.status === 'AVAILABLE').length;
  const occupiedTables = tables.filter(t => t.status === 'OCCUPIED').length;
  const paymentPendingTables = tables.filter(t => t.status === 'PAYMENT_PENDING').length;

  const kitchenPendingTickets = tickets.filter(t => t.status === 'NEW' || t.status === 'PREPARING').length;
  const readyTickets = tickets.filter(t => t.status === 'READY').length;

  const cashPayments = payments.filter(p => p.payment_method === 'CASH' && p.payment_status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
  const onlinePayments = payments.filter(p => p.payment_method !== 'CASH' && p.payment_status === 'PAID').reduce((sum, p) => sum + p.amount, 0);

  const pendingRepeatScans = repeatScans.filter(r => r.status === 'PENDING').length;

  const analytics = dbAdapter.getWaiterCallAnalytics();
  const activeCalls = waiterCalls.filter(c => c.status !== 'COMPLETED' && c.status !== 'CANCELLED');
  const waiterStaffList = staffMembers.filter(s => s.role === 'waiter' || s.role === 'admin' || s.role === 'owner');

  const handleReassign = (callId: string, newWaiterId: string) => {
    const staffMember = staffMembers.find(s => s.id === newWaiterId);
    dbAdapter.reassignWaiterCall(callId, newWaiterId, staffMember ? staffMember.name : undefined);
    setReassignModalCall(null);
    setSelectedNewWaiterId('');
  };

  const handleEscalate = (callId: string) => {
    dbAdapter.escalateWaiterCall(callId, 'Manager Manual Escalation');
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Operations Dashboard</h1>
            <p className="text-xs text-slate-500 mt-0.5">Real-time status across restaurant floor, kitchen and cash register</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/tables"
              className="px-3.5 py-2 bg-brand-purple hover:bg-brand-purple-hover text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Live Floor Management</span>
            </Link>
          </div>
        </div>

        {/* Top 4 KPI Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Today's Revenue</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-brand-purple flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-slate-900">{formatCurrency(totalRevenue)}</p>
            <p className="text-[11px] text-slate-500 mt-1">
              <span className="text-green-600 font-bold">Cash: {formatCurrency(cashPayments)}</span> • Online: {formatCurrency(onlinePayments)}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Tables</span>
              <div className="w-8 h-8 rounded-xl bg-orange-50 text-brand-orange flex items-center justify-center">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-slate-900">{occupiedTables} <span className="text-sm font-normal text-slate-400">/ {tables.length}</span></p>
            <p className="text-[11px] text-slate-500 mt-1">
              <span className="text-green-600 font-bold">{availableTables} Available</span> • {paymentPendingTables} Bill Pending
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Kitchen Tickets</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <ChefHat className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-slate-900">{kitchenPendingTickets} <span className="text-sm font-normal text-slate-400">active</span></p>
            <p className="text-[11px] text-slate-500 mt-1">
              <span className="text-green-600 font-bold">{readyTickets} Ready at pass</span>
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Daily QR Status</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <QrCode className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-slate-900">{tables.length} <span className="text-sm font-normal text-slate-400">active</span></p>
            <p className="text-[11px] text-slate-500 mt-1">
              {pendingRepeatScans > 0 ? (
                <span className="text-amber-600 font-bold">{pendingRepeatScans} Repeat Scans Pending</span>
              ) : (
                <span className="text-slate-400">Tokens valid till 11:59 PM</span>
              )}
            </p>
          </div>
        </div>

        {/* Live Restaurant Tables Floor Grid */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Restaurant Floor Status</h3>
              <p className="text-xs text-slate-500">Real-time table occupancies and session tracking</p>
            </div>
            <Link to="/admin/tables" className="text-xs font-bold text-brand-purple hover:underline flex items-center gap-1">
              <span>Manage Tables</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {tables.map((table) => {
              const activeOrder = orders.find(o => o.table_id === table.id && o.status !== 'COMPLETED' && o.status !== 'CANCELLED');

              return (
                <div
                  key={table.id}
                  className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-brand-purple hover:shadow-card transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-extrabold text-slate-900 text-base">{table.table_number}</span>
                    <TableStatusBadge status={table.status} />
                  </div>
                  <div className="text-[11px] text-slate-500 space-y-0.5">
                    <p>{table.floor_area}</p>
                    <p>{table.seating_capacity} Seater Capacity</p>
                  </div>
                  {activeOrder && (
                    <div className="mt-2 pt-2 border-t border-slate-200 text-[11px]">
                      <span className="text-slate-500">Order: </span>
                      <strong className="text-brand-orange font-mono">{activeOrder.order_number}</strong>
                      <p className="font-extrabold text-slate-900 mt-0.5">{formatCurrency(activeOrder.total_amount)}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Orders Overview */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Recent Dining Orders</h3>
              <p className="text-xs text-slate-500">Latest tickets placed through daily table QR codes</p>
            </div>
            <Link to="/counter" className="text-xs font-bold text-brand-purple hover:underline flex items-center gap-1">
              <span>Cash Counter View</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 font-semibold">
                  <th className="py-2.5 px-3">Order No</th>
                  <th className="py-2.5 px-3">Table</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Items</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.slice(0, 5).map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{order.order_number}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">Table {order.table?.table_number}</td>
                    <td className="py-2.5 px-3 text-slate-600">{order.customer_name || 'Guest'}</td>
                    <td className="py-2.5 px-3 text-slate-600">{order.items.length} items</td>
                    <td className="py-2.5 px-3 font-extrabold text-slate-900">{formatCurrency(order.total_amount)}</td>
                    <td className="py-2.5 px-3"><OrderStatusBadge status={order.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ============================================================== */}
        {/* WAITER CALLING & SERVICE ASSISTANCE REALTIME MONITORING       */}
        {/* ============================================================== */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Bell className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Waiter Calling & Floor Service Monitor
                </h3>
                {activeCalls.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                    {activeCalls.length} Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time tracking of table assistance calls, response latencies & staff performance
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Escalation Threshold:</span>
              <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">60s</span>
            </div>
          </div>

          {/* 7 KPI Operational Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Today</span>
              <p className="text-xl font-extrabold text-slate-900 mt-0.5">{analytics.totalCallsToday}</p>
            </div>

            <div className={`p-3 rounded-xl border ${analytics.pendingCalls > 0 ? 'bg-amber-50/70 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
              <span className="text-[10px] uppercase font-bold text-amber-700 block">Pending / Unattended</span>
              <p className={`text-xl font-extrabold mt-0.5 ${analytics.pendingCalls > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                {analytics.pendingCalls}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-blue-600 block">Accepted</span>
              <p className="text-xl font-extrabold text-blue-700 mt-0.5">{analytics.acceptedCalls}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-purple-600 block">On The Way</span>
              <p className="text-xl font-extrabold text-purple-700 mt-0.5">{analytics.onTheWayCalls}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-green-600 block">Completed</span>
              <p className="text-xl font-extrabold text-green-700 mt-0.5">{analytics.completedCalls}</p>
            </div>

            <div className={`p-3 rounded-xl border ${analytics.escalatedCalls > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
              <span className="text-[10px] uppercase font-bold text-red-600 block">Escalated</span>
              <p className={`text-xl font-extrabold mt-0.5 ${analytics.escalatedCalls > 0 ? 'text-red-700' : 'text-slate-900'}`}>
                {analytics.escalatedCalls}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-indigo-600 block">Avg Response</span>
              <p className="text-xl font-extrabold text-indigo-700 mt-0.5 font-mono">
                {analytics.avgResponseTimeSeconds > 0 ? `${analytics.avgResponseTimeSeconds}s` : '—'}
              </p>
            </div>
          </div>

          {/* Active Calls Table */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Active Customer Assistance Calls ({activeCalls.length})</span>
            </h4>

            {activeCalls.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2 opacity-80" />
                <p className="text-xs font-bold text-slate-700">All customer assistance calls resolved</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Floor service is fully up-to-date.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500 font-semibold bg-slate-50/50">
                      <th className="py-2.5 px-3">Call ID / Time</th>
                      <th className="py-2.5 px-3">Table</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Assigned Waiter</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Response</th>
                      <th className="py-2.5 px-3 text-right">Manager Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeCalls.map((call) => {
                      const cleanTable = call.table_number.replace(/^T-?/i, '');
                      return (
                        <tr key={call.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-mono">
                            <span className="font-bold text-slate-900 block">{call.id.slice(0, 12)}...</span>
                            <span className="text-[10px] text-slate-400">{formatTime(call.created_at)}</span>
                          </td>
                          <td className="py-2.5 px-3 font-extrabold text-slate-900">
                            Table {cleanTable}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-800 block">{call.customer_name || 'Guest'}</span>
                            {call.notes && (
                              <span className="text-[10px] text-slate-400 truncate max-w-[140px] block">
                                "{call.notes}"
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-brand-orange">
                            {call.assigned_waiter_name || call.assigned_waiter_id || 'Unassigned'}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                                  call.status === 'ARRIVED'
                                    ? 'bg-green-100 text-green-800'
                                    : call.status === 'ON_THE_WAY' || call.status === 'IN_PROGRESS'
                                    ? 'bg-purple-100 text-purple-800'
                                    : call.status === 'ACCEPTED' || call.status === 'ACKNOWLEDGED'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-amber-100 text-amber-800 animate-pulse'
                                }`}
                              >
                                {call.status.replace('_', ' ')}
                              </span>
                              {call.is_escalated && (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-red-600 text-white">
                                  ESCALATED
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-600">
                            {typeof call.response_time_seconds === 'number'
                              ? `${call.response_time_seconds}s`
                              : 'Pending'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-[11px] py-1 px-2.5 border-slate-300 hover:bg-slate-100"
                                onClick={() => {
                                  setReassignModalCall(call);
                                  setSelectedNewWaiterId(call.assigned_waiter_id || '');
                                }}
                              >
                                Reassign
                              </Button>
                              {!call.is_escalated && call.status !== 'COMPLETED' && (
                                <Button
                                  size="sm"
                                  className="text-[11px] py-1 px-2.5 bg-red-600 hover:bg-red-700 text-white font-bold"
                                  onClick={() => handleEscalate(call.id)}
                                >
                                  Escalate
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Waiter Staff Performance Breakdown */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-brand-purple" />
              <span>Waiter Performance & Assistance Response Times</span>
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 font-semibold bg-slate-50/50">
                    <th className="py-2 px-3">Staff / Waiter</th>
                    <th className="py-2 px-3">Total Calls</th>
                    <th className="py-2 px-3">Completed</th>
                    <th className="py-2 px-3">Completion Rate</th>
                    <th className="py-2 px-3">Avg Response Speed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics.waiterStats.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400">
                        No waiter activity recorded today yet.
                      </td>
                    </tr>
                  ) : (
                    analytics.waiterStats.map((stat) => {
                      const rate = stat.totalAssigned > 0
                        ? Math.round((stat.completed / stat.totalAssigned) * 100)
                        : 0;
                      return (
                        <tr key={stat.waiterId} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-bold text-slate-900">
                            {stat.waiterName}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-800">{stat.totalAssigned}</td>
                          <td className="py-2 px-3 font-semibold text-green-700">{stat.completed}</td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-700">{rate}%</td>
                          <td className="py-2 px-3 font-mono font-bold text-brand-purple">
                            {stat.avgResponseTimeSeconds > 0 ? `${stat.avgResponseTimeSeconds}s` : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Reassign Call Modal */}
      <Modal
        isOpen={!!reassignModalCall}
        onClose={() => setReassignModalCall(null)}
        title="Reassign Waiter Call"
        maxWidth="sm"
      >
        {reassignModalCall && (
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Select another floor waiter or manager to take over Table{' '}
              <strong className="text-slate-900">
                {reassignModalCall.table_number.replace(/^T-?/i, '')}
              </strong>
              .
            </p>

            <div>
              <label className="block text-slate-700 font-bold mb-1.5">Assign To Staff Member</label>
              <select
                value={selectedNewWaiterId}
                onChange={(e) => setSelectedNewWaiterId(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 text-xs focus:ring-2 focus:ring-brand-purple"
              >
                <option value="">-- Choose Floor Waiter --</option>
                {waiterStaffList.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name || st.profile?.full_name || 'Staff'} ({(st.role || st.profile?.role_id || 'waiter').toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReassignModalCall(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={!selectedNewWaiterId}
                onClick={() => handleReassign(reassignModalCall.id, selectedNewWaiterId)}
              >
                Confirm Reassignment
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
};
