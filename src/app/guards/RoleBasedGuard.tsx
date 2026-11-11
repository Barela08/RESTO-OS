import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { StaffRoleType } from '../../types';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';

interface RoleBasedGuardProps {
  allowedRoles: StaffRoleType[];
  children: React.ReactNode;
}

export const getDashboardForRole = (role?: StaffRoleType | null): string => {
  switch (role) {
    case 'owner':
      return '/owner';
    case 'admin':
      return '/admin';
    case 'counter':
      return '/counter';
    case 'waiter':
      return '/waiter';
    case 'kitchen':
      return '/kitchen';
    default:
      return '/staff/login';
  }
};

export const RoleBasedGuard: React.FC<RoleBasedGuardProps> = ({ allowedRoles, children }) => {
  const { currentProfile, role, isAuthenticated, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  // 1. Unauthenticated: Redirect strictly to login
  if (!isAuthenticated || !currentProfile || !role) {
    return <Navigate to="/staff/login" state={{ from: location }} replace />;
  }

  // 2. Active status check: Deactivated staff cannot view any protected dashboard
  if (!currentProfile.is_active) {
    logout();
    return <Navigate to="/staff/login" state={{ error: 'Account deactivated. Contact administrator.' }} replace />;
  }

  // 3. Role Authorization Evaluation
  // Owner has universal administrative access
  const isOwner = role === 'owner';
  // Admin has access to admin modules and terminal supervision
  const isAdminAuthorized = role === 'admin' && allowedRoles.includes('admin');
  // Role specifically matching the required terminal
  const isDirectlyAuthorized = allowedRoles.includes(role);

  if (isOwner || isAdminAuthorized || isDirectlyAuthorized) {
    return <>{children}</>;
  }

  // 4. Unauthorized Access: Never redirect to Admin! Present clear 403 Forbidden
  const permittedDashboard = getDashboardForRole(role);

  return (
    <div className="min-h-screen bg-[#0B1220] flex items-center justify-center p-6 text-white text-center select-none font-sans">
      <div className="max-w-md w-full bg-[#111827] border border-red-900/40 rounded-3xl p-8 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4 text-2xl font-bold shadow-inner">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>

        <h2 className="text-xl font-black text-white mb-2">Access Restricted (403)</h2>
        <p className="text-xs text-slate-300 mb-2">
          Your active account (<span className="text-white font-bold">{currentProfile.full_name}</span>) is assigned the role:
        </p>
        <div className="inline-block px-3 py-1 rounded-full bg-brand-purple/20 border border-brand-purple/30 text-brand-purple font-extrabold text-xs uppercase tracking-wider mb-5">
          {role}
        </div>

        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          You do not have authorization to view this operational console. Every staff member must remain inside their assigned workspace.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={() => navigate(permittedDashboard, { replace: true })}
            className="w-full py-2.5 px-4 rounded-xl bg-brand-orange hover:bg-orange-600 active:scale-95 text-xs font-bold text-white transition-all shadow-md flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to My Dashboard</span>
          </button>

          <button
            onClick={() => {
              logout();
              navigate('/staff/login', { replace: true });
            }}
            className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs font-bold text-slate-300 transition-all flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-400" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
