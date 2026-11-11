import React, { useState, useEffect } from 'react';
import { dbAdapter } from '../../services/databaseAdapter';
import { RestaurantTable, Order, WaiterCall, KitchenTicket } from '../../types';
import { StaffLayout } from '../../components/layout/StaffLayout';
import { Button } from '../../components/ui/Button';
import { TableStatusBadge, OrderStatusBadge } from '../../components/ui/Badge';
import { formatTime } from '../../utils/date';
import {
  Bell,
  UtensilsCrossed,
  CheckCircle2,
  PhoneCall,
  Clock,
  Sparkles,
  UserCheck,
  AlertCircle,
} from 'lucide-react';

export const WaiterDashboard: React.FC = () => {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  const [readyTickets, setReadyTickets] = useState<KitchenTicket[]>([]);

  useEffect(() => {
    const updateState = () => {
      setTables([...dbAdapter.getTables()]);
      setOrders([...dbAdapter.getOrders()]);
      setWaiterCalls([...dbAdapter.getWaiterCalls()]);
      setReadyTickets(dbAdapter.getKitchenTickets().filter(t => t.status === 'READY'));
    };
    updateState();
    return dbAdapter.subscribe(updateState);
  }, []);

  const pendingCalls = waiterCalls.filter(c => c.status === 'PENDING');
  const activeOrders = orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');

  const handleAcknowledgeCall = (callId: string) => {
    dbAdapter.updateWaiterCallStatus(callId, 'ACKNOWLEDGED');
  };

  const handleCompleteCall = (callId: string) => {
    dbAdapter.updateWaiterCallStatus(callId, 'COMPLETED');
  };

  const handleMarkServed = (orderId: string) => {
    dbAdapter.markOrderServed(orderId);
  };

  return (
    <StaffLayout
      title="Waiter Station"
      subtitle="Floor Service, Ready-to-Serve Alerts & Table Assistance"
      activeRole="waiter"
    >
      <div className="space-y-6">
        {/* Urgent Service Calls from Customers */}
        {pendingCalls.length > 0 && (
          <div className="bg-amber-950/40 border border-amber-500/50 rounded-2xl p-4 shadow-lg animate-pulse-subtle">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-5 h-5 text-amber-400 animate-bounce" />
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-amber-300">
                Customer Calls Awaiting Response ({pendingCalls.length})
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingCalls.map((call) => (
                <div
                  key={call.id}
                  className="bg-slate-900 border border-amber-500/40 rounded-xl p-3.5 flex items-center justify-between"
                >
                  <div>
                    <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-extrabold text-xs">
                      Table {call.table_number}
                    </span>
                    <h5 className="font-bold text-white text-xs mt-1">
                      {call.request_type.replace('_', ' ')}
                    </h5>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Requested at {formatTime(call.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Button
                      size="sm"
                      variant="orange"
                      className="text-xs py-1"
                      onClick={() => handleAcknowledgeCall(call.id)}
                    >
                      Acknowledge
                    </Button>
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

        {/* Ready to Serve from Kitchen (High Priority Action) */}
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

        {/* Assigned Floor Tables */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-card">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-white">
              Restaurant Floor Overview ({tables.length} Tables)
            </h3>
            <span className="text-xs text-slate-400 font-mono">Captain View</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {tables.map((table) => {
              const tableOrder = activeOrders.find(o => o.table_id === table.id);

              return (
                <div
                  key={table.id}
                  className="bg-[#161F30] border border-slate-800 rounded-xl p-3.5 space-y-2 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-white text-sm">
                      {table.table_number}
                    </span>
                    <TableStatusBadge status={table.status} />
                  </div>

                  <div className="text-[11px] text-slate-400 space-y-0.5">
                    <p>{table.floor_area}</p>
                    <p>{table.seating_capacity} Seater Capacity</p>
                  </div>

                  {tableOrder && (
                    <div className="pt-2 border-t border-slate-800 text-[10px]">
                      <span className="text-slate-400">Current Order: </span>
                      <strong className="text-brand-orange font-mono">{tableOrder.order_number}</strong>
                      <div className="mt-1">
                        <OrderStatusBadge status={tableOrder.status} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </StaffLayout>
  );
};
