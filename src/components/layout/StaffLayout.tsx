import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Volume2, VolumeX, LogOut, ArrowLeft, RefreshCw } from 'lucide-react';
import { audioService } from '../../services/audioService';
import { useAuthStore } from '../../store/authStore';

interface StaffLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  activeRole: 'waiter' | 'kitchen' | 'counter';
}

export const StaffLayout: React.FC<StaffLayoutProps> = ({
  title,
  subtitle,
  children,
  actions,
  activeRole,
}) => {
  const navigate = useNavigate();
  const { currentProfile, logout } = useAuthStore();
  const [isMuted, setIsMuted] = useState(audioService.getIsMuted());

  const toggleSound = () => {
    const next = !isMuted;
    audioService.setMuted(next);
    setIsMuted(next);
  };

  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100 flex flex-col font-sans">
      {/* Top Bar for Staff Operations */}
      <header className="h-16 bg-[#111827] border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-4">
          <Link
            to="/admin"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Back to Admin Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-white tracking-wide">{title}</h1>
              <span className="px-2 py-0.5 rounded-full bg-brand-purple/20 text-brand-purple text-[10px] font-bold uppercase tracking-wider">
                {activeRole}
              </span>
            </div>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {actions}

          <button
            onClick={() => window.location.reload()}
            title="Refresh State"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={toggleSound}
            title={isMuted ? 'Unmute Audio Chimes' : 'Mute Audio Chimes'}
            className={`p-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors ${
              isMuted
                ? 'bg-red-950/80 text-red-400 border border-red-800'
                : 'bg-slate-800 text-green-400 border border-slate-700'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span className="hidden sm:inline font-semibold text-[11px]">{isMuted ? 'Muted' : 'Sound ON'}</span>
          </button>

          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-800 text-xs">
            <span className="text-slate-300 font-semibold">{currentProfile?.full_name || 'Staff User'}</span>
          </div>

          <button
            onClick={() => {
              logout();
              navigate('/staff/login');
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-red-900/60 text-slate-400 hover:text-red-300 transition-colors"
            title="Staff Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Staff Interactive Display */}
      <main className="flex-1 p-4 md:p-6 overflow-y-auto max-w-7xl w-full mx-auto">
        {children}
      </main>
    </div>
  );
};
