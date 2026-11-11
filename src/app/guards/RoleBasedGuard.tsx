import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { StaffRoleType } from '../../types';

interface RoleBasedGuardProps {
  allowedRoles: StaffRoleType[];
  children: React.ReactNode;
}

export const RoleBasedGuard: React.FC<RoleBasedGuardProps> = ({ allowedRoles, children }) => {
  const { currentProfile, role, isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated || !currentProfile) {
    const isOwnerOrAdmin = allowedRoles.includes('admin') || allowedRoles.includes('owner');
    return <Navigate to={isOwnerOrAdmin ? '/admin/login' : '/staff/login'} state={{ from: location }} replace />;
  }

  // Admin has access to all operational views
  if (role === 'admin' || (role && allowedRoles.includes(role))) {
    return <>{children}</>;
  }

  // If user role doesn't match allowed roles
  return (
    <div className="min-h-screen bg-[#0B1220] flex items-center justify-center p-6 text-white text-center">
      <div className="max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-elevated">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
          !
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
        <p className="text-xs text-slate-400 mb-6">
          Your current account role (<span className="text-brand-purple font-semibold">{role}</span>) does not have authorization to view this operational module.
        </p>
        <button
          onClick={() => window.history.back()}
          className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
        >
          Return to Permitted View
        </button>
      </div>
    </div>
  );
};
