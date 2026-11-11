import React, { useState, useEffect } from 'react';
import { dbAdapter } from '../../services/databaseAdapter';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { formatCurrency } from '../../utils/currency';
import { TableStatusBadge, OrderStatusBadge } from '../../components/ui/Badge';
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
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [tables, setTables] = useState(dbAdapter.getTables());
  const [orders, setOrders] = useState(dbAdapter.getOrders());
  const [payments, setPayments] = useState(dbAdapter.getPayments());
  const [tickets, setTickets] = useState(dbAdapter.getKitchenTickets());
  const [repeatScans, setRepeatScans] = useState(dbAdapter.getRepeatScanRequests());

  useEffect(() => {
    const update = () => {
      setTables([...dbAdapter.getTables()]);
      setOrders([...dbAdapter.getOrders()]);
      setPayments([...dbAdapter.getPayments()]);
      setTickets([...dbAdapter.getKitchenTickets()]);
      setRepeatScans([...dbAdapter.getRepeatScanRequests()]);
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
      </div>
    </AdminLayout>
  );
};
