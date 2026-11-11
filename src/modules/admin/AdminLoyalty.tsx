import React, { useState, useEffect } from 'react';
import { dbAdapter } from '../../services/databaseAdapter';
import { Customer, LoyaltyAccount, LoyaltyReward } from '../../types';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Award, Users, Gift, Sparkles, CheckCircle2 } from 'lucide-react';

export const AdminLoyalty: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<LoyaltyAccount[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);

  useEffect(() => {
    setCustomers([...dbAdapter.getCustomers()]);
    setAccounts([...dbAdapter.getLoyaltyAccounts()]);
    setRewards([...dbAdapter.getLoyaltyRewards()]);
  }, []);

  const totalStampsIssued = accounts.reduce((sum, a) => sum + a.total_stamps_earned, 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Digital Loyalty & Stamp Program</h1>
          <p className="text-xs text-slate-500 mt-0.5">Automated stamp issuance, customer retention and reward vouchers</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
          <h3 className="font-extrabold text-slate-900 text-sm mb-4">Member Stamp Accounts</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3">Current Active Stamps</th>
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
                          {acc.current_active_stamps} / 8 Stamps
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
      </div>
    </AdminLayout>
  );
};
