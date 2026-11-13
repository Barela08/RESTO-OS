import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { dbAdapter } from '../../services/databaseAdapter';
import { db } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Order, OrderStatus } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { formatDateTime } from '../../utils/date';
import { Button } from '../../components/ui/Button';
import { OrderStatusBadge } from '../../components/ui/Badge';
import {
  CheckCircle2,
  Clock,
  ChefHat,
  Bell,
  CreditCard,
  Utensils,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export const OrderTrackingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    const fetchOrder = () => {
      const found = dbAdapter.getOrders().find((o) => o.id === id);
      if (found) {
        setOrder({ ...found });
      }
    };
    fetchOrder();
    const unsubLocal = dbAdapter.subscribe(fetchOrder);

    let unsubFirestore = () => {};
    if (db && id) {
      try {
        const orderRef = doc(db, 'orders', id);
        unsubFirestore = onSnapshot(orderRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const rawStatus = data.status;
            const mappedStatus =
              rawStatus === 'READY_FOR_HANDOVER' ? 'READY' : rawStatus;
            setOrder((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                status: mappedStatus as OrderStatus,
                updated_at: new Date().toISOString(),
              };
            });
          }
        });
      } catch (err) {
        console.warn('[OrderTracking] Firestore subscription notice:', err);
      }
    }

    return () => {
      unsubLocal();
      unsubFirestore();
    };
  }, [id]);

  if (!order) {
    return (
      <div className="text-center py-12 bg-white rounded-3xl p-8 border border-slate-100">
        <h3 className="font-bold text-slate-900 text-base">Order Not Found</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">The requested order ticket could not be located.</p>
        <Link to="/order">
          <Button variant="orange" size="sm">Back to Menu</Button>
        </Link>
      </div>
    );
  }

  // Stages definition
  const stages = [
    { key: 'PLACED', label: 'Order Placed', desc: 'Sent to kitchen stations' },
    { key: 'ACCEPTED', label: 'Accepted by Kitchen', desc: 'Chef acknowledged ticket' },
    { key: 'PREPARING', label: 'Cooking & Preparing', desc: 'Dishes in the pan & oven' },
    { key: 'READY', label: 'Ready for Service', desc: 'Plated and hot at the pass' },
    { key: 'SERVED', label: 'Served to Table', desc: 'Enjoy your delicious meal!' },
  ];

  const getStageIndex = (status: string) => {
    switch (status) {
      case 'PLACED': return 0;
      case 'ACCEPTED': return 1;
      case 'PREPARING': return 2;
      case 'READY': return 3;
      case 'SERVED':
      case 'COMPLETED': return 4;
      default: return 0;
    }
  };

  const currentStageIdx = getStageIndex(order.status);

  return (
    <div className="space-y-4">
      {/* Top Status Card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-6 text-center relative overflow-hidden">
        <div className="w-14 h-14 rounded-2xl bg-orange-50 text-brand-orange flex items-center justify-center mx-auto mb-3 shadow-inner">
          <ChefHat className="w-7 h-7" />
        </div>
        <div className="flex justify-center mb-1">
          <OrderStatusBadge status={order.status} />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Table {order.table?.table_number || 'T-01'}
        </h2>
        <p className="text-xs text-slate-500 font-mono mt-0.5">
          Order #{order.order_number} • {formatDateTime(order.created_at)}
        </p>

        {/* Action Button: Proceed to Pay if Served */}
        {order.status === 'SERVED' && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <Button
              className="w-full"
              variant="orange"
              size="lg"
              leftIcon={<CreditCard className="w-4 h-4" />}
              onClick={() => navigate(`/order/payment/${order.id}`)}
            >
              Request Bill & Pay Online / Cash
            </Button>
          </div>
        )}
      </div>

      {/* Progress Timeline */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-6">
        <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-orange" />
          <span>Live Kitchen Progress</span>
        </h3>

        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {stages.map((stage, idx) => {
            const isCompleted = idx <= currentStageIdx;
            const isCurrent = idx === currentStageIdx;

            return (
              <div key={stage.key} className="relative flex items-start gap-3 text-xs">
                {/* Milestone Node */}
                <span
                  className={`absolute -left-6 top-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    isCompleted
                      ? 'bg-green-600 text-white ring-4 ring-green-100'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                </span>

                <div>
                  <h4
                    className={`font-bold ${
                      isCurrent
                        ? 'text-brand-orange text-sm'
                        : isCompleted
                        ? 'text-slate-900'
                        : 'text-slate-400'
                    }`}
                  >
                    {stage.label}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">{stage.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Items Summary Card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-6">
        <h3 className="font-bold text-slate-900 text-sm mb-3">Order Summary</h3>
        <div className="divide-y divide-slate-100 text-xs">
          {order.items.map((item) => (
            <div key={item.id} className="py-2.5 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-800">{item.item_name}</p>
                <p className="text-[11px] text-slate-500">Qty: {item.quantity}</p>
              </div>
              <span className="font-extrabold text-slate-900">
                {formatCurrency(item.total_price)}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 pt-3 mt-2 space-y-1 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal:</span>
            <span>{formatCurrency(order.subtotal_amount)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>GST (5%):</span>
            <span>{formatCurrency(order.cgst_amount + order.sgst_amount)}</span>
          </div>
          <div className="flex justify-between font-extrabold text-slate-900 text-sm pt-2 border-t border-slate-100">
            <span>Total:</span>
            <span className="text-brand-orange">{formatCurrency(order.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* Footer Navigation Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-2">
        <Link to="/order">
          <Button variant="secondary" className="w-full text-xs">
            + Order More Items
          </Button>
        </Link>
        <Link to={`/order/payment/${order.id}`}>
          <Button variant="orange" className="w-full text-xs">
            Proceed to Payment
          </Button>
        </Link>
      </div>
    </div>
  );
};
