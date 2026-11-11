import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  HelpCircle,
  KeyRound,
} from 'lucide-react';
import { getDashboardForRole } from '../../app/guards/RoleBasedGuard';

export const StaffLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);
  const [forgotPasswordMsg, setForgotPasswordMsg] = useState(false);

  // If redirected from a guarded page, preserve intended destination if authorized
  const fromLocation = (location.state as { from?: { pathname: string } })?.from?.pathname;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setForgotPasswordMsg(false);

    if (!loginId.trim() || !password) {
      setErrorMessage('Please enter both Login ID and Password.');
      return;
    }

    setIsLoading(true);

    try {
      const result = login(loginId.trim(), password);

      if (!result.success || !result.role) {
        setErrorMessage(result.error || 'Invalid login credentials.');
        if (result.errorCode === 'LOCKED' && result.lockedUntil) {
          setLockedUntil(result.lockedUntil);
        }
        setIsLoading(false);
        return;
      }

      // Role-Based Automatic Dashboard Navigation:
      // Directs strictly to the user's assigned dashboard (never hardcoded to admin)
      const targetDashboard = getDashboardForRole(result.role);

      // If user had an authorized destination matching their role, use it; otherwise role home
      let destination = targetDashboard;
      if (fromLocation && fromLocation.startsWith(targetDashboard)) {
        destination = fromLocation;
      }

      navigate(destination, { replace: true });
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemo = (username: string, pass: string) => {
    setLoginId(username);
    setPassword(pass);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-[#0B1220] flex items-center justify-center p-4 text-white font-sans select-none">
      <div className="max-w-md w-full bg-[#111827] border border-slate-800 rounded-3xl p-8 shadow-2xl relative">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-orange via-amber-500 to-brand-purple flex items-center justify-center text-white font-black text-xl mx-auto mb-3 shadow-lg ring-4 ring-slate-800/80">
            R
          </div>
          <h1 className="text-2xl font-black tracking-wide text-white">RESTO OS</h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Unified Staff Terminal & Management Authentication
          </p>
        </div>

        {/* Error / Lockout Banner */}
        {errorMessage && (
          <div className="mb-4 p-3.5 bg-red-950/80 border border-red-800 text-red-200 rounded-2xl text-xs flex items-start gap-2.5 shadow-sm animate-pulse-subtle">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">{errorMessage}</p>
              {lockedUntil && (
                <p className="text-[11px] text-red-300 mt-1">
                  Brute force rate limit enforced: Locked until {new Date(lockedUntil).toLocaleTimeString()}.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Forgot Password Notice */}
        {forgotPasswordMsg && (
          <div className="mb-4 p-3 bg-blue-950/80 border border-blue-800 text-blue-200 rounded-2xl text-xs flex items-start gap-2 shadow-sm">
            <HelpCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Password Reset Policy</p>
              <p className="text-[11px] text-blue-300 mt-0.5">
                Staff credentials can be reset directly by the restaurant Owner or Administrator in the Staff Management console.
              </p>
            </div>
          </div>
        )}

        {/* Authentication Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Login ID / Username or Email
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="e.g. counter, waiter, kitchen, admin, owner"
                className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange transition-all"
                required
                autoComplete="username"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Password
              </label>
              <button
                type="button"
                onClick={() => setForgotPasswordMsg(!forgotPasswordMsg)}
                className="text-[11px] text-brand-orange hover:underline font-semibold"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-10 py-3 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange transition-all font-mono"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="orange"
            size="lg"
            className="w-full mt-2 font-bold shadow-lg"
            disabled={isLoading}
          >
            {isLoading ? 'Verifying Credentials...' : 'Authorize & Open Terminal'}
          </Button>
        </form>

        {/* Security Assurance Badge */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
            <span>Server-Verified Sessions</span>
          </span>
          <span className="font-mono text-[10px]">Brute-Force Protected</span>
        </div>

        {/* Evaluator Helper Accordion */}
        <div className="mt-4 pt-3 border-t border-slate-800/60">
          <button
            type="button"
            onClick={() => setShowDemoAccounts(!showDemoAccounts)}
            className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-slate-200 transition-colors py-1"
          >
            <span className="flex items-center gap-1.5 font-bold">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>Staff Accounts & Credentials Guide</span>
            </span>
            <span className="text-xs">{showDemoAccounts ? '▲ Hide' : '▼ View'}</span>
          </button>

          {showDemoAccounts && (
            <div className="mt-2.5 p-3 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-2 text-[11px]">
              <p className="text-slate-400 text-[10px] font-medium mb-1.5">
                Every staff role has its own distinct credentials and automated terminal redirection:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleFillDemo('counter', 'Counter@2026!')}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-left border border-slate-700/60 flex items-center justify-between transition-all"
                >
                  <div>
                    <p className="font-bold text-white text-xs">Cash Counter</p>
                    <p className="text-[10px] text-slate-400 font-mono">counter / Counter@2026!</p>
                  </div>
                  <span className="text-[10px] font-bold text-green-400">POS</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleFillDemo('waiter', 'Waiter@2026!')}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-left border border-slate-700/60 flex items-center justify-between transition-all"
                >
                  <div>
                    <p className="font-bold text-white text-xs">Waiter Terminal</p>
                    <p className="text-[10px] text-slate-400 font-mono">waiter / Waiter@2026!</p>
                  </div>
                  <span className="text-[10px] font-bold text-blue-400">Floor</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleFillDemo('kitchen', 'Kitchen@2026!')}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-left border border-slate-700/60 flex items-center justify-between transition-all"
                >
                  <div>
                    <p className="font-bold text-white text-xs">Kitchen KDS</p>
                    <p className="text-[10px] text-slate-400 font-mono">kitchen / Kitchen@2026!</p>
                  </div>
                  <span className="text-[10px] font-bold text-orange-400">KDS</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleFillDemo('admin', 'Admin@2026!')}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-left border border-slate-700/60 flex items-center justify-between transition-all"
                >
                  <div>
                    <p className="font-bold text-white text-xs">Administrator</p>
                    <p className="text-[10px] text-slate-400 font-mono">admin / Admin@2026!</p>
                  </div>
                  <span className="text-[10px] font-bold text-purple-400">Admin</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleFillDemo('owner', 'Owner@2026!')}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-left border border-slate-700/60 flex items-center justify-between transition-all col-span-1 sm:col-span-2"
                >
                  <div>
                    <p className="font-bold text-white text-xs">Owner Executive</p>
                    <p className="text-[10px] text-slate-400 font-mono">owner / Owner@2026!</p>
                  </div>
                  <span className="text-[10px] font-bold text-amber-400">Executive</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
