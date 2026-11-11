import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { Shield, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { getDashboardForRole } from '../../app/guards/RoleBasedGuard';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();

  const [loginId, setLoginId] = useState('admin@resto.os');
  const [password, setPassword] = useState('Admin@2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!loginId || !password) {
      setError('Please enter your login identifier and password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = login(loginId.trim(), password);
      if (!res.success || !res.role) {
        setError(res.error || 'Invalid username or password.');
        setIsLoading(false);
        return;
      }

      // Role-Based Automatic Redirection:
      const destination = from && from.startsWith(getDashboardForRole(res.role))
        ? from
        : getDashboardForRole(res.role);

      navigate(destination, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1220] flex items-center justify-center p-4 text-white font-sans select-none">
      <div className="max-w-md w-full bg-[#111827] border border-slate-800 rounded-3xl p-8 shadow-elevated">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-purple to-purple-500 flex items-center justify-center text-white font-extrabold mx-auto mb-3 shadow-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-extrabold tracking-wide">RESTO OS</h1>
          <p className="text-xs text-slate-400 mt-0.5">Management & Administrative Console Login</p>
        </div>

        {error && (
          <div className="p-3 bg-red-950/80 border border-red-800 text-red-200 rounded-xl text-xs mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Admin / Owner Login ID
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="admin@resto.os or owner@resto.os"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-9 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-purple font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" variant="primary" className="w-full mt-2" size="lg" disabled={isLoading}>
            {isLoading ? 'Verifying Credentials...' : 'Authorize & Open Dashboard'}
          </Button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800 text-center">
          <Link to="/staff/login" className="text-xs text-brand-purple hover:underline">
            Switch to General Staff Terminal Login (Waiter, Kitchen, Counter) →
          </Link>
        </div>
      </div>
    </div>
  );
};
