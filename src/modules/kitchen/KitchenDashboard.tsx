import React, { useState, useEffect } from 'react';
import { dbAdapter } from '../../services/databaseAdapter';
import { KitchenTicket, KitchenTicketStatus } from '../../types';
import { formatTime } from '../../utils/date';
import { StaffLayout } from '../../components/layout/StaffLayout';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import {
  ChefHat,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Flame,
  ArrowRight,
  Filter,
} from 'lucide-react';

export const KitchenDashboard: React.FC = () => {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string>('all');
  const stations = dbAdapter.getKitchenStations();

  // Rejection modal state
  const [rejectingTicketId, setRejectingTicketId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    const updateTickets = () => {
      setTickets([...dbAdapter.getKitchenTickets()]);
    };
    updateTickets();
    return dbAdapter.subscribe(updateTickets);
  }, []);

  const filteredTickets = tickets.filter((t) => {
    if (selectedStationId !== 'all' && t.station_id !== selectedStationId) return false;
    return true;
  });

  const newTickets = filteredTickets.filter(t => t.status === 'NEW');
  const preparingTickets = filteredTickets.filter(t => t.status === 'ACCEPTED' || t.status === 'PREPARING');
  const readyTickets = filteredTickets.filter(t => t.status === 'READY');

  const handleAccept = (ticketId: string) => {
    dbAdapter.updateKitchenTicketStatus(ticketId, 'ACCEPTED');
  };

  const handleStartPrep = (ticketId: string) => {
    dbAdapter.updateKitchenTicketStatus(ticketId, 'PREPARING');
  };

  const handleMarkReady = (ticketId: string) => {
    dbAdapter.updateKitchenTicketStatus(ticketId, 'READY');
  };

  const handleHandover = (ticketId: string) => {
    dbAdapter.updateKitchenTicketStatus(ticketId, 'HANDED_OVER');
  };

  const handleConfirmReject = () => {
    if (!rejectingTicketId) return;
    dbAdapter.updateKitchenTicketStatus(rejectingTicketId, 'REJECTED', rejectionReason);
    setRejectingTicketId(null);
    setRejectionReason('');
  };

  return (
    <StaffLayout
      title="Kitchen Display System (KDS)"
      subtitle="Live Kitchen Line & Multi-Station Routing"
      activeRole="kitchen"
      actions={
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
          <select
            value={selectedStationId}
            onChange={(e) => setSelectedStationId(e.target.value)}
            className="bg-transparent text-white border-none focus:outline-none text-xs pr-2 py-1 font-semibold"
          >
            <option value="all">All Kitchen Stations</option>
            {stations.map(stn => (
              <option key={stn.id} value={stn.id} className="bg-slate-900 text-white">
                {stn.name}
              </option>
            ))}
          </select>
        </div>
      }
    >
      {/* Three Main KDS Columns (NEW, PREPARING, READY) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* COLUMN 1: NEW ORDERS */}
        <div className="flex flex-col bg-slate-900/80 rounded-2xl border border-slate-800 p-4 min-h-[500px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping" />
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-amber-400">
                New Tickets ({newTickets.length})
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Incoming</span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto">
            {newTickets.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-slate-600 text-xs">
                <ChefHat className="w-8 h-8 mb-1.5 opacity-40" />
                <span>No new pending tickets</span>
              </div>
            ) : (
              newTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="bg-[#161F30] border border-amber-500/40 rounded-xl p-3.5 shadow-md space-y-2.5 transition-all hover:border-amber-400"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-extrabold text-xs">
                      Table {ticket.table_number}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatTime(ticket.created_at)}
                    </span>
                  </div>

                  <div className="text-xs font-semibold text-slate-300">
                    <span className="text-[10px] text-slate-400 block font-mono">{ticket.station?.name}</span>
                    <span className="text-white font-mono text-[11px]">{ticket.ticket_number}</span>
                  </div>

                  {/* Items List */}
                  <div className="divide-y divide-slate-800 border-y border-slate-800 py-1 text-xs">
                    {ticket.items.map((item) => (
                      <div key={item.id} className="py-1 flex items-start justify-between">
                        <div>
                          <p className="font-bold text-white text-xs">
                            <span className="text-amber-400 font-extrabold mr-1.5">{item.quantity}x</span>
                            {item.item_name}
                          </p>
                          {item.special_instructions && (
                            <p className="text-[10px] text-amber-300/80 italic mt-0.5">
                              Note: {item.special_instructions}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="danger"
                      className="text-xs py-1"
                      onClick={() => setRejectingTicketId(ticket.id)}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="orange"
                      className="text-xs py-1"
                      onClick={() => handleAccept(ticket.id)}
                    >
                      Accept Ticket
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUMN 2: PREPARING */}
        <div className="flex flex-col bg-slate-900/80 rounded-2xl border border-slate-800 p-4 min-h-[500px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400 animate-pulse" />
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-orange-400">
                In Preparation ({preparingTickets.length})
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Active Cooking</span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto">
            {preparingTickets.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-slate-600 text-xs">
                <Flame className="w-8 h-8 mb-1.5 opacity-40" />
                <span>No tickets cooking</span>
              </div>
            ) : (
              preparingTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="bg-[#161F30] border border-orange-500/40 rounded-xl p-3.5 shadow-md space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-orange-400/20 text-orange-300 font-extrabold text-xs">
                      Table {ticket.table_number}
                    </span>
                    <span className="text-[11px] font-semibold text-orange-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {ticket.status === 'PREPARING' ? 'Cooking...' : 'Accepted'}
                    </span>
                  </div>

                  <div className="text-xs">
                    <p className="text-[10px] text-slate-400 font-mono">{ticket.station?.name}</p>
                    <p className="text-white font-mono text-[11px]">{ticket.ticket_number}</p>
                  </div>

                  <div className="divide-y divide-slate-800 border-y border-slate-800 py-1 text-xs">
                    {ticket.items.map((item) => (
                      <div key={item.id} className="py-1">
                        <p className="font-bold text-white text-xs">
                          <span className="text-orange-400 font-extrabold mr-1.5">{item.quantity}x</span>
                          {item.item_name}
                        </p>
                        {item.special_instructions && (
                          <p className="text-[10px] text-amber-300/80 italic">{item.special_instructions}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {ticket.status === 'ACCEPTED' ? (
                    <Button
                      size="sm"
                      variant="orange"
                      className="w-full text-xs"
                      onClick={() => handleStartPrep(ticket.id)}
                    >
                      Start Cooking
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="success"
                      className="w-full text-xs"
                      leftIcon={<CheckCircle2 className="w-4 h-4" />}
                      onClick={() => handleMarkReady(ticket.id)}
                    >
                      Mark Dishes Ready
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUMN 3: READY FOR PASS */}
        <div className="flex flex-col bg-slate-900/80 rounded-2xl border border-slate-800 p-4 min-h-[500px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-green-400">
                Ready at Pass ({readyTickets.length})
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Waiting Waiter</span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto">
            {readyTickets.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-slate-600 text-xs">
                <CheckCircle2 className="w-8 h-8 mb-1.5 opacity-40" />
                <span>No tickets waiting at the pass</span>
              </div>
            ) : (
              readyTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="bg-[#161F30] border border-green-500/50 rounded-xl p-3.5 shadow-md space-y-2.5 animate-pulse-subtle"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded bg-green-500/20 text-green-300 font-extrabold text-xs">
                      Table {ticket.table_number}
                    </span>
                    <span className="text-[10px] bg-green-900/60 text-green-300 px-2 py-0.5 rounded-full font-bold">
                      Waiter Notified
                    </span>
                  </div>

                  <div className="text-xs">
                    <p className="text-[10px] text-slate-400 font-mono">{ticket.station?.name}</p>
                    <p className="text-white font-mono text-[11px]">{ticket.ticket_number}</p>
                  </div>

                  <div className="divide-y divide-slate-800 border-y border-slate-800 py-1 text-xs">
                    {ticket.items.map((item) => (
                      <div key={item.id} className="py-1">
                        <p className="font-bold text-white text-xs">
                          <span className="text-green-400 font-extrabold mr-1.5">{item.quantity}x</span>
                          {item.item_name}
                        </p>
                      </div>
                    ))}
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs text-slate-300 border-slate-700 hover:bg-slate-800"
                    onClick={() => handleHandover(ticket.id)}
                  >
                    Hand Over to Waiter
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Ticket Rejection Reason Modal */}
      <Modal
        isOpen={Boolean(rejectingTicketId)}
        onClose={() => setRejectingTicketId(null)}
        title="Reject Kitchen Ticket"
        description="A mandatory reason is required to notify management and the guest"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select or Type Rejection Reason:
            </label>
            <select
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs mb-2 bg-white"
            >
              <option value="">Select reason...</option>
              <option value="Ingredient out of stock in pantry">Ingredient out of stock in pantry</option>
              <option value="Tandoor / Oven preheating delay">Tandoor / Oven preheating delay</option>
              <option value="Special customization instruction cannot be fulfilled">Customization cannot be fulfilled</option>
              <option value="Kitchen station peak backlog">Kitchen station peak backlog</option>
            </select>
            <input
              type="text"
              placeholder="Or type custom reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={() => setRejectingTicketId(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={!rejectionReason.trim()}
              onClick={handleConfirmReject}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>
    </StaffLayout>
  );
};
