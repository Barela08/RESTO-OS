import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  UtensilsCrossed,
  QrCode,
  Users,
  CreditCard,
  ChefHat,
  Award,
  Package,
  TrendingUp,
  Settings,
  Bell,
  Volume2,
  VolumeX,
  LogOut,
  Menu,
  X,
  FileText,
  UserCheck,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { audioService } from '../../services/audioService';
import { dbAdapter } from '../../services/databaseAdapter';
import { StaffRoleType } from '../../types';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentProfile, role, logout, loginAsRole } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(audioService.getIsMuted());
  const [activeRequestsCount, setActiveRequestsCount] = useState(0);

  useEffect(() => {
    const updateCounts = () => {
      const pendingScans = dbAdapter.getRepeatScanRequests().filter(r => r.status === 'PENDING').length;
      const pendingCalls = dbAdapter.getWaiterCalls().filter(c => c.status === 'PENDING').length;
      setActiveRequestsCount(pendingScans + pendingCalls);
    };
    updateCounts();
    return dbAdapter.subscribe(updateCounts);
  }, []);

  const navItems: NavItem[] = [
    { label: 'Overview', href: '/admin', icon: LayoutDashboard },
    { label: 'Live Floor & Tables', href: '/admin/tables', icon: UtensilsCrossed },
    { label: 'Daily QR Manager', href: '/admin/qr', icon: QrCode, badge: activeRequestsCount > 0 ? activeRequestsCount : undefined },
    { label: 'Menu & Dishes', href: '/admin/menu', icon: Menu },
    { label: 'Kitchen Display (KDS)', href: '/kitchen', icon: ChefHat },
    { label: 'Waiter Station', href: '/waiter', icon: UserCheck },
    { label: 'Cash Counter / POS', href: '/counter', icon: CreditCard },
    { label: 'Invoices & Payments', href: '/admin/payments', icon: FileText },
    { label: 'Loyalty & Rewards', href: '/admin/loyalty', icon: Award },
    { label: 'Inventory & Stock', href: '/admin/inventory', icon: Package },
    { label: 'Staff Management', href: '/admin/staff', icon: Users },
    { label: 'Owner Analytics', href: '/owner', icon: TrendingUp },
    { label: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  const toggleSound = () => {
    const next = !isMuted;
    audioService.setMuted(next);
    setIsMuted(next);
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedRole = e.target.value as StaffRoleType;
    loginAsRole(selectedRole);
    if (selectedRole === 'kitchen') navigate('/kitchen');
    else if (selectedRole === 'waiter') navigate('/waiter');
    else if (selectedRole === 'counter') navigate('/counter');
    else if (selectedRole === 'owner') navigate('/owner');
    else navigate('/admin');
  };

  return (
    <div className="min-h-screen bg-[#F7F8FC] flex text-slate-900 font-sans">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation (Dark Navy #0B1220) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#0B1220] text-slate-300 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
          <Link to="/admin" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-purple to-purple-500 flex items-center justify-center text-white font-extrabold shadow-md">
              R
            </div>
            <div>
              <h1 className="font-bold text-white text-base tracking-wide flex items-center gap-1.5">
                RESTO <span className="text-brand-purple">OS</span>
              </h1>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Restaurant Operations</span>
            </div>
          </Link>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Role Switcher Banner */}
        <div className="px-4 py-3 bg-slate-900/60 border-b border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Current Role</span>
            <span className="px-1.5 py-0.5 rounded bg-brand-purple/20 text-brand-purple text-[10px] uppercase font-bold">
              {role || 'staff'}
            </span>
          </div>
          <select
            value={role || 'admin'}
            onChange={handleRoleChange}
            className="w-full bg-slate-800 text-xs text-white rounded-lg px-2.5 py-1.5 border border-slate-700 focus:outline-none focus:border-brand-purple"
          >
            <option value="admin">Admin Dashboard</option>
            <option value="owner">Owner Analytics</option>
            <option value="counter">Cash Counter (POS)</option>
            <option value="kitchen">Kitchen Display (KDS)</option>
            <option value="waiter">Waiter Station</option>
          </select>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-brand-purple text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-brand-orange text-white font-bold animate-pulse">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-white text-xs">
              {currentProfile?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="truncate max-w-[110px]">
              <p className="font-semibold text-white truncate">{currentProfile?.full_name || 'Staff'}</p>
              <p className="text-[10px] text-slate-400 truncate">{currentProfile?.email || 'Logged in'}</p>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/admin/login');
            }}
            title="Sign Out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200/80 sticky top-0 z-30 px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span>Resto OS</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-900 capitalize">
                {location.pathname.replace('/admin', 'Admin').replace('/', ' • ') || 'Admin'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Audio Synth Mute Toggle */}
            <button
              onClick={toggleSound}
              title={isMuted ? 'Unmute Real-Time Chimes' : 'Mute Real-Time Chimes'}
              className={`p-2 rounded-xl border text-xs flex items-center gap-1.5 transition-colors ${
                isMuted
                  ? 'border-red-200 bg-red-50 text-red-600'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span className="hidden md:inline font-semibold">{isMuted ? 'Muted' : 'Sound Active'}</span>
            </button>

            {/* Quick Customer Website preview link */}
            <Link
              to="/order"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200 text-brand-orange text-xs font-semibold hover:bg-orange-100 transition-colors flex items-center gap-1.5"
            >
              <span>Customer View</span>
            </Link>

            {/* Bell Alert Drawer Indicator */}
            <button
              onClick={() => navigate('/admin/qr')}
              className="relative p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
              title="Notifications & Repeat Scans"
            >
              <Bell className="w-4 h-4" />
              {activeRequestsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center animate-bounce">
                  {activeRequestsCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
