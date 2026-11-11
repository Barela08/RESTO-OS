import React, { useState, useEffect } from 'react';
import { dbAdapter } from '../../services/databaseAdapter';
import { Customer, LoyaltyAccount, LoyaltyReward } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { formatDate } from '../../utils/date';
import {
  Award,
  Sparkles,
  CheckCircle2,
  Lock,
  Gift,
  ArrowRight,
  ShieldCheck,
  Tag,
} from 'lucide-react';

export const CustomerLoyaltyPage: React.FC = () => {
  const [phone, setPhone] = useState('+91 98888 77665');
  const [name, setName] = useState('Aditya Verma');
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyAccount | null>(null);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);

  const settings = dbAdapter.getSettings();
  const restaurant = dbAdapter.getRestaurant();

  useEffect(() => {
    const load = () => {
      const cust = dbAdapter.getCustomers().find(c => c.phone === phone);
      if (cust) {
        setCustomer(cust);
        const acc = dbAdapter.getLoyaltyAccounts().find(a => a.customer_id === cust.id);
        if (acc) setLoyalty({ ...acc });
        const rws = dbAdapter.getLoyaltyRewards().filter(r => r.loyalty_account_id === acc?.id);
        setRewards(rws);
      }
    };
    load();
    return dbAdapter.subscribe(load);
  }, [phone]);

  const handleRegisterOrLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !name) return;
    const res = dbAdapter.registerLoyaltyCustomer(name, phone);
    setCustomer(res.customer);
    setLoyalty(res.loyalty);
    setIsLoggedIn(true);
  };

  const currentStamps = loyalty?.current_active_stamps || 0;
  const targetStamps = settings.loyalty_stamps_for_reward || 8;
  const progressPercent = Math.min(100, Math.round((currentStamps / targetStamps) * 100));

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-tr from-brand-orange to-amber-500 rounded-3xl p-6 text-white shadow-elevated text-center relative overflow-hidden">
        <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto mb-3 shadow-inner">
          <Award className="w-7 h-7 text-white" />
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-black/20 text-white text-[10px] uppercase font-bold tracking-widest">
          {restaurant.name} Rewards
        </span>
        <h2 className="text-2xl font-extrabold tracking-tight mt-1">Digital Stamp Card</h2>
        <p className="text-xs text-orange-100 mt-1 max-w-xs mx-auto">
          Collect 1 stamp per completed order. Reach 8 stamps to unlock your complimentary chef special!
        </p>
      </div>

      {!isLoggedIn ? (
        /* Guest Registration / Phone Verification Card */
        <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-5 h-5 text-green-600" />
            <h3 className="font-bold text-slate-900 text-sm">Join Resto OS Rewards</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Enter your mobile number to view and accrue loyalty stamps on every dining visit.
          </p>

          <form onSubmit={handleRegisterOrLogin} className="space-y-3">
            <Input
              label="Full Name"
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="Mobile Number (Verified via OTP)"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <Button variant="orange" className="w-full" type="submit">
              Verify & View Stamps
            </Button>
          </form>
        </div>
      ) : (
        /* Logged In Loyalty Dashboard */
        <div className="space-y-4">
          {/* Member Card */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-bold text-slate-900">{customer?.full_name}</p>
                <p className="text-[11px] text-slate-500 font-mono">{customer?.phone}</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Verified Member
              </span>
            </div>

            {/* Stamp Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-700">Stamp Progress</span>
                <span className="text-brand-orange">{currentStamps} of {targetStamps} Stamps</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                <div
                  className="h-full bg-gradient-to-r from-brand-orange to-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 text-right">
                {targetStamps - currentStamps > 0
                  ? `Only ${targetStamps - currentStamps} more orders to your reward!`
                  : 'Milestone reached! Check rewards below.'}
              </p>
            </div>

            {/* 8 Stamp Circles Grid */}
            <div className="grid grid-cols-4 gap-2.5 my-6">
              {Array.from({ length: targetStamps }).map((_, idx) => {
                const isStamped = idx < currentStamps;
                return (
                  <div
                    key={idx}
                    className={`aspect-square rounded-2xl flex flex-col items-center justify-center p-2 border-2 transition-all ${
                      isStamped
                        ? 'border-brand-orange bg-orange-50 text-brand-orange shadow-sm font-extrabold'
                        : 'border-dashed border-slate-200 bg-slate-50 text-slate-400 font-semibold'
                    }`}
                  >
                    {isStamped ? (
                      <>
                        <Sparkles className="w-5 h-5 text-brand-orange mb-0.5 animate-pulse" />
                        <span className="text-[10px] uppercase tracking-wider font-extrabold">STAMP</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 text-slate-300 mb-0.5" />
                        <span className="text-[10px]">#{idx + 1}</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Unlocked Reward Vouchers */}
            <div className="border-t border-slate-100 pt-4">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-brand-orange" />
                <span>Available Rewards ({rewards.length})</span>
              </h4>

              {rewards.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-2xl text-center border border-dashed border-slate-200">
                  <p className="text-xs text-slate-500">
                    No reward vouchers yet. Complete your remaining orders to unlock free delicacies!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rewards.map((reward) => (
                    <div
                      key={reward.id}
                      className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 flex items-center justify-between"
                    >
                      <div>
                        <span className="px-2 py-0.5 bg-brand-orange text-white rounded text-[10px] font-bold uppercase font-mono">
                          {reward.voucher_code}
                        </span>
                        <h5 className="font-bold text-slate-900 text-xs mt-1">{reward.title}</h5>
                        <p className="text-[10px] text-slate-500">Valid until {formatDate(reward.expires_at)}</p>
                      </div>
                      <span className="text-xs font-extrabold text-brand-orange">
                        Ready to Redeem
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Program Rules Card */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-5 text-xs text-slate-600 space-y-2">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-slate-400" />
              <span>Loyalty Rules & Fair Play</span>
            </h4>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-500">
              <li>1 stamp awarded per eligible completed dining order (minimum order ₹{settings.loyalty_min_order_amount}).</li>
              <li>Stamps are awarded automatically after bill payment confirmation.</li>
              <li>Completed orders with refunds reverse associated loyalty stamps.</li>
              <li>Each reward voucher is valid for 30 days from date of unlocking.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
