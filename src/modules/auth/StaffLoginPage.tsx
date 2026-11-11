import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { StaffRoleType } from '../../types';
import { ChefHat, UserCheck, CreditCard, Sparkles, ArrowRight } from 'lucide-react';

export const StaffLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginAsRole, loginWithCredentials } = useAuthStore();

  const [role, setRole] = useState<StaffRoleType>('waiter');
  const [employeeCode, setEmployeeCode] = useState('EMP-WTR-01');

  const handleRoleSelect = (selectedRole: StaffRoleType) => {
    loginAsRole(selectedRole);
    if (selectedRole === 'kitchen') navigate('/kitchen');
    else if (selectedRole === 'waiter') navigate('/waiter');
    else if (selectedRole === 'counter') navigate('/counter');
    else navigate('/admin');
  };

  return (
    <div className="min-h-screen bg-[#0B1220] flex items-center justify-center p-4 text-white">
      <div className="max-w-md w-full bg-[#111827] border border-slate-800 rounded-3xl p-8 shadow-elevated">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-orange to-amber-500 flex items-center justify-center text-white font-extrabold mx-auto mb-3 shadow-lg">
            S
          </div>
          <h1 className="text-xl font-extrabold tracking-wide">RESTO OS</h1>
          <p className="text-xs text-slate-400 mt-0.5">Staff Shift Login & Terminal Access</p>
        </div>

        <div className="space-y-3 mb-6">
          <p className="text-xs font-semibold text-slate-400">Select Station Terminal:</p>

          <button
            type="button"
            onClick={() => handleRoleSelect('kitchen')}
            className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-brand-purple flex items-center justify-between text-left transition-all hover:bg-slate-800/60"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-brand-orange flex items-center justify-center">
                <ChefHat className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-xs">Kitchen Display (KDS)</h4>
                <p className="text-[11px] text-slate-400">Cooks, Chefs & Station Line</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500" />
          </button>

          <button
            type="button"
            onClick={() => handleRoleSelect('waiter')}
            className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-brand-purple flex items-center justify-between text-left transition-all hover:bg-slate-800/60"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-xs">Waiter Terminal</h4>
                <p className="text-[11px] text-slate-400">Captains, Order Delivery & Floor</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500" />
          </button>

          <button
            type="button"
            onClick={() => handleRoleSelect('counter')}
            className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-brand-purple flex items-center justify-between text-left transition-all hover:bg-slate-800/60"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-xs">Cash Counter / POS</h4>
                <p className="text-[11px] text-slate-400">Cash Collections, Invoices & Repeat Scans</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="pt-4 border-t border-slate-800 text-center">
          <Link to="/admin/login" className="text-xs text-brand-purple hover:underline">
            Administrator or Owner Console Login →
          </Link>
        </div>
      </div>
    </div>
  );
};
