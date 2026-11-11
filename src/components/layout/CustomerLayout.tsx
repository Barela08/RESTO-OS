import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSessionStore } from '../../store/sessionStore';
import { useCartStore } from '../../store/cartStore';
import { dbAdapter } from '../../services/databaseAdapter';
import { formatCurrency } from '../../utils/currency';
import {
  ShoppingBag,
  Bell,
  Receipt,
  Award,
  Sparkles,
  PhoneCall,
  CheckCircle2,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export const CustomerLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { table, currentSession, isVerified } = useSessionStore();
  const { getItemCount, getTotal } = useCartStore();
  const restaurant = dbAdapter.getRestaurant();

  const [isAssistanceModalOpen, setIsAssistanceModalOpen] = useState(false);
  const [assistanceType, setAssistanceType] = useState<'CALL_WAITER' | 'REQUEST_BILL' | 'WATER'>('CALL_WAITER');
  const [assistanceSent, setAssistanceSent] = useState(false);

  const itemCount = getItemCount();
  const cartTotal = getTotal();

  const handleSendAssistance = () => {
    if (!currentSession) return;
    dbAdapter.requestService({
      tableSessionId: currentSession.id,
      requestType: assistanceType,
    });
    setAssistanceSent(true);
    setTimeout(() => {
      setAssistanceSent(false);
      setIsAssistanceModalOpen(false);
    }, 1800);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-800 flex flex-col font-sans pb-24">
      {/* Top Mobile Restaurant Header */}
      <header className="bg-white border-b border-orange-100/80 sticky top-0 z-30 shadow-sm">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/order" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-orange to-amber-500 flex items-center justify-center text-white font-extrabold shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-slate-900 text-sm tracking-tight leading-tight">
                {restaurant.name}
              </h1>
              <p className="text-[11px] text-amber-700 font-medium">Smart Dining Experience</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to="/my-rewards"
              className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors"
              title="Loyalty Rewards"
            >
              <Award className="w-4 h-4" />
            </Link>

            {isVerified && (
              <button
                onClick={() => setIsAssistanceModalOpen(true)}
                className="p-2 rounded-xl bg-orange-50 border border-orange-200 text-brand-orange hover:bg-orange-100 transition-colors"
                title="Call Waiter / Bill"
              >
                <Bell className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Verified Table Banner */}
        <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white px-4 py-1.5 text-xs">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="font-bold tracking-wide">
                {isVerified && table ? `Table ${table.table_number}` : 'Guest Preview Mode'}
              </span>
              {table && <span className="opacity-80">({table.floor_area})</span>}
            </div>
            <span className="text-[10px] font-medium bg-black/20 px-2 py-0.5 rounded-full">
              Session Verified
            </span>
          </div>
        </div>
      </header>

      {/* Main Content View (Customer Mobile Container) */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-4">
        {children}
      </main>

      {/* Sticky Bottom Floating Cart Bar */}
      {itemCount > 0 && !location.pathname.includes('/order/track') && !location.pathname.includes('/order/payment') && (
        <div className="fixed bottom-4 left-0 right-0 z-40 px-4 max-w-md mx-auto">
          <Link
            to="/order?cart=open"
            className="w-full bg-brand-orange hover:bg-brand-orange-dark text-white rounded-2xl p-4 shadow-elevated flex items-center justify-between transition-all transform active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-orange-100">
                  {itemCount} {itemCount === 1 ? 'Item' : 'Items'} selected
                </p>
                <p className="text-base font-extrabold">{formatCurrency(cartTotal)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 font-bold text-sm bg-white/20 px-4 py-2 rounded-xl">
              <span>View Cart</span>
            </div>
          </Link>
        </div>
      )}

      {/* Customer Assistance Modal */}
      <Modal
        isOpen={isAssistanceModalOpen}
        onClose={() => setIsAssistanceModalOpen(false)}
        title="Table Service & Assistance"
        description={table ? `Assisting Table ${table.table_number}` : 'Assistance'}
      >
        {assistanceSent ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-2 animate-bounce" />
            <h4 className="font-bold text-slate-900 text-base">Request Sent to Waiter!</h4>
            <p className="text-xs text-slate-500 mt-1">
              Your server will attend to Table {table?.table_number} momentarily.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Select the service you require and our restaurant team will be notified instantly:
            </p>

            <div className="grid grid-cols-1 gap-2.5">
              <button
                type="button"
                onClick={() => setAssistanceType('CALL_WAITER')}
                className={`p-3.5 rounded-xl border flex items-center gap-3 text-left transition-all ${
                  assistanceType === 'CALL_WAITER'
                    ? 'border-brand-orange bg-orange-50/60 ring-2 ring-brand-orange/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="w-9 h-9 rounded-lg bg-orange-100 text-brand-orange flex items-center justify-center">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Call Waiter to Table</p>
                  <p className="text-[11px] text-slate-500">Need recommendations or assistance</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAssistanceType('REQUEST_BILL')}
                className={`p-3.5 rounded-xl border flex items-center gap-3 text-left transition-all ${
                  assistanceType === 'REQUEST_BILL'
                    ? 'border-brand-orange bg-orange-50/60 ring-2 ring-brand-orange/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Request Bill / Settlement</p>
                  <p className="text-[11px] text-slate-500">Ready to pay online or at counter</p>
                </div>
              </button>
            </div>

            <Button
              className="w-full mt-4"
              variant="orange"
              onClick={handleSendAssistance}
            >
              Submit Service Request
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};
