import React, { useState } from 'react';
import { dbAdapter } from '../../services/databaseAdapter';
import {
  RestaurantTable,
  TableStatus,
  TableSession,
  Order,
  MenuItem,
  MenuCategory,
} from '../../types';
import { formatCurrency } from '../../utils/currency';
import { formatTime, formatDateTime } from '../../utils/date';
import { TableStatusBadge, OrderStatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  X,
  UtensilsCrossed,
  User,
  Clock,
  Receipt,
  PhoneCall,
  CheckCircle2,
  AlertCircle,
  Eye,
  Layers,
  Sparkles,
  Search,
  Brush,
} from 'lucide-react';

interface TableDetailModalProps {
  table: RestaurantTable | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (tableId: string, status: TableStatus) => void;
  onOpenSettle?: (table: RestaurantTable) => void;
}

export const TableDetailModal: React.FC<TableDetailModalProps> = ({
  table,
  isOpen,
  onClose,
  onStatusChange,
  onOpenSettle,
}) => {
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'MENU'>('DETAILS');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [menuSearch, setMenuSearch] = useState<string>('');

  if (!isOpen || !table) return null;

  const staffList = dbAdapter.getStaff();
  const assignedStaff = staffList.find(s => s.id === table.current_waiter_id);
  const waiterName = assignedStaff?.profile?.full_name || assignedStaff?.designation || 'Unassigned';

  // Current ACTIVE session for this table (ISOLATED - never mix past sessions)
  const activeSession = dbAdapter.getSessions().find(
    s => s.table_id === table.id && s.status === 'ACTIVE'
  );

  // Current session orders ONLY
  const sessionOrders: Order[] = activeSession
    ? dbAdapter.getOrders().filter(o => o.table_session_id === activeSession.id)
    : [];

  const subtotal = sessionOrders.reduce((sum, o) => sum + o.subtotal_amount, 0);
  const cgst = sessionOrders.reduce((sum, o) => sum + o.cgst_amount, 0);
  const sgst = sessionOrders.reduce((sum, o) => sum + o.sgst_amount, 0);
  const totalAmount = sessionOrders.reduce((sum, o) => sum + o.total_amount, 0);

  // Check pending payment
  const pendingPayment = dbAdapter.getPayments().find(
    p => p.table_id === table.id && p.payment_status === 'PENDING'
  );

  // Menu data
  const categories: MenuCategory[] = dbAdapter.getCategories();
  const menuItems: MenuItem[] = dbAdapter.getMenuItems();

  const filteredMenuItems = menuItems.filter(item => {
    if (selectedCategory !== 'all' && item.category_id !== selectedCategory) return false;
    if (menuSearch.trim()) {
      const q = menuSearch.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleMarkCleaned = () => {
    dbAdapter.markTableCleaned(table.id);
    if (onStatusChange) onStatusChange(table.id, 'AVAILABLE');
  };

  const handleCallWaiter = () => {
    if (activeSession) {
      dbAdapter.requestService({
        tableSessionId: activeSession.id,
        requestType: 'CALL_WAITER',
        notes: `Call initiated from Table Details card for ${table.table_number}`,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-slate-100">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-brand-orange flex items-center justify-center font-extrabold text-base shadow-sm">
              {table.table_number.replace(/^T-?0*/i, '') || table.table_number}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-lg tracking-tight">
                  Table {table.table_number}
                </h3>
                <TableStatusBadge status={table.status} />
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {table.floor_area} • {table.seating_capacity} Seater • Waiter: <span className="text-slate-800 font-semibold">{waiterName}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-slate-200 px-5 pt-2 bg-white">
          <button
            onClick={() => setActiveTab('DETAILS')}
            className={`pb-3 px-4 text-xs font-bold transition-all relative flex items-center gap-2 ${
              activeTab === 'DETAILS'
                ? 'text-brand-orange border-b-2 border-brand-orange'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Table Session & Orders</span>
          </button>
          <button
            onClick={() => setActiveTab('MENU')}
            className={`pb-3 px-4 text-xs font-bold transition-all relative flex items-center gap-2 ${
              activeTab === 'MENU'
                ? 'text-brand-orange border-b-2 border-brand-orange'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Eye className="w-4 h-4 text-amber-500" />
            <span>View Current Menu</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'DETAILS' ? (
            <>
              {/* Active Session Info */}
              {activeSession ? (
                <div className="bg-orange-50/60 border border-orange-200/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800">
                      Active Customer Session
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Opened at {formatTime(activeSession.opened_at)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Customer:</span>
                      <strong className="text-slate-900 font-bold">
                        {activeSession.customer_name || 'Walk-in Guest'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Phone:</span>
                      <strong className="text-slate-800 font-mono">
                        {activeSession.customer_phone || 'Unlinked'}
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center py-6 text-xs text-slate-500">
                  <User className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
                  <p className="font-semibold text-slate-700">No active customer session on this table.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Scanning the physical QR will automatically establish a clean session.
                  </p>
                </div>
              )}

              {/* Current Session Orders */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Current Session Orders ({sessionOrders.length})
                  </h4>
                  {totalAmount > 0 && (
                    <span className="text-xs font-extrabold text-brand-orange">
                      Total: {formatCurrency(totalAmount)}
                    </span>
                  )}
                </div>

                {sessionOrders.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center text-xs text-slate-400 py-6">
                    <UtensilsCrossed className="w-6 h-6 mx-auto mb-1 opacity-40 text-slate-400" />
                    <span>No orders placed in this session yet.</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessionOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                          <span className="font-mono font-bold text-slate-800">
                            {ord.order_number}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-mono">
                              {formatTime(ord.created_at)}
                            </span>
                            <OrderStatusBadge status={ord.status} />
                          </div>
                        </div>

                        {/* Order Items */}
                        <div className="space-y-1.5 text-xs">
                          {ord.items.map((it) => (
                            <div key={it.id} className="flex items-start justify-between">
                              <div>
                                <span className="font-bold text-slate-900 mr-2">
                                  {it.quantity}x
                                </span>
                                <span className="text-slate-800 font-medium">{it.item_name}</span>
                                {it.special_instructions && (
                                  <p className="text-[10px] text-amber-700 italic pl-5">
                                    "{it.special_instructions}"
                                  </p>
                                )}
                              </div>
                              <span className="font-semibold text-slate-700">
                                {formatCurrency(it.total_price)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Order Notes */}
                        {ord.special_notes && (
                          <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-100 mt-2">
                            <strong>Note:</strong> {ord.special_notes}
                          </p>
                        )}
                      </div>
                    ))}

                    {/* Financial Summary */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1 text-xs">
                      <div className="flex justify-between text-slate-500">
                        <span>Items Subtotal:</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>CGST (2.5%):</span>
                        <span>{formatCurrency(cgst)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>SGST (2.5%):</span>
                        <span>{formatCurrency(sgst)}</span>
                      </div>
                      <div className="flex justify-between font-extrabold text-sm text-slate-900 pt-2 border-t border-slate-200">
                        <span>Final Payable:</span>
                        <span className="text-brand-orange">{formatCurrency(totalAmount)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* VIEW CURRENT MENU TAB */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder="Search dishes, drinks, desserts..."
                    className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-brand-orange"
                  />
                </div>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
                >
                  <option value="all">All Categories ({menuItems.length})</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Menu Items List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredMenuItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-2xl border flex gap-3 transition-all ${
                      item.is_available
                        ? 'bg-white border-slate-200'
                        : 'bg-slate-50/80 border-slate-200 opacity-60'
                    }`}
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-16 h-16 rounded-xl object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-orange-100 text-brand-orange flex items-center justify-center shrink-0">
                        <UtensilsCrossed className="w-6 h-6" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${
                            item.is_veg
                              ? 'border-green-600'
                              : 'border-red-600'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              item.is_veg ? 'bg-green-600' : 'bg-red-600'
                            }`}
                          />
                        </span>
                        <h5 className="font-bold text-slate-900 text-xs truncate">
                          {item.name}
                        </h5>
                      </div>

                      <p className="text-[10px] text-slate-500 line-clamp-1 mb-1">
                        {item.description || 'Artisanal kitchen preparation'}
                      </p>

                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs text-slate-900">
                          {formatCurrency(item.base_price)}
                        </span>
                        <span
                          className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                            item.is_available
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {item.is_available ? 'AVAILABLE' : 'SOLD OUT'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {table.status === 'CLEANING' && (
              <Button
                variant="success"
                size="sm"
                leftIcon={<Brush className="w-4 h-4" />}
                onClick={handleMarkCleaned}
              >
                Mark Table Cleaned (Ready)
              </Button>
            )}

            {activeSession && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<PhoneCall className="w-4 h-4" />}
                onClick={handleCallWaiter}
              >
                Call Waiter
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onOpenSettle && (table.status === 'OCCUPIED' || table.status === 'PAYMENT_PENDING') && (
              <Button
                variant="orange"
                size="sm"
                leftIcon={<Receipt className="w-4 h-4" />}
                onClick={() => onOpenSettle(table)}
              >
                Settle & Clear Bill
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
