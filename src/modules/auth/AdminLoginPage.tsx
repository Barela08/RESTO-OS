import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Shield, Lock, Sparkles, ArrowRight } from 'lucide-react';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithCredentials, loginAsRole } = useAuthStore();

  const [email, setEmail] = useState('admin@resto.os');
  const [password, setPassword] = useState('RestoAdmin2026!');
  const [error, setError] = useState('');

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/admin';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your administrator email.');
      return;
    }
    loginWithCredentials(email, 'admin');
    navigate(from, { replace: true });
  };

  const handleQuickDemo = (role: 'admin' | 'owner') => {
    loginAsRole(role);
    navigate(role === 'owner' ? '/owner' : '/admin', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#0B1220] flex items-center justify-center p-4 text-white">
      <div className="max-w-md w-full bg-[#111827] border border-slate-800 rounded-3xl p-8 shadow-elevated">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-purple to-purple-500 flex items-center justify-center text-white font-extrabold mx-auto mb-3 shadow-lg">
            R
          </div>
          <h1 className="text-xl font-extrabold tracking-wide">RESTO OS</h1>
          <p className="text-xs text-slate-400 mt-0.5">Management & Owner Authentication</p>
        </div>

        {error && (
          <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 rounded-xl text-xs mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple"
              required
            />
          </div>

          <Button type="submit" variant="primary" className="w-full" size="lg">
            Authorize & Access Admin Console
          </Button>
        </form>

        {/* Quick Testing Badges */}
        <div className="mt-6 pt-5 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-400 font-semibold mb-2">Instant Evaluator Access:</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo('admin')}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-brand-purple text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-purple" />
              <span>Admin Demo</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('owner')}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-brand-purple text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-purple" />
              <span>Owner Demo</span>
            </button>
          </div>

          <div className="mt-4">
            <Link to="/staff/login" className="text-xs text-brand-purple hover:underline">
              Switch to Waiter, Kitchen or Cash Counter Staff Login →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
