import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSessionStore } from '../../store/sessionStore';
import { useCartStore } from '../../store/cartStore';
import { useCustomerAuthStore } from '../../store/customerAuthStore';
import { dbAdapter } from '../../services/databaseAdapter';
import { Order, OrderStatus } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { formatDate, formatTime } from '../../utils/date';
import { OrderStatusBadge, PaymentStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import {
  Clock,
  UtensilsCrossed,
  Receipt,
  RotateCcw,
  ChevronRight,
  Eye,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';

type FilterType = 'ALL' | 'COMPLETED' | 'PENDING' | 'CANCELLED' | 'PAID' | 'UNPAID';

export const CustomerOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentSession, table } = useSessionStore();
  const { addItem } = useCartStore();
  const { customer, isLoggedIn } = useCustomerAuthStore();

  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [reorderSuccessMsg, setReorderSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = () => {
      let list = dbAdapter.getOrders();
      // If customer has a logged-in account, show all orders for this customer phone or current session
      if (customer?.phone) {
        list = list.filter(
          (o) =>
            o.customer_phone === customer.phone ||
            (currentSession && o.table_session_id === currentSession.id)
        );
      } else if (currentSession) {
        list = list.filter((o) => o.table_session_id === currentSession.id);
      }
      setOrders([...list]);
    };

    fetchOrders();
    return dbAdapter.subscribe(fetchOrders);
  }, [customer, currentSession]);

  // Payment status resolver for order
  const getOrderPaymentStatus = (order: Order) => {
    const payment = dbAdapter.getPayments().find((p) => p.table_session_id === order.table_session_id);
    if (!payment) return 'UNPAID';
    return (payment.payment_status === 'PAID' || (payment.payment_status as string) === 'COMPLETED') ? 'PAID' : 'PENDING';
  };

  const getOrderPaymentMethod = (order: Order) => {
    const payment = dbAdapter.getPayments().find((p) => p.table_session_id === order.table_session_id);
    return payment?.payment_method || 'UPI / Cash';
  };

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    const payStatus = getOrderPaymentStatus(order);
    if (filter === 'COMPLETED') return order.status === 'COMPLETED' || order.status === 'SERVED';
    if (filter === 'PENDING') return ['PLACED', 'ACCEPTED', 'PREPARING', 'READY'].includes(order.status);
    if (filter === 'CANCELLED') return order.status === 'CANCELLED' || order.status === 'REJECTED';
    if (filter === 'PAID') return payStatus === 'PAID';
    if (filter === 'UNPAID') return payStatus === 'UNPAID' || payStatus === 'PENDING';
    return true;
  });

  const activeOrders = orders.filter((o) =>
    ['PLACED', 'ACCEPTED', 'PREPARING', 'READY'].includes(o.status)
  );

  const handleOpenReorder = (order: Order) => {
    setSelectedOrder(order);
    setIsReorderModalOpen(true);
  };

  const handleConfirmReorder = () => {
    if (!selectedOrder) return;
    const allMenuItems = dbAdapter.getMenuItems();
    let addedCount = 0;

    for (const item of selectedOrder.items) {
      const menuItem = allMenuItems.find((m) => m.id === item.menu_item_id);
      if (menuItem && menuItem.is_available) {
        addItem(menuItem, item.quantity);
        addedCount++;
      }
    }

    setIsReorderModalOpen(false);
    setReorderSuccessMsg(`Added ${addedCount} available dishes to your dining bag!`);
    setTimeout(() => {
      setReorderSuccessMsg(null);
      navigate('/bag');
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Order History & Active Tracking
          </h1>
          <p className="text-xs text-slate-500">
            {isLoggedIn && customer
              ? `Account orders for ${customer.full_name} (${customer.phone})`
              : 'Viewing orders for current dining session'}
          </p>
        </div>

        <Link to="/menu">
          <Button variant="orange" size="sm" className="inline-flex items-center gap-1.5 self-start">
            <UtensilsCrossed className="w-4 h-4" />
            <span>Order More Dishes</span>
          </Button>
        </Link>
      </div>

      {reorderSuccessMsg && (
        <div className="p-4 bg-green-50 border border-green-300 rounded-2xl flex items-center gap-2.5 text-xs text-green-800 font-bold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <span>{reorderSuccessMsg}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. ACTIVE LIVE ORDERS BANNER                                   */}
      {/* ============================================================== */}
      {activeOrders.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping" />
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              Active Orders In Progress ({activeOrders.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-3xl p-5 border border-amber-200 shadow-md relative overflow-hidden flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-extrabold text-base text-slate-900">
                        {order.order_number}
                      </span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <p className="text-xs text-slate-500">
                      Table {order.table?.table_number || 'T-00'} • {formatTime(order.created_at)}
                    </p>
                  </div>
                  <span className="text-base font-black text-brand-orange">
                    {formatCurrency(order.total_amount)}
                  </span>
                </div>

                <div className="space-y-1.5 mb-4">
                  {order.items.map((i) => (
                    <div key={i.id} className="text-xs text-slate-700 flex justify-between">
                      <span>
                        {i.quantity}x {i.item_name}
                      </span>
                      <span className="text-slate-500">{formatCurrency(i.total_price)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-[11px] text-amber-800 font-semibold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Kitchen preparing food</span>
                  </span>
                  <Link to={`/order/track/${order.id}`}>
                    <Button variant="orange" size="sm" className="inline-flex items-center gap-1">
                      <span>Live Tracker</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. ORDER HISTORY & FILTER TABS                                 */}
      {/* ============================================================== */}
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          {(['ALL', 'COMPLETED', 'PENDING', 'CANCELLED', 'PAID', 'UNPAID'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all shadow-sm ${
                filter === f
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-100 shadow-sm">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-2.5" />
            <h3 className="font-bold text-slate-900 text-base">No Orders Found</h3>
            <p className="text-xs text-slate-500 mt-1">
              There are no orders matching the selected filter.
            </p>
          </div>
        ) : (
          <>
            {/* ============================================================== */}
            {/* DESKTOP TABLE VIEW (hidden on mobile, block on lg:table)       */}
            {/* ============================================================== */}
            <div className="hidden lg:block bg-white rounded-3xl border border-slate-100 shadow-card overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-extrabold uppercase tracking-wider text-[10px]">
                    <th className="py-4 px-5">Order Number</th>
                    <th className="py-4 px-4">Date & Time</th>
                    <th className="py-4 px-4">Table</th>
                    <th className="py-4 px-5">Items Summary</th>
                    <th className="py-4 px-4">Amount</th>
                    <th className="py-4 px-4">Payment</th>
                    <th className="py-4 px-4">Order Status</th>
                    <th className="py-4 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((order) => {
                    const payStatus = getOrderPaymentStatus(order);
                    const payMethod = getOrderPaymentMethod(order);

                    return (
                      <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-4 px-5 font-black text-slate-900">
                          {order.order_number}
                        </td>
                        <td className="py-4 px-4 text-slate-600">
                          <div>{formatDate(order.created_at)}</div>
                          <div className="text-[10px] text-slate-400">{formatTime(order.created_at)}</div>
                        </td>
                        <td className="py-4 px-4 font-bold text-slate-800">
                          Table {order.table?.table_number || 'T-00'}
                        </td>
                        <td className="py-4 px-5 text-slate-600 max-w-xs truncate">
                          {order.items.map((i) => `${i.quantity}x ${i.item_name}`).join(', ')}
                        </td>
                        <td className="py-4 px-4 font-black text-slate-900">
                          {formatCurrency(order.total_amount)}
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                              payStatus === 'PAID'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {payStatus} • {payMethod}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <OrderStatusBadge status={order.status} />
                        </td>
                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedOrder(order)}
                              className="p-1.5 px-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold transition-colors inline-flex items-center gap-1"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Details</span>
                            </button>
                            <button
                              onClick={() => handleOpenReorder(order)}
                              className="p-1.5 px-2.5 rounded-xl bg-orange-50 hover:bg-brand-orange text-brand-orange hover:text-white border border-orange-200 font-bold transition-all inline-flex items-center gap-1"
                              title="Reorder Dishes"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Reorder</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ============================================================== */}
            {/* MOBILE & TABLET CARD VIEW (lg:hidden)                          */}
            {/* ============================================================== */}
            <div className="lg:hidden space-y-3.5">
              {filteredOrders.map((order) => {
                const payStatus = getOrderPaymentStatus(order);

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-extrabold text-sm text-slate-900">
                            {order.order_number}
                          </span>
                          <OrderStatusBadge status={order.status} />
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {formatDate(order.created_at)} at {formatTime(order.created_at)} • Table{' '}
                          {order.table?.table_number || 'T-00'}
                        </p>
                      </div>

                      <span className="font-black text-sm text-slate-900">
                        {formatCurrency(order.total_amount)}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {order.items.map((i) => (
                        <div key={i.id} className="flex justify-between py-0.5">
                          <span>
                            {i.quantity}x {i.item_name}
                          </span>
                          <span className="font-semibold text-slate-700">
                            {formatCurrency(i.total_price)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                          payStatus === 'PAID'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        Payment: {payStatus}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => handleOpenReorder(order)}
                          className="px-3 py-1.5 rounded-xl bg-orange-50 text-brand-orange border border-orange-200 text-xs font-bold hover:bg-orange-100 flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reorder</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ============================================================== */}
      {/* ORDER DETAILS MODAL                                            */}
      {/* ============================================================== */}
      {selectedOrder && (
        <Modal
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          title={`Order ${selectedOrder.order_number}`}
          description={`Placed on ${formatDate(selectedOrder.created_at)} at ${formatTime(selectedOrder.created_at)}`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
              <div>
                <p className="text-slate-500">Dining Table</p>
                <p className="font-bold text-slate-900">
                  Table {selectedOrder.table?.table_number || 'T-00'} ({selectedOrder.table?.floor_area || 'Main'})
                </p>
              </div>
              <div>
                <p className="text-slate-500">Order Status</p>
                <div className="mt-0.5">
                  <OrderStatusBadge status={selectedOrder.status} />
                </div>
              </div>
            </div>

            {/* Items List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900">Itemized Breakdown:</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedOrder.items.map((i) => (
                  <div
                    key={i.id}
                    className="p-2.5 rounded-xl bg-white border border-slate-200 flex justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {i.quantity}x {i.item_name}
                      </p>
                      {i.special_instructions && (
                        <p className="text-[10px] text-slate-500 italic">"{i.special_instructions}"</p>
                      )}
                    </div>
                    <span className="font-black text-slate-900">
                      {formatCurrency(i.total_price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>{formatCurrency(selectedOrder.subtotal_amount)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Taxes (CGST 2.5% + SGST 2.5%)</span>
                <span>{formatCurrency(selectedOrder.cgst_amount + selectedOrder.sgst_amount)}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-extrabold text-sm pt-1.5 border-t border-slate-200">
                <span>Total Amount</span>
                <span className="text-brand-orange">
                  {formatCurrency(selectedOrder.total_amount)}
                </span>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <Link to={`/order/track/${selectedOrder.id}`} className="flex-1">
                <Button variant="outline" className="w-full">
                  Live Tracking
                </Button>
              </Link>
              <Button
                variant="orange"
                className="flex-1 flex items-center justify-center gap-1.5"
                onClick={() => {
                  setSelectedOrder(null);
                  handleOpenReorder(selectedOrder);
                }}
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reorder Items</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ============================================================== */}
      {/* REORDER CONFIRMATION MODAL                                     */}
      {/* ============================================================== */}
      {isReorderModalOpen && selectedOrder && (
        <Modal
          isOpen={isReorderModalOpen}
          onClose={() => setIsReorderModalOpen(false)}
          title="Confirm Reorder"
          description={`Add dishes from ${selectedOrder.order_number} to your current dining bag?`}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              The dishes from this past order will be verified against the current kitchen stock and added to your bag. You can review and adjust quantities before placing.
            </p>

            <div className="p-3 bg-orange-50 border border-orange-200 rounded-2xl text-xs space-y-1">
              {selectedOrder.items.map((i) => (
                <div key={i.id} className="flex justify-between font-medium text-slate-800">
                  <span>
                    {i.quantity}x {i.item_name}
                  </span>
                  <span>{formatCurrency(i.total_price)}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsReorderModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="orange"
                className="flex-1"
                onClick={handleConfirmReorder}
              >
                Confirm & Add to Bag
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
