import React, { useState, useEffect } from 'react';
import { dbAdapter } from '../../services/databaseAdapter';
import { Customer, LoyaltyAccount, LoyaltyReward, RewardRedemption } from '../../types';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { formatDate, formatDateTime } from '../../utils/date';
import { Award, Users, Gift, Sparkles, CheckCircle2, Sliders, Save, Tag } from 'lucide-react';

export const AdminLoyalty: React.FC = () => {
  const settings = dbAdapter.getSettings();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<LoyaltyAccount[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);

  // Policy Settings
  const [stampsForReward, setStampsForReward] = useState(settings.loyalty_stamps_for_reward || 8);
  const [rewardName, setRewardName] = useState(settings.loyalty_reward_name);
  const [validityDays, setValidityDays] = useState(settings.loyalty_reward_validity_days || 30);
  const [minOrderAmount, setMinOrderAmount] = useState(settings.loyalty_min_order_amount || 250);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const update = () => {
      setCustomers([...dbAdapter.getCustomers()]);
      setAccounts([...dbAdapter.getLoyaltyAccounts()]);
      setRewards([...dbAdapter.getLoyaltyRewards()]);
      setRedemptions([...dbAdapter.getRewardRedemptions()]);
    };
    update();
    return dbAdapter.subscribe(update);
  }, []);

  const totalStampsIssued = accounts.reduce((sum, a) => sum + a.total_stamps_earned, 0);

  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    dbAdapter.updateSettings({
      loyalty_stamps_for_reward: stampsForReward,
      loyalty_reward_name: rewardName,
      loyalty_reward_validity_days: validityDays,
      loyalty_min_order_amount: minOrderAmount,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Digital Loyalty & Stamp Program</h1>
            <p className="text-xs text-slate-500 mt-0.5">Automated stamp issuance, customer retention and reward vouchers</p>
          </div>
          {isSaved && (
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-green-600" /> Policy Updated
            </span>
          )}
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-card">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Registered Members</span>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{customers.length}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-card">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Stamps Issued</span>
            <p className="text-2xl font-extrabold text-brand-orange mt-1">{totalStampsIssued}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-card">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Unlocked Vouchers</span>
            <p className="text-2xl font-extrabold text-brand-purple mt-1">{rewards.length}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-card">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Redeemed Rewards</span>
            <p className="text-2xl font-extrabold text-green-600 mt-1">{redemptions.length}</p>
          </div>
        </div>

        {/* Reward Program Configuration (Module 6.1) */}
        <form onSubmit={handleSavePolicy} className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Sliders className="w-4 h-4 text-brand-orange" />
              <span>Reward Rules & Milestone Settings</span>
            </h3>
            <Button type="submit" variant="orange" size="sm" leftIcon={<Save className="w-3.5 h-3.5" />}>
              Save Rules
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Input
              label="Stamps for Reward"
              type="number"
              min={1}
              max={20}
              value={stampsForReward}
              onChange={(e) => setStampsForReward(parseInt(e.target.value, 10) || 8)}
            />
            <Input
              label="Min Order Amount (₹)"
              type="number"
              value={minOrderAmount}
              onChange={(e) => setMinOrderAmount(parseFloat(e.target.value) || 250)}
            />
            <Input
              label="Voucher Validity (Days)"
              type="number"
              value={validityDays}
              onChange={(e) => setValidityDays(parseInt(e.target.value, 10) || 30)}
            />
            <Input
              label="Reward Voucher Name"
              value={rewardName}
              onChange={(e) => setRewardName(e.target.value)}
            />
          </div>
        </form>

        {/* Member Stamp Accounts */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
          <h3 className="font-extrabold text-slate-900 text-sm mb-4">Member Stamp Accounts</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3">Active Stamps</th>
                  <th className="py-2.5 px-3">Lifetime Stamps</th>
                  <th className="py-2.5 px-3">Rewards Unlocked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.map((acc) => {
                  const cust = customers.find(c => c.id === acc.customer_id);
                  return (
                    <tr key={acc.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {cust?.full_name || 'Guest'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {cust?.phone}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2.5 py-1 rounded-full bg-orange-50 text-brand-orange font-extrabold border border-orange-200">
                          {acc.current_active_stamps} / {stampsForReward} Stamps
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-700">
                        {acc.total_stamps_earned}
                      </td>
                      <td className="py-3 px-3 font-bold text-green-600">
                        {acc.total_rewards_unlocked} Rewards
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reward Redemptions Audit Log */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
          <h3 className="font-extrabold text-slate-900 text-sm mb-1 flex items-center gap-2">
            <Gift className="w-4 h-4 text-green-600" />
            <span>Reward Redemptions History</span>
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Audited history of digital reward redemptions verified by counter and waitstaff.
          </p>

          {redemptions.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs">
              <span>No rewards redeemed yet.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                    <th className="py-2.5 px-3">Redeemed At</th>
                    <th className="py-2.5 px-3">Redemption Code</th>
                    <th className="py-2.5 px-3">Customer ID</th>
                    <th className="py-2.5 px-3">Table</th>
                    <th className="py-2.5 px-3">Redeemed By Staff</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {redemptions.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-mono text-slate-500">
                        {r.redeemed_at ? formatDateTime(r.redeemed_at) : 'Claimed (Pending)'}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-extrabold text-brand-orange">
                        {r.redemption_code}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {r.customer_id.substring(0, 10)}...
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {r.table_id || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {r.redeemed_by || 'Staff'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-bold text-[10px]">
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};
