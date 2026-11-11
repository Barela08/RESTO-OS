import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSessionStore } from '../../store/sessionStore';
import { useCartStore } from '../../store/cartStore';
import { useCustomerAuthStore } from '../../store/customerAuthStore';
import { dbAdapter } from '../../services/databaseAdapter';
import { formatCurrency } from '../../utils/currency';
import { WaiterCall } from '../../types';
import {
  Home,
  UtensilsCrossed,
  Clock,
  ShoppingBag,
  User,
  Sparkles,
  PhoneCall,
  Receipt,
  Award,
  CheckCircle2,
  LogOut,
  ChevronDown,
  Droplets,
  QrCode,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export const CustomerLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const { table, currentSession, isVerified } = useSessionStore();
  const { getItemCount, getTotal } = useCartStore();
  const { customer, isLoggedIn, logout } = useCustomerAuthStore();
  const restaurant = dbAdapter.getRestaurant();

  // Assistance Modal state
  const [isAssistanceModalOpen, setIsAssistanceModalOpen] = useState(false);
  const [assistanceType, setAssistanceType] = useState<'CALL_WAITER' | 'REQUEST_BILL' | 'WATER'>('CALL_WAITER');
  const [assistanceSent, setAssistanceSent] = useState(false);
  const [assistanceNotes, setAssistanceNotes] = useState('');

  // Table Session Security Modal (view-only / guidance)
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);

  // Desktop Profile Dropdown state
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  // Active waiter call for current table session
  const [activeCall, setActiveCall] = useState<WaiterCall | undefined>(() =>
    currentSession ? dbAdapter.getActiveWaiterCallForSession(currentSession.id) : undefined
  );

  useEffect(() => {
    const checkActiveCall = () => {
      if (currentSession) {
        setActiveCall(dbAdapter.getActiveWaiterCallForSession(currentSession.id));
      } else {
        setActiveCall(undefined);
      }
    };
    checkActiveCall();
    return dbAdapter.subscribe(checkActiveCall);
  }, [currentSession]);

  const itemCount = getItemCount();
  const cartTotal = getTotal();

  const handleSendAssistance = () => {
    if (!currentSession) {
      setIsTableModalOpen(true);
      return;
    }
    // Prevent duplicate calls if one is active
    if (assistanceType === 'CALL_WAITER' && activeCall) {
      setIsAssistanceModalOpen(false);
      return;
    }
    dbAdapter.createServiceRequest({
      tableSessionId: currentSession.id,
      requestType: assistanceType,
      notes: assistanceNotes || undefined,
    });
    setAssistanceSent(true);
    setTimeout(() => {
      setAssistanceSent(false);
      setIsAssistanceModalOpen(false);
      setAssistanceNotes('');
    }, 1800);
  };

  const handleCancelCall = (callId: string) => {
    dbAdapter.cancelWaiterCall(callId);
  };

  // Nav Links Configuration
  const navItems = [
    { label: 'Home', path: '/home', icon: Home, aliases: ['/'] },
    { label: 'Menu', path: '/menu', icon: UtensilsCrossed, aliases: ['/order'] },
    { label: 'My Orders', path: '/orders', icon: Clock, aliases: ['/my-orders'] },
    { label: 'My Bag', path: '/bag', icon: ShoppingBag, badge: itemCount, aliases: ['/cart'] },
    { label: 'Profile', path: '/profile', icon: User, aliases: ['/account'] },
  ];

  const isCurrentActive = (itemPath: string, aliases?: string[]) => {
    if (location.pathname === itemPath) return true;
    if (aliases && aliases.includes(location.pathname)) return true;
    return false;
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-800 flex flex-col font-sans pb-24 lg:pb-8">
      {/* ============================================================== */}
      {/* 1. DESKTOP PROFESSIONAL NAVIGATION HEADER (lg:flex)            */}
      {/* ============================================================== */}
      <header className="hidden lg:block bg-white border-b border-orange-100/90 sticky top-0 z-40 shadow-sm backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-6">
          {/* Brand Logo & Name */}
          <Link to="/home" className="flex items-center gap-3.5 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-orange to-amber-500 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 text-lg tracking-tight">
                  {restaurant.name}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-brand-orange px-2 py-0.5 rounded-full">
                  Dining OS
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">{restaurant.tagline || 'Artisanal Flavors & Smart Dining'}</p>
            </div>
          </Link>

          {/* Center Navigation Links */}
          <nav className="flex items-center gap-1.5 bg-slate-50/80 p-1.5 rounded-2xl border border-slate-200/60">
            <Link
              to="/home"
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                isCurrentActive('/home', ['/'])
                  ? 'bg-white text-brand-orange shadow-sm border border-orange-100'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </Link>

            <Link
              to="/menu"
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                isCurrentActive('/menu', ['/order'])
                  ? 'bg-white text-brand-orange shadow-sm border border-orange-100'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>Menu</span>
            </Link>

            <Link
              to="/orders"
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                isCurrentActive('/orders', ['/my-orders'])
                  ? 'bg-white text-brand-orange shadow-sm border border-orange-100'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>My Orders</span>
            </Link>

            <Link
              to="/my-rewards"
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                isCurrentActive('/my-rewards')
                  ? 'bg-white text-brand-orange shadow-sm border border-orange-100'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Award className="w-4 h-4 text-amber-500" />
              <span>My Rewards</span>
            </Link>

            <Link
              to="/bag"
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 relative ${
                isCurrentActive('/bag', ['/cart'])
                  ? 'bg-white text-brand-orange shadow-sm border border-orange-100'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>My Bag</span>
              {itemCount > 0 && (
                <span className="bg-brand-orange text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full min-w-4 text-center">
                  {itemCount}
                </span>
              )}
            </Link>
          </nav>

          {/* Right Header Actions: Table Badge, Call Waiter, Profile */}
          <div className="flex items-center gap-3">
            {/* Table Verified Status Badge */}
            {isVerified && table ? (
              <button
                onClick={() => setIsTableModalOpen(true)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200/80 hover:bg-orange-100 transition-colors text-left"
                title="View verified table session"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                <div>
                  <p className="text-xs font-extrabold text-slate-900 leading-tight">
                    Table {table.table_number}
                  </p>
                  <p className="text-[10px] text-amber-800 font-medium">{table.floor_area}</p>
                </div>
              </button>
            ) : (
              <button
                onClick={() => setIsTableModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold hover:bg-amber-100 transition-colors"
                title="Table QR Required"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Scan Table QR</span>
              </button>
            )}

            {/* Quick Call Waiter Button */}
            <button
              onClick={() => {
                setAssistanceType('CALL_WAITER');
                setIsAssistanceModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-brand-orange border border-orange-200 text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Call Waiter</span>
            </button>

            {/* Quick Request Bill Button */}
            <button
              onClick={() => {
                setAssistanceType('REQUEST_BILL');
                setIsAssistanceModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Request Bill</span>
            </button>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center gap-2.5 p-1.5 pr-3 rounded-2xl border border-slate-200 hover:border-slate-300 bg-white transition-all shadow-sm"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white font-extrabold flex items-center justify-center text-xs shadow-inner">
                  {customer?.full_name ? customer.full_name.charAt(0).toUpperCase() : 'G'}
                </div>
                <div className="text-left hidden xl:block">
                  <p className="text-xs font-extrabold text-slate-900 leading-tight">
                    {isLoggedIn && customer ? customer.full_name : 'Guest Customer'}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {isLoggedIn && customer ? customer.phone : 'Tap to Login'}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isProfileDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-elevated border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                  onClick={() => setIsProfileDropdownOpen(false)}
                >
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900">
                      {isLoggedIn && customer ? customer.full_name : 'Guest User'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {isLoggedIn && customer ? customer.phone : 'Login for loyalty stamps & saved orders'}
                    </p>
                  </div>

                  <Link
                    to="/profile"
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-orange-50 hover:text-brand-orange"
                  >
                    <User className="w-4 h-4" />
                    <span>My Account Profile</span>
                  </Link>

                  <Link
                    to="/orders"
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-orange-50 hover:text-brand-orange"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Previous Orders</span>
                  </Link>

                  <Link
                    to="/my-rewards"
                    className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-orange-50 hover:text-brand-orange"
                  >
                    <Award className="w-4 h-4 text-amber-500" />
                    <span>Loyalty Stamps & Rewards</span>
                  </Link>

                  {isLoggedIn ? (
                    <button
                      onClick={logout}
                      className="w-full text-left flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 border-t border-slate-100 mt-1"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Log Out</span>
                    </button>
                  ) : (
                    <Link
                      to="/profile"
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-brand-orange hover:bg-orange-50 border-t border-slate-100 mt-1"
                    >
                      <User className="w-4 h-4" />
                      <span>Sign In with OTP</span>
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. MOBILE APP-LIKE COMPACT HEADER (< lg:hidden)                */}
      {/* ============================================================== */}
      <header className="lg:hidden bg-white border-b border-orange-100/90 sticky top-0 z-30 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <Link to="/home" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-orange to-amber-500 flex items-center justify-center text-white font-extrabold shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-extrabold text-slate-900 text-sm tracking-tight leading-tight">
                {restaurant.name}
              </h1>
              <p className="text-[10px] text-amber-800 font-medium">Smart Dining Experience</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {/* Call Waiter Quick Trigger */}
            <button
              onClick={() => {
                setAssistanceType('CALL_WAITER');
                setIsAssistanceModalOpen(true);
              }}
              className="p-2 rounded-xl bg-orange-50 border border-orange-200 text-brand-orange hover:bg-orange-100 transition-colors"
              title="Call Waiter"
            >
              <PhoneCall className="w-4 h-4" />
            </button>

            {/* Quick Rewards Link */}
            <Link
              to="/my-rewards"
              className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors"
              title="Loyalty Rewards"
            >
              <Award className="w-4 h-4" />
            </Link>

            {/* Bag Icon with count badge */}
            <Link
              to="/bag"
              className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors relative"
              title="Cart"
            >
              <ShoppingBag className="w-4 h-4" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand-orange text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded-full">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Mobile Verified Table Status Bar */}
        <div
          onClick={() => setIsTableModalOpen(true)}
          className="bg-gradient-to-r from-orange-600 to-amber-600 text-white px-4 py-1.5 text-xs cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="font-bold tracking-wide">
              {isVerified && table ? `Table ${table.table_number}` : 'Guest Preview Mode'}
            </span>
            {table && <span className="opacity-80">({table.floor_area})</span>}
          </div>
          <span className="text-[10px] font-bold bg-black/25 px-2 py-0.5 rounded-full">
            {isVerified ? 'Session Active' : 'Scan Table QR'}
          </span>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 3. MAIN CONTENT CONTAINER (RESPONSIVE)                         */}
      {/* ============================================================== */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Realtime Waiter Call Live Status Banner */}
        {activeCall && (
          <div className="mb-6 bg-white border-2 border-orange-200 rounded-3xl p-4 sm:p-5 shadow-card transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-orange-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-100 text-brand-orange flex items-center justify-center font-bold shrink-0">
                  <PhoneCall className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-orange-100 text-brand-orange px-2 py-0.5 rounded-full">
                      Live Waiter Assistance
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      ID: {activeCall.id.slice(0, 14)}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">
                    {['REQUESTED', 'SENT', 'PENDING'].includes(activeCall.status)
                      ? `Waiter request sent for Table ${table?.table_number || ''}`
                      : ['ACCEPTED', 'ACKNOWLEDGED'].includes(activeCall.status)
                      ? `Server accepted your request!`
                      : ['ON_THE_WAY', 'IN_PROGRESS'].includes(activeCall.status)
                      ? `Server is on the way to your table!`
                      : activeCall.status === 'ARRIVED'
                      ? `Server has arrived at Table ${table?.table_number || ''}!`
                      : `Assistance completed`}
                  </h3>
                </div>
              </div>

              {activeCall.status !== 'COMPLETED' && activeCall.status !== 'ARRIVED' && (
                <button
                  onClick={() => handleCancelCall(activeCall.id)}
                  className="text-xs font-bold text-slate-500 hover:text-red-600 transition-colors self-end sm:self-auto py-1 px-2.5 rounded-lg hover:bg-red-50 border border-slate-200"
                >
                  Cancel Call
                </button>
              )}
            </div>

            {/* Visual 4-Step Progress Bar */}
            <div className="mt-4 pt-1">
              <div className="grid grid-cols-4 gap-2 text-center">
                {/* Step 1: Request Sent */}
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    ['REQUESTED', 'SENT', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'COMPLETED', 'PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(activeCall.status)
                      ? 'bg-brand-orange text-white ring-4 ring-orange-100'
                      : 'bg-slate-100 text-slate-400'
                  }`}>
                    1
                  </div>
                  <span className="text-[11px] font-extrabold text-slate-800 mt-1.5 leading-tight">Request Sent</span>
                  <span className="text-[9px] text-slate-400">Server alerted</span>
                </div>

                {/* Step 2: Accepted */}
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    ['ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'COMPLETED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(activeCall.status)
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                      : 'bg-slate-100 text-slate-400'
                  }`}>
                    2
                  </div>
                  <span className="text-[11px] font-extrabold text-slate-800 mt-1.5 leading-tight">Accepted</span>
                  <span className="text-[9px] text-slate-400">{activeCall.assigned_waiter_name || 'Server'}</span>
                </div>

                {/* Step 3: On The Way */}
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    ['ON_THE_WAY', 'ARRIVED', 'COMPLETED', 'IN_PROGRESS'].includes(activeCall.status)
                      ? 'bg-purple-600 text-white ring-4 ring-purple-100'
                      : 'bg-slate-100 text-slate-400'
                  }`}>
                    3
                  </div>
                  <span className="text-[11px] font-extrabold text-slate-800 mt-1.5 leading-tight">On The Way</span>
                  <span className="text-[9px] text-slate-400">Walking to table</span>
                </div>

                {/* Step 4: Arrived */}
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    ['ARRIVED', 'COMPLETED'].includes(activeCall.status)
                      ? 'bg-green-600 text-white ring-4 ring-green-100'
                      : 'bg-slate-100 text-slate-400'
                  }`}>
                    4
                  </div>
                  <span className="text-[11px] font-extrabold text-slate-800 mt-1.5 leading-tight">Arrived</span>
                  <span className="text-[9px] text-slate-400">At Table {table?.table_number || ''}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {children}
      </main>

      {/* ============================================================== */}
      {/* 4. MOBILE FLOATING CART BAR (WHEN ITEMS IN CART ON MOBILE)     */}
      {/* ============================================================== */}
      {itemCount > 0 &&
        !location.pathname.includes('/bag') &&
        !location.pathname.includes('/cart') &&
        !location.pathname.includes('/order/payment') && (
          <div className="lg:hidden fixed bottom-20 left-0 right-0 z-40 px-4 max-w-md mx-auto">
            <Link
              to="/bag"
              className="w-full bg-brand-orange hover:bg-brand-orange-dark text-white rounded-2xl p-3.5 shadow-elevated flex items-center justify-between transition-all transform active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-orange-100">
                    {itemCount} {itemCount === 1 ? 'Item' : 'Items'} selected
                  </p>
                  <p className="text-base font-extrabold">{formatCurrency(cartTotal)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 font-bold text-xs bg-white/20 px-3.5 py-2 rounded-xl">
                <span>View Bag</span>
              </div>
            </Link>
          </div>
        )}

      {/* ============================================================== */}
      {/* 5. MOBILE BOTTOM NAVIGATION BAR (FIXED, 5 ITEMS)               */}
      {/* ============================================================== */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-lg safe-bottom">
        <div className="max-w-md mx-auto px-2 py-1.5 flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isCurrentActive(item.path, item.aliases);
            return (
              <Link
                key={item.label}
                to={item.path}
                className={`flex-1 py-1 flex flex-col items-center justify-center relative transition-all ${
                  active ? 'text-brand-orange' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5px]' : 'stroke-[1.8px]'}`} />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-brand-orange text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded-full min-w-4 text-center shadow-sm">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] mt-0.5 tracking-tight ${active ? 'font-extrabold' : 'font-medium'}`}>
                  {item.label}
                </span>
                {active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-orange mt-0.5" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ============================================================== */}
      {/* 6. TABLE SERVICE & ASSISTANCE MODAL                            */}
      {/* ============================================================== */}
      <Modal
        isOpen={isAssistanceModalOpen}
        onClose={() => setIsAssistanceModalOpen(false)}
        title="Table Service & Assistance"
        description={table ? `Assisting Table ${table.table_number}` : 'Dining Table Assistance'}
      >
        {assistanceSent ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-2 animate-bounce" />
            <h4 className="font-bold text-slate-900 text-base">Request Dispatched!</h4>
            <p className="text-xs text-slate-500 mt-1">
              Your server and front desk have been alerted for Table {table?.table_number}.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Select the service you require. Our team and smart voice announcements will alert the floor staff immediately:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setAssistanceType('CALL_WAITER')}
                className={`p-3.5 rounded-xl border flex sm:flex-col items-center gap-3 text-left sm:text-center transition-all ${
                  assistanceType === 'CALL_WAITER'
                    ? 'border-brand-orange bg-orange-50/70 ring-2 ring-brand-orange/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-brand-orange flex items-center justify-center">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Call Waiter</p>
                  <p className="text-[10px] text-slate-500">Recommendations or help</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAssistanceType('REQUEST_BILL')}
                className={`p-3.5 rounded-xl border flex sm:flex-col items-center gap-3 text-left sm:text-center transition-all ${
                  assistanceType === 'REQUEST_BILL'
                    ? 'border-brand-orange bg-orange-50/70 ring-2 ring-brand-orange/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Request Bill</p>
                  <p className="text-[10px] text-slate-500">Pay via UPI or Cash</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAssistanceType('WATER')}
                className={`p-3.5 rounded-xl border flex sm:flex-col items-center gap-3 text-left sm:text-center transition-all ${
                  assistanceType === 'WATER'
                    ? 'border-brand-orange bg-orange-50/70 ring-2 ring-brand-orange/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Droplets className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Water / Cutlery</p>
                  <p className="text-[10px] text-slate-500">Refill or clean table</p>
                </div>
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Optional note for staff:
              </label>
              <input
                type="text"
                value={assistanceNotes}
                onChange={(e) => setAssistanceNotes(e.target.value)}
                placeholder="e.g., extra glasses, need baby chair..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-brand-orange"
              />
            </div>

            <Button
              className="w-full mt-2"
              variant="orange"
              onClick={handleSendAssistance}
            >
              Submit Service Alert
            </Button>
          </div>
        )}
      </Modal>

      {/* ============================================================== */}
      {/* 7. VERIFIED TABLE SESSION & SECURITY MODAL (READ-ONLY)         */}
      {/* ============================================================== */}
      <Modal
        isOpen={isTableModalOpen}
        onClose={() => setIsTableModalOpen(false)}
        title={isVerified && table ? `Table ${table.table_number} Verified` : 'Scan Table QR Standee'}
        description={isVerified && table ? `${table.floor_area} • Cryptographically Locked Session` : 'Dining table scan required to order food or call service'}
      >
        {isVerified && table ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-green-50 border border-green-200 text-green-900 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <h4 className="font-bold text-sm">Table Connection Locked & Verified</h4>
              </div>
              <p className="text-xs text-green-800 leading-relaxed">
                Your device is cryptographically paired to <strong className="font-extrabold">Table {table.table_number} ({table.floor_area})</strong>.
                All orders, kitchen tickets, and bill settlements will be strictly routed to this table.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500 font-semibold block text-[10px]">SEATING CAPACITY</span>
                <span className="font-bold text-slate-800">{table.seating_capacity} Guests</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block text-[10px]">FLOOR SECTION</span>
                <span className="font-bold text-slate-800">{table.floor_area}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block text-[10px]">SESSION ID</span>
                <span className="font-mono text-[11px] text-slate-700">{currentSession?.id.slice(0, 14)}...</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block text-[10px]">SECURITY LEVEL</span>
                <span className="font-bold text-emerald-600">Tamper-Proof QR</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed">
              <strong>Need to move tables?</strong> For security and billing accuracy, table switching cannot be done manually. Please scan the physical QR standee at your new table to transfer your session.
            </div>

            <Button
              className="w-full"
              variant="outline"
              onClick={() => setIsTableModalOpen(false)}
            >
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-4 text-center py-2">
            <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto shadow-inner">
              <QrCode className="w-8 h-8" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-base">You are in Guest Preview Mode</h4>
              <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto leading-relaxed">
                You can browse the complete restaurant menu and explore dishes. To place an order, call a waiter, or request the bill, please scan the permanent QR standee located at your dining table.
              </p>
            </div>

            <div className="p-3.5 bg-orange-50 rounded-2xl border border-orange-200 text-left text-xs text-orange-950 space-y-1.5">
              <p className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-brand-orange" />
                <span>How to connect your table:</span>
              </p>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-orange-900 pl-1">
                <li>Locate the QR standee on your dining table.</li>
                <li>Open your smartphone camera or QR reader.</li>
                <li>Scan the QR code to instantly unlock ordering for your table.</li>
              </ol>
            </div>

            <Button
              className="w-full"
              variant="orange"
              onClick={() => setIsTableModalOpen(false)}
            >
              Continue Browsing Menu
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};
