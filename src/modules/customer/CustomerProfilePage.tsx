import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCustomerAuthStore } from '../../store/customerAuthStore';
import { useSessionStore } from '../../store/sessionStore';
import { dbAdapter } from '../../services/databaseAdapter';
import { formatCurrency } from '../../utils/currency';
import { formatDate, formatTime } from '../../utils/date';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { OrderStatusBadge } from '../../components/ui/Badge';
import { QRService } from '../../services/qrService';
import {
  User,
  Phone,
  Award,
  Clock,
  CreditCard,
  Heart,
  MessageSquare,
  LogOut,
  Sparkles,
  CheckCircle2,
  Lock,
  ChevronRight,
  ShieldCheck,
  Edit2,
  Gift,
  HelpCircle,
  Receipt,
  Star,
  PhoneCall,
  AlertCircle,
  FileText,
  Copy,
  Check,
} from 'lucide-react';

type ProfileTab = 'PROFILE' | 'ORDERS' | 'REWARDS' | 'PAYMENTS' | 'FEEDBACK' | 'SUPPORT';

export const CustomerProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { currentSession, table } = useSessionStore();
  const {
    customer,
    loyaltyAccount,
    rewards,
    isLoggedIn,
    lookupAndRecognize,
    requestOtp,
    verifyOtp,
    completeRegistration,
    updateProfileName,
    logout,
    refreshLoyaltyData,
    activeOtpCode,
  } = useCustomerAuthStore();

  const restaurant = dbAdapter.getRestaurant();
  const settings = dbAdapter.getSettings();

  // Active Tab for Desktop (and mobile switcher)
  const [activeTab, setActiveTab] = useState<ProfileTab>('PROFILE');

  // Login & Registration state
  const [loginPhone, setLoginPhone] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [isOtpStep, setIsOtpStep] = useState(false);
  const [isNewUserStep, setIsNewUserStep] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // Edit Profile Name Modal state
  const [isEditNameModalOpen, setIsEditNameModalOpen] = useState(false);
  const [editedName, setEditedName] = useState(customer?.full_name || '');

  // Change Phone Modal state (requires OTP)
  const [isChangePhoneModalOpen, setIsChangePhoneModalOpen] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [changePhoneOtp, setChangePhoneOtp] = useState('');
  const [isChangePhoneOtpSent, setIsChangePhoneOtpSent] = useState(false);

  // Claim Reward Modal state
  const [selectedRewardToClaim, setSelectedRewardToClaim] = useState<any>(null);
  const [claimedCode, setClaimedCode] = useState<string | null>(null);
  const [claimQrUrl, setClaimQrUrl] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Feedback State
  const [foodRating, setFoodRating] = useState(5);
  const [serviceRating, setServiceRating] = useState(5);
  const [ambienceRating, setAmbienceRating] = useState(5);
  const [feedbackComments, setFeedbackComments] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Load customer orders and payments
  const allOrders = dbAdapter.getOrders();
  const customerOrders = customer
    ? allOrders.filter((o) => o.customer_phone === customer.phone)
    : [];
  const customerInvoices = customer
    ? dbAdapter.getInvoices().filter((i) => i.customer_phone === customer.phone)
    : [];

  const totalSpent = customerOrders.reduce((sum, o) => sum + o.total_amount, 0);

  // Auto-recognition when phone number is typed
  const handlePhoneInputChange = (val: string) => {
    setLoginPhone(val);
    const clean = val.replace(/\D/g, '');
    if (clean.length === 10) {
      const existingCheck = lookupAndRecognize(val);
      if (existingCheck.isExisting && existingCheck.isTrusted && existingCheck.customer) {
        setAuthSuccess(`Welcome back, ${existingCheck.customer.full_name}! Your profile and rewards have been recognized.`);
        refreshLoyaltyData();
        return;
      }
      if (existingCheck.isExisting && !existingCheck.isTrusted) {
        const res = requestOtp(val);
        if (res.success) {
          setIsOtpStep(true);
          setAuthSuccess('Existing account detected. For your security, enter the 6-digit OTP.');
          if (res.otpCode) setLoginOtp(res.otpCode);
        }
      }
    }
  };

  // Handle Send OTP & Returning Customer Recognition (Bug 4)
  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    if (!loginPhone.trim()) {
      setAuthError('Please enter a valid 10-digit mobile number.');
      return;
    }

    // Check if phone is an existing registered customer
    const existingCheck = lookupAndRecognize(loginPhone);
    if (existingCheck.isExisting && existingCheck.isTrusted && existingCheck.customer) {
      setAuthSuccess(`Welcome back, ${existingCheck.customer.full_name}! Your profile and rewards have been recognized.`);
      refreshLoyaltyData();
      return;
    }

    if (existingCheck.isExisting && !existingCheck.isTrusted) {
      const res = requestOtp(loginPhone);
      if (res.success) {
        setIsOtpStep(true);
        setAuthSuccess('Existing customer. Security OTP sent to your mobile.');
        if (res.otpCode) setLoginOtp(res.otpCode);
      }
      return;
    }

    // New customer phone number -> prompt for name & OTP verification
    const res = requestOtp(loginPhone);
    if (res.success) {
      setIsOtpStep(true);
      setAuthSuccess(res.message);
      if (res.otpCode) {
        setLoginOtp(res.otpCode);
      }
    } else {
      setAuthError(res.message);
    }
  };

  // Handle Verify OTP
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    if (!loginOtp.trim()) {
      setAuthError('Please enter the 6-digit OTP code.');
      return;
    }

    const res = verifyOtp(loginPhone, loginOtp);
    if (!res.success) {
      setAuthError(res.message);
      return;
    }

    if (res.isExistingCustomer) {
      setAuthSuccess(res.message);
      setIsOtpStep(false);
    } else {
      // New customer flow
      setIsNewUserStep(true);
      setAuthSuccess('Mobile number verified! Enter your full name to complete registration.');
    }
  };

  // Handle Complete Registration
  const handleCompleteRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) {
      setAuthError('Please enter your full name.');
      return;
    }
    completeRegistration(loginPhone, newUserName.trim());
    setIsNewUserStep(false);
    setIsOtpStep(false);
    setAuthSuccess('Welcome to Resto OS! Your account has been registered.');
  };

  // Handle Edit Name
  const handleSaveName = () => {
    if (!editedName.trim()) return;
    updateProfileName(editedName.trim());
    setIsEditNameModalOpen(false);
  };

  // Handle Claim Reward (Supports milestone claims & unlocked vouchers)
  const handleClaimReward = async (reward?: any) => {
    if (!customer) return;
    try {
      const res = dbAdapter.claimLoyaltyReward({
        customerId: customer.id,
        rewardId: reward?.id,
      });
      setSelectedRewardToClaim(res.reward);
      setClaimedCode(res.redemption.redemption_code);
      if (res.redemption.redemption_code) {
        const qrUrl = await QRService.generateQRCodeDataUrl(res.redemption.redemption_code);
        setClaimQrUrl(qrUrl);
      }
      refreshLoyaltyData();
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to claim reward');
    }
  };

  const handleCopyCode = (code: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  // Handle Submit Feedback
  const handleSubmitFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    dbAdapter.submitCustomerFeedback({
      customer_id: customer?.id,
      customer_name: customer?.full_name || 'Valued Guest',
      table_id: table?.id,
      table_number: table?.table_number,
      food_rating: foodRating,
      service_rating: serviceRating,
      ambience_rating: ambienceRating,
      comments: feedbackComments || undefined,
    });
    setFeedbackSubmitted(true);
    setTimeout(() => {
      setFeedbackSubmitted(false);
      setFeedbackComments('');
    }, 2500);
  };

  // ==================================================================
  // VIEW A: LOGGED OUT / GUEST VIEW (OTP LOGIN & REGISTER)
  // ==================================================================
  if (!isLoggedIn || !customer) {
    return (
      <div className="max-w-md mx-auto py-8">
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-orange-100 shadow-card text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-orange to-amber-500 text-white flex items-center justify-center mx-auto shadow-md">
            <User className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Customer Sign In & Rewards
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Verify your mobile number to restore saved dining orders, loyalty stamps and claim rewards.
            </p>
          </div>

          {authError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-600 font-semibold flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {authSuccess && (
            <div className="p-3.5 bg-green-50 border border-green-200 rounded-2xl text-xs text-green-700 font-semibold flex items-center gap-2 text-left">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{authSuccess}</span>
            </div>
          )}

          {/* STEP 1: Phone Input */}
          {!isOtpStep && !isNewUserStep && (
            <form onSubmit={handleSendOtp} className="space-y-4 text-left">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Mobile Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="tel"
                    value={loginPhone}
                    onChange={(e) => handlePhoneInputChange(e.target.value)}
                    placeholder="+91 98888 77665"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-brand-orange"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  We'll send a 6-digit verification code to this number.
                </p>
              </div>

              <Button type="submit" variant="orange" className="w-full py-3 font-extrabold text-sm">
                Send OTP Code
              </Button>

              <div className="pt-4 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-500">Quick Test / Demo Customer:</p>
                <button
                  type="button"
                  onClick={() => {
                    setLoginPhone('+91 98888 77665');
                    requestOtp('+91 98888 77665');
                    setIsOtpStep(true);
                  }}
                  className="mt-1.5 px-3 py-1.5 rounded-xl bg-orange-50 text-brand-orange text-xs font-bold border border-orange-200 hover:bg-orange-100 transition-colors"
                >
                  Sign In as Aditya Verma (Existing VIP Customer)
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: OTP Verification */}
          {isOtpStep && !isNewUserStep && (
            <form onSubmit={handleVerifyOtp} className="space-y-4 text-left">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700">Enter 6-digit OTP Code</label>
                  <button
                    type="button"
                    onClick={() => setIsOtpStep(false)}
                    className="text-[11px] text-brand-orange font-bold hover:underline"
                  >
                    Change Number
                  </button>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={loginOtp}
                  onChange={(e) => setLoginOtp(e.target.value)}
                  placeholder="e.g. 123456"
                  className="w-full text-center tracking-widest text-lg font-black py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-brand-orange"
                  required
                />
                {activeOtpCode && (
                  <p className="text-[11px] text-amber-700 font-semibold mt-1">
                    Demo OTP code: <span className="underline font-mono">{activeOtpCode}</span>
                  </p>
                )}
              </div>

              <Button type="submit" variant="orange" className="w-full py-3 font-extrabold text-sm">
                Verify & Continue
              </Button>
            </form>
          )}

          {/* STEP 3: New Customer Name Registration */}
          {isNewUserStep && (
            <form onSubmit={handleCompleteRegistration} className="space-y-4 text-left">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Your Full Name
                </label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-brand-orange"
                  required
                />
              </div>

              <Button type="submit" variant="orange" className="w-full py-3 font-extrabold text-sm">
                Complete Registration
              </Button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ==================================================================
  // VIEW B: LOGGED IN CUSTOMER DASHBOARD (DESKTOP 2-COLUMN + MOBILE)
  // ==================================================================
  const stampsCount = loyaltyAccount?.current_active_stamps || 0;
  const targetStamps = settings.loyalty_stamps_for_reward || 8;
  const progressPercent = Math.min(100, Math.round((stampsCount / targetStamps) * 100));

  return (
    <div className="space-y-6">
      {/* Profile Header Card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-brand-orange to-amber-500 text-white font-black text-2xl flex items-center justify-center shadow-md">
            {customer.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {customer.full_name}
              </h1>
              <span className="p-1 rounded-full bg-green-100 text-green-700" title="Verified Customer">
                <ShieldCheck className="w-4 h-4" />
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span>{customer.phone}</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Member since {formatDate(customer.created_at)}
            </p>
          </div>
        </div>

        {/* Quick Metrics */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-2xl bg-orange-50/70 border border-orange-100">
            <span className="font-black text-base sm:text-lg text-brand-orange block">
              {customerOrders.length}
            </span>
            <span className="text-[10px] text-slate-500 font-bold uppercase">Orders</span>
          </div>

          <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-100">
            <span className="font-black text-base sm:text-lg text-amber-800 block">
              {stampsCount} / {targetStamps}
            </span>
            <span className="text-[10px] text-slate-500 font-bold uppercase">Stamps</span>
          </div>

          <div className="p-3 rounded-2xl bg-purple-50/70 border border-purple-100">
            <span className="font-black text-base sm:text-lg text-purple-700 block">
              {rewards.length}
            </span>
            <span className="text-[10px] text-slate-500 font-bold uppercase">Rewards</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2-COLUMN LAYOUT: LEFT NAVIGATION & RIGHT CONTENT AREA          */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Side Profile Navigation */}
        <aside className="bg-white rounded-3xl border border-slate-100 shadow-sm p-3 sm:p-4 space-y-1">
          <button
            onClick={() => setActiveTab('PROFILE')}
            className={`w-full p-3 rounded-2xl text-left text-xs font-bold flex items-center justify-between transition-all ${
              activeTab === 'PROFILE'
                ? 'bg-brand-orange text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <User className="w-4 h-4" />
              <span>Account Details</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </button>

          <button
            onClick={() => setActiveTab('ORDERS')}
            className={`w-full p-3 rounded-2xl text-left text-xs font-bold flex items-center justify-between transition-all ${
              activeTab === 'ORDERS'
                ? 'bg-brand-orange text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4" />
              <span>My Orders & History</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </button>

          <button
            onClick={() => setActiveTab('REWARDS')}
            className={`w-full p-3 rounded-2xl text-left text-xs font-bold flex items-center justify-between transition-all ${
              activeTab === 'REWARDS'
                ? 'bg-brand-orange text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Award className="w-4 h-4" />
              <span>Loyalty Stamps & Rewards</span>
            </div>
            <span className="text-[10px] bg-amber-400 text-slate-900 px-2 py-0.2 rounded-full font-black">
              {stampsCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('PAYMENTS')}
            className={`w-full p-3 rounded-2xl text-left text-xs font-bold flex items-center justify-between transition-all ${
              activeTab === 'PAYMENTS'
                ? 'bg-brand-orange text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CreditCard className="w-4 h-4" />
              <span>Payment & Receipts</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </button>

          <button
            onClick={() => setActiveTab('FEEDBACK')}
            className={`w-full p-3 rounded-2xl text-left text-xs font-bold flex items-center justify-between transition-all ${
              activeTab === 'FEEDBACK'
                ? 'bg-brand-orange text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4" />
              <span>Dining Feedback</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </button>

          <button
            onClick={() => setActiveTab('SUPPORT')}
            className={`w-full p-3 rounded-2xl text-left text-xs font-bold flex items-center justify-between transition-all ${
              activeTab === 'SUPPORT'
                ? 'bg-brand-orange text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <HelpCircle className="w-4 h-4" />
              <span>Help & Table Support</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </button>

          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={logout}
              className="w-full p-3 rounded-2xl text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out Account</span>
            </button>
          </div>
        </aside>

        {/* Right Side Content Panel */}
        <div className="lg:col-span-3 min-w-0">
          {/* TAB 1: PERSONAL PROFILE */}
          {activeTab === 'PROFILE' && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-extrabold text-slate-900">
                  Account Information
                </h3>
                <button
                  onClick={() => {
                    setEditedName(customer.full_name);
                    setIsEditNameModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Name</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-slate-500 mb-1">Full Legal Name</p>
                  <p className="text-sm font-extrabold text-slate-900">{customer.full_name}</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 mb-1">Verified Mobile Number</p>
                    <p className="text-sm font-extrabold text-slate-900">{customer.phone}</p>
                  </div>
                  <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                    Verified
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-slate-500 mb-1">Total Lifetime Dining Spend</p>
                  <p className="text-sm font-extrabold text-brand-orange">{formatCurrency(totalSpent)}</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-slate-500 mb-1">Current Dining Table Connection</p>
                  <p className="text-sm font-extrabold text-slate-900">
                    {table ? `Table ${table.table_number} (${table.floor_area})` : 'No Active Session'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MY ORDERS */}
          {activeTab === 'ORDERS' && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-extrabold text-slate-900">
                  Order History ({customerOrders.length})
                </h3>
                <Link to="/orders">
                  <Button variant="outline" size="sm">
                    Open Orders View
                  </Button>
                </Link>
              </div>

              {customerOrders.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No previous orders placed yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {customerOrders.map((order) => (
                    <div
                      key={order.id}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-extrabold text-slate-900">{order.order_number}</span>
                          <OrderStatusBadge status={order.status} />
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {formatDate(order.created_at)} • Table {order.table?.table_number || 'T-00'} • {order.items.length} items
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-black text-slate-900">{formatCurrency(order.total_amount)}</span>
                        <Link to={`/order/track/${order.id}`}>
                          <button className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100">
                            Track
                          </button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LOYALTY STAMPS & REWARDS */}
          {activeTab === 'REWARDS' && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Bistro Epicure Loyalty Card
                  </h3>
                  <p className="text-xs text-slate-500">Earn 1 stamp on every dining order above ₹250</p>
                </div>
                <Link to="/my-rewards">
                  <Button variant="orange" size="sm">
                    Full Rewards Page
                  </Button>
                </Link>
              </div>

              {/* Stamp Grid */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 text-center space-y-4">
                <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                  <span>Stamp Collection Progress</span>
                  <span>{stampsCount} of {targetStamps} Stamps</span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
                  {Array.from({ length: targetStamps }).map((_, idx) => {
                    const isEarned = idx < stampsCount;
                    return (
                      <div
                        key={idx}
                        className={`aspect-square rounded-2xl flex flex-col items-center justify-center p-2 border transition-all ${
                          isEarned
                            ? 'bg-amber-400 border-amber-500 text-slate-950 font-black shadow-md'
                            : 'bg-white/80 border-dashed border-amber-300 text-amber-300'
                        }`}
                      >
                        <Award className={`w-5 h-5 ${isEarned ? 'fill-slate-950' : ''}`} />
                        <span className="text-[10px] mt-0.5">{idx + 1}</span>
                      </div>
                    );
                  })}
                </div>

                {stampsCount >= targetStamps ? (
                  <div className="p-4 bg-white rounded-2xl border border-brand-orange text-xs font-bold text-slate-900 space-y-2.5">
                    <p className="text-green-700">
                      🎉 Milestone Reached ({stampsCount}/{targetStamps} Stamps)! You have unlocked a Complimentary Chef Special Delight.
                    </p>
                    <Button
                      size="sm"
                      variant="orange"
                      className="w-full text-xs font-black shadow-md py-2.5"
                      onClick={() => handleClaimReward()}
                    >
                      Claim Reward Voucher Now
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-amber-800">
                    Collect {targetStamps - stampsCount} more {targetStamps - stampsCount === 1 ? 'stamp' : 'stamps'} to unlock your next culinary reward!
                  </p>
                )}
              </div>

              {/* Available Rewards */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Available Rewards ({rewards.length})
                </h4>
                {rewards.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-500 text-center">
                    No active rewards unlocked yet. Place dining orders to collect stamps!
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {rewards.map((r) => (
                      <div
                        key={r.id}
                        className="p-4 rounded-2xl bg-white border border-purple-200 shadow-2xs flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                            <Gift className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900">{r.reward_name}</p>
                            <p className="text-[11px] text-slate-500">Valid until {formatDate(r.expires_at)}</p>
                          </div>
                        </div>

                        {r.is_claimed ? (
                          <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-600 font-bold">
                            Claimed
                          </span>
                        ) : (
                          <button
                            onClick={() => handleClaimReward(r)}
                            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold shadow-sm transition-colors"
                          >
                            Claim Code
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: PAYMENT & INVOICES */}
          {activeTab === 'PAYMENTS' && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-extrabold text-slate-900">
                  Payment History & Tax Invoices
                </h3>
              </div>

              {customerInvoices.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No verified invoices found for this account.
                </div>
              ) : (
                <div className="space-y-3">
                  {customerInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-black text-slate-900">{inv.invoice_number}</p>
                        <p className="text-[11px] text-slate-500">
                          {formatDate(inv.issued_at)} • Method: {inv.payment_method}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-black text-sm text-slate-900">
                          {formatCurrency(inv.total_amount)}
                        </p>
                        <span className="text-[10px] text-green-700 font-bold">Paid & Verified</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: DINING FEEDBACK */}
          {activeTab === 'FEEDBACK' && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
              <h3 className="text-base font-extrabold text-slate-900 pb-3 border-b border-slate-100">
                Share Dining Experience Feedback
              </h3>

              {feedbackSubmitted ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-2" />
                  <h4 className="font-bold text-slate-900 text-sm">Thank You For Your Review!</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Your feedback helps our culinary and floor team elevate your dining journey.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmitFeedback} className="space-y-4 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Food Taste & Quality</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFoodRating(star)}
                          className={`p-2 rounded-xl border ${
                            foodRating >= star
                              ? 'bg-amber-50 border-amber-300 text-amber-500'
                              : 'bg-white border-slate-200 text-slate-300'
                          }`}
                        >
                          <Star className={`w-5 h-5 ${foodRating >= star ? 'fill-amber-400' : ''}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Service & Speed</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setServiceRating(star)}
                          className={`p-2 rounded-xl border ${
                            serviceRating >= star
                              ? 'bg-amber-50 border-amber-300 text-amber-500'
                              : 'bg-white border-slate-200 text-slate-300'
                          }`}
                        >
                          <Star className={`w-5 h-5 ${serviceRating >= star ? 'fill-amber-400' : ''}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Ambience & Cleanliness</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setAmbienceRating(star)}
                          className={`p-2 rounded-xl border ${
                            ambienceRating >= star
                              ? 'bg-amber-50 border-amber-300 text-amber-500'
                              : 'bg-white border-slate-200 text-slate-300'
                          }`}
                        >
                          <Star className={`w-5 h-5 ${ambienceRating >= star ? 'fill-amber-400' : ''}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Your Comments or Suggestions</label>
                    <textarea
                      value={feedbackComments}
                      onChange={(e) => setFeedbackComments(e.target.value)}
                      placeholder="Tell us what you loved or how we can improve..."
                      rows={3}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-none focus:border-brand-orange resize-none"
                    />
                  </div>

                  <Button type="submit" variant="orange" className="w-full py-2.5">
                    Submit Dining Review
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* TAB 6: SUPPORT & ASSISTANCE */}
          {activeTab === 'SUPPORT' && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
              <h3 className="text-base font-extrabold text-slate-900 pb-3 border-b border-slate-100">
                Help & Table Support
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                <div className="p-4 rounded-2xl bg-orange-50/70 border border-orange-200">
                  <PhoneCall className="w-6 h-6 text-brand-orange mb-2" />
                  <h4 className="font-bold text-slate-900">Need Immediate Help at Table?</h4>
                  <p className="text-[11px] text-slate-600 mt-1 mb-3">
                    Use our instant waiter call to alert your table captain and the restaurant counter.
                  </p>
                  <Button
                    variant="orange"
                    size="sm"
                    onClick={() => {
                      if (currentSession) {
                        dbAdapter.createServiceRequest({
                          tableSessionId: currentSession.id,
                          requestType: 'CALL_WAITER',
                        });
                        alert('Waiter has been alerted for your table!');
                      } else {
                        alert('Please connect to a dining table first.');
                      }
                    }}
                  >
                    Call Server to Table
                  </Button>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
                  <Receipt className="w-6 h-6 text-amber-800 mb-2" />
                  <h4 className="font-bold text-slate-900">Ready to Settle Bill?</h4>
                  <p className="text-[11px] text-slate-600 mt-1 mb-3">
                    Request your digital bill to pay via Direct UPI QR or cash at the counter.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (currentSession) {
                        dbAdapter.createBillRequest({
                          tableSessionId: currentSession.id,
                        });
                        alert('Bill request sent to front counter!');
                      } else {
                        alert('Please connect to a dining table first.');
                      }
                    }}
                  >
                    Request Bill Settlement
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-900">{restaurant.name}</p>
                <p>{restaurant.address}, {restaurant.city}</p>
                <p>Front Desk: {restaurant.phone} • Email: {restaurant.email}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* EDIT PROFILE NAME MODAL                                        */}
      {/* ============================================================== */}
      <Modal
        isOpen={isEditNameModalOpen}
        onClose={() => setIsEditNameModalOpen(false)}
        title="Edit Account Name"
        description="Update your legal name for billing and notifications"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Full Name</label>
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-brand-orange"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setIsEditNameModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="orange" className="flex-1" onClick={handleSaveName}>
              Save Name
            </Button>
          </div>
        </div>
      </Modal>

      {/* ============================================================== */}
      {/* CLAIM REWARD CODE MODAL                                        */}
      {/* ============================================================== */}
      {selectedRewardToClaim && claimedCode && (
        <Modal
          isOpen={!!claimedCode}
          onClose={() => {
            setClaimedCode(null);
            setSelectedRewardToClaim(null);
          }}
          title="Reward Claimed!"
          description="Present this unique 6-digit redemption code to your server"
        >
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mx-auto">
              <Gift className="w-8 h-8" />
            </div>

            <div>
              <h4 className="font-extrabold text-slate-900 text-base">
                {selectedRewardToClaim.reward_name}
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Complimentary gourmet perk from the executive chef.
              </p>
            </div>

            <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl space-y-2">
              <span className="text-xs font-bold text-purple-900 block uppercase tracking-wider">
                Unique Redemption Verification Code
              </span>
              <span className="font-mono text-2xl font-black text-purple-700 tracking-widest block">
                {claimedCode}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="text-xs mx-auto"
                leftIcon={copiedCode ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                onClick={() => handleCopyCode(claimedCode)}
              >
                {copiedCode ? 'Copied to Clipboard!' : 'Copy Code'}
              </Button>
            </div>

            {claimQrUrl && (
              <div className="w-40 h-40 mx-auto bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center">
                <img src={claimQrUrl} alt="Reward QR" className="w-full h-full object-contain" />
              </div>
            )}

            <p className="text-[11px] text-slate-400">
              Show this screen or read out your code to your server or at the Cash Counter to apply your reward to your order.
            </p>

            <Button
              variant="orange"
              className="w-full"
              onClick={() => {
                setClaimedCode(null);
                setSelectedRewardToClaim(null);
                setClaimQrUrl(null);
              }}
            >
              Done
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};
