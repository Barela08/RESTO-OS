import React, { useState, useEffect } from 'react';
import { dbAdapter } from '../../services/databaseAdapter';
import { QRService } from '../../services/qrService';
import { Customer, LoyaltyAccount, LoyaltyReward, Order, RewardRedemption } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { formatDate, formatDateTime } from '../../utils/date';
import { formatCurrency } from '../../utils/currency';
import { useSessionStore } from '../../store/sessionStore';
import {
  Award,
  Sparkles,
  CheckCircle2,
  Lock,
  Gift,
  ArrowRight,
  ShieldCheck,
  Tag,
  Phone,
  KeyRound,
  LogOut,
  QrCode,
  Copy,
  Check,
  ShoppingBag,
  Clock,
  AlertCircle,
  Link as LinkIcon,
} from 'lucide-react';

export const CustomerLoyaltyPage: React.FC = () => {
  // Authentication State
  const [phoneInput, setPhoneInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [simulatedSmsOtp, setSimulatedSmsOtp] = useState<string | null>(null);
  const [isNewRegistration, setIsNewRegistration] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Authenticated Customer Profile State
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyAccount | null>(null);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [pastOrders, setPastOrders] = useState<Order[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);

  // Claim Modal State
  const [claimedReward, setClaimedReward] = useState<{ reward: LoyaltyReward; redemption: RewardRedemption } | null>(null);
  const [claimQrUrl, setClaimQrUrl] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);

  const { currentSession, table, setCustomerInfo } = useSessionStore();
  const settings = dbAdapter.getSettings();
  const restaurant = dbAdapter.getRestaurant();

  // Load existing authenticated customer from localStorage
  useEffect(() => {
    const updateCustomerData = () => {
      let storedCustomer: Customer | null = null;
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('resto_customer_auth');
        if (raw) {
          try {
            storedCustomer = JSON.parse(raw);
          } catch {
            // Ignored
          }
        }
      }

      if (storedCustomer) {
        // Sync with live database
        const normalized = dbAdapter.normalizePhoneNumber(storedCustomer.phone);
        const liveCust = dbAdapter.getCustomers().find(c => dbAdapter.normalizePhoneNumber(c.phone) === normalized) || storedCustomer;
        setCustomer(liveCust);

        const acc = dbAdapter.getLoyaltyAccounts().find(a => a.customer_id === liveCust.id);
        if (acc) setLoyalty({ ...acc });

        const rws = dbAdapter.getLoyaltyRewards().filter(r => r.loyalty_account_id === acc?.id);
        setRewards([...rws]);

        const orders = dbAdapter.getOrders().filter(o => {
          if (!o.customer_phone) return false;
          return dbAdapter.normalizePhoneNumber(o.customer_phone) === normalized;
        });
        setPastOrders([...orders]);

        const redms = dbAdapter.getRewardRedemptions().filter(r => r.customer_id === liveCust.id);
        setRedemptions([...redms]);
      } else {
        setCustomer(null);
        setLoyalty(null);
        setRewards([]);
        setPastOrders([]);
        setRedemptions([]);
      }
    };

    updateCustomerData();
    return dbAdapter.subscribe(updateCustomerData);
  }, []);

  // Request OTP handler
  const handleRequestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmitting(true);

    try {
      const res = dbAdapter.requestCustomerOtp(phoneInput);
      setIsOtpSent(true);
      setSimulatedSmsOtp(res.otp);
      setIsSubmitting(false);
    } catch (err: unknown) {
      setAuthError((err as Error).message || 'Failed to send OTP.');
      setIsSubmitting(false);
    }
  };

  // Verify OTP handler
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmitting(true);

    try {
      const result = dbAdapter.verifyCustomerOtp(phoneInput, otpInput);
      if (!result.success) {
        setAuthError(result.message);
        setIsSubmitting(false);
        return;
      }

      if (!result.isExistingCustomer) {
        // Requires full name for registration completion
        setIsNewRegistration(true);
        setIsSubmitting(false);
      } else if (result.customer) {
        // Existing member recognized!
        loginCustomer(result.customer);
        setIsSubmitting(false);
      }
    } catch (err: unknown) {
      setAuthError((err as Error).message || 'OTP verification failed.');
      setIsSubmitting(false);
    }
  };

  // Complete Registration for new customer
  const handleCompleteRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!nameInput.trim()) {
      setAuthError('Please enter your full name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { customer: newCust } = dbAdapter.registerOrCompleteCustomer({ phone: phoneInput, fullName: nameInput });
      loginCustomer(newCust);
      setIsNewRegistration(false);
      setIsSubmitting(false);
    } catch (err: unknown) {
      setAuthError((err as Error).message || 'Registration failed.');
      setIsSubmitting(false);
    }
  };

  const loginCustomer = (cust: Customer) => {
    localStorage.setItem('resto_customer_auth', JSON.stringify(cust));
    setCustomer(cust);
    setIsOtpSent(false);
    setOtpInput('');
    setSimulatedSmsOtp(null);

    // Auto sync with active session store
    setCustomerInfo(cust.full_name, cust.phone);

    // Link current table session if active
    if (currentSession) {
      dbAdapter.linkSessionToCustomer(currentSession.id, cust.id);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('resto_customer_auth');
    setCustomer(null);
    setLoyalty(null);
    setRewards([]);
    setPastOrders([]);
    setIsOtpSent(false);
    setIsNewRegistration(false);
    setPhoneInput('');
    setOtpInput('');
    setNameInput('');
    setClaimedReward(null);
  };

  // Claim Reward Workflow (Module 4.2)
  const handleClaimReward = async (rewardId?: string) => {
    if (!customer) return;
    try {
      const res = dbAdapter.claimLoyaltyReward({
        customerId: customer.id,
        rewardId,
      });

      setClaimedReward(res);

      // Generate visual QR code for redemption
      const qrData = await QRService.generateQRCodeDataUrl(
        res.reward.redemption_code || res.reward.voucher_code
      );
      setClaimQrUrl(qrData);
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to claim reward.');
    }
  };

  const handleCopyCode = (code: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  // Link Active Table Session
  const handleLinkCurrentSession = () => {
    if (!currentSession || !customer) return;
    const ok = dbAdapter.linkSessionToCustomer(currentSession.id, customer.id);
    if (ok) {
      alert(`Table ${table?.table_number || ''} order successfully linked to your loyalty account!`);
    }
  };

  const currentStamps = loyalty?.current_active_stamps || 0;
  const targetStamps = settings.loyalty_stamps_for_reward || 8;
  const progressPercent = Math.min(100, Math.round((currentStamps / targetStamps) * 100));

  // Masked phone format e.g. +91 98*** **665
  const getMaskedPhone = (rawPhone: string) => {
    const cleaned = rawPhone.replace(/\s+/g, '');
    if (cleaned.length >= 10) {
      return `${cleaned.slice(0, 5)}*****${cleaned.slice(-3)}`;
    }
    return rawPhone;
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-tr from-brand-orange via-amber-500 to-orange-600 rounded-3xl p-6 text-white shadow-elevated text-center relative overflow-hidden">
        <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto mb-3 shadow-inner">
          <Award className="w-7 h-7 text-white" />
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-black/20 text-white text-[10px] uppercase font-bold tracking-widest">
          {restaurant.name} Rewards Club
        </span>
        <h2 className="text-2xl font-extrabold tracking-tight mt-1">Digital Stamp Card</h2>
        <p className="text-xs text-orange-100 mt-1 max-w-xs mx-auto">
          Collect 1 stamp per completed order. Reach {targetStamps} stamps to unlock your complimentary chef special!
        </p>
      </div>

      {/* ============================================================== */}
      {/* GUEST AUTHENTICATION / OTP LOGIN (MODULE 3)                    */}
      {/* ============================================================== */}
      {!customer ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <ShieldCheck className="w-5 h-5 text-green-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Smart Customer Authentication</h3>
              <p className="text-[11px] text-slate-500">Sign in with your verified mobile number to access stamps</p>
            </div>
          </div>

          {authError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {/* SIMULATED SMS OTP DISPLAY (For smooth evaluation and instant testing) */}
          {simulatedSmsOtp && (
            <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl text-xs space-y-1">
              <div className="flex items-center justify-between text-brand-purple font-extrabold">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4" /> [Simulated SMS Notification]
                </span>
                <span className="text-[10px] font-mono bg-purple-100 px-2 py-0.5 rounded">Just Now</span>
              </div>
              <p className="text-slate-700">
                Your Resto OS verification OTP is <strong className="font-mono text-sm text-brand-purple font-extrabold">{simulatedSmsOtp}</strong>. Valid for 5 minutes.
              </p>
              <button
                type="button"
                onClick={() => setOtpInput(simulatedSmsOtp)}
                className="text-[11px] font-bold text-brand-purple hover:underline pt-1 inline-block"
              >
                Auto-fill {simulatedSmsOtp}
              </button>
            </div>
          )}

          {/* STEP A: REQUEST OTP */}
          {!isOtpSent && !isNewRegistration && (
            <form onSubmit={handleRequestOtp} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 43210 or 10-digit number"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:border-brand-orange"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Existing members will be instantly recognized by mobile number.
                </span>
              </div>

              <Button
                variant="orange"
                className="w-full"
                type="submit"
                isLoading={isSubmitting}
              >
                Continue & Send OTP
              </Button>
            </form>
          )}

          {/* STEP B: VERIFY OTP */}
          {isOtpSent && !isNewRegistration && (
            <form onSubmit={handleVerifyOtp} className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Enter 6-Digit OTP Code
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOtpSent(false);
                      setSimulatedSmsOtp(null);
                    }}
                    className="text-[11px] text-brand-orange hover:underline font-semibold"
                  >
                    Change Number
                  </button>
                </div>

                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="e.g. 548291"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold tracking-widest text-slate-900 focus:outline-none focus:border-brand-purple"
                  />
                </div>
              </div>

              <Button
                variant="primary"
                className="w-full"
                type="submit"
                isLoading={isSubmitting}
              >
                Verify OTP & Continue
              </Button>
            </form>
          )}

          {/* STEP C: NEW CUSTOMER REGISTRATION */}
          {isNewRegistration && (
            <form onSubmit={handleCompleteRegistration} className="space-y-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-900 text-xs">
                <CheckCircle2 className="w-4 h-4 text-green-600 inline mr-1" />
                <span>Mobile number verified! Please enter your name to complete your registration.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Your Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:border-brand-orange"
                />
              </div>

              <Button
                variant="orange"
                className="w-full"
                type="submit"
                isLoading={isSubmitting}
              >
                Complete Registration & Join Rewards
              </Button>
            </form>
          )}
        </div>
      ) : (
        /* ============================================================== */
        /* AUTHENTICATED CUSTOMER REWARDS DASHBOARD (MODULE 4)            */
        /* ============================================================== */
        <div className="space-y-4">
          {/* Member Card */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-extrabold text-slate-900">{customer.full_name}</p>
                <p className="text-xs text-slate-500 font-mono">{getMaskedPhone(customer.phone)}</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                </span>
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Sign out of rewards"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Active Table Session Linking Card */}
            {currentSession && (!currentSession.customer_phone || currentSession.customer_phone !== customer.phone) && (
              <div className="mb-4 p-3.5 bg-orange-50 border border-orange-200 rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-orange-950 block">Active Order at Table {table?.table_number}</span>
                  <span className="text-[11px] text-orange-800">Link your table order to accrue stamps upon bill payment.</span>
                </div>
                <Button
                  size="sm"
                  variant="orange"
                  className="text-xs py-1"
                  leftIcon={<LinkIcon className="w-3.5 h-3.5" />}
                  onClick={handleLinkCurrentSession}
                >
                  Link Visit
                </Button>
              </div>
            )}

            {/* Stamp Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-700">Active Stamp Progress</span>
                <span className="text-brand-orange">{currentStamps} of {targetStamps} Stamps</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                <div
                  className="h-full bg-gradient-to-r from-brand-orange to-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 text-right">
                {targetStamps - currentStamps > 0
                  ? `Only ${targetStamps - currentStamps} more orders to your reward!`
                  : 'Milestone reached! You have unlocked a reward voucher!'}
              </p>
            </div>

            {/* 8-Stamp Interactive Circles Grid */}
            <div className="grid grid-cols-4 gap-2.5 my-6">
              {Array.from({ length: targetStamps }).map((_, idx) => {
                const isStamped = idx < currentStamps;
                return (
                  <div
                    key={idx}
                    className={`aspect-square rounded-2xl flex flex-col items-center justify-center p-2 border-2 transition-all ${
                      isStamped
                        ? 'border-brand-orange bg-orange-50 text-brand-orange shadow-sm font-extrabold'
                        : 'border-dashed border-slate-200 bg-slate-50 text-slate-400 font-semibold'
                    }`}
                  >
                    {isStamped ? (
                      <>
                        <Sparkles className="w-5 h-5 text-brand-orange mb-0.5 animate-pulse" />
                        <span className="text-[10px] uppercase tracking-wider font-extrabold">STAMP</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 text-slate-300 mb-0.5" />
                        <span className="text-[10px]">#{idx + 1}</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Milestone Reached Claim Banner */}
            {currentStamps >= targetStamps && (
              <div className="my-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-brand-orange/40 rounded-2xl text-center space-y-2">
                <span className="px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 text-[10px] font-extrabold uppercase">
                  Milestone Reached ({currentStamps}/{targetStamps} Stamps)
                </span>
                <h4 className="font-extrabold text-slate-900 text-sm">
                  Complimentary Chef Special Reward Ready to Claim!
                </h4>
                <Button
                  variant="primary"
                  className="w-full text-xs font-bold shadow-md"
                  onClick={() => handleClaimReward()}
                >
                  Claim Reward Voucher & Generate Code
                </Button>
              </div>
            )}

            {/* Lifetime Stats */}
            <div className="grid grid-cols-2 gap-3 py-3 border-t border-slate-100 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-500 font-semibold uppercase block">Lifetime Stamps Earned</span>
                <strong className="text-base text-slate-900">{loyalty?.total_stamps_earned || 0}</strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-500 font-semibold uppercase block">Milestones Unlocked</span>
                <strong className="text-base text-green-600">{loyalty?.total_rewards_unlocked || 0}</strong>
              </div>
            </div>

            {/* Unlocked & Claimable Reward Vouchers */}
            <div className="border-t border-slate-100 pt-5 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-brand-orange" />
                <span>Available Rewards ({rewards.filter(r => !r.is_redeemed).length})</span>
              </h4>

              {rewards.filter(r => !r.is_redeemed).length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-2xl text-center border border-dashed border-slate-200">
                  <p className="text-xs text-slate-500">
                    No reward vouchers available right now. Complete your remaining orders to earn stamps and unlock complimentary delicacies!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rewards
                    .filter((r) => !r.is_redeemed)
                    .map((reward) => (
                      <div
                        key={reward.id}
                        className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 space-y-2.5"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="px-2 py-0.5 bg-brand-orange text-white rounded text-[10px] font-bold uppercase font-mono">
                              {reward.voucher_code}
                            </span>
                            <h5 className="font-extrabold text-slate-900 text-sm mt-1">{reward.title}</h5>
                            <p className="text-[11px] text-slate-600 mt-0.5">{reward.description}</p>
                            <p className="text-[10px] text-slate-500 mt-1 font-mono">
                              Valid until {formatDate(reward.expires_at)}
                            </p>
                          </div>
                        </div>

                        {reward.redemption_code ? (
                          <div className="p-3 bg-white rounded-xl border border-amber-300 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] text-slate-400 uppercase font-bold block">
                                Generated Claim Code
                              </span>
                              <span className="font-mono font-extrabold text-sm text-brand-purple">
                                {reward.redemption_code}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="primary"
                              className="text-xs py-1"
                              onClick={() => handleClaimReward(reward.id)}
                            >
                              View QR / Redeem
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="md"
                            variant="orange"
                            className="w-full font-extrabold shadow-sm"
                            leftIcon={<Gift className="w-4 h-4" />}
                            onClick={() => handleClaimReward(reward.id)}
                          >
                            CLAIM REWARD
                          </Button>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Past Orders History */}
          {pastOrders.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-6 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-brand-purple" />
                <span>My Dining & Stamp History ({pastOrders.length})</span>
              </h4>

              <div className="divide-y divide-slate-100 text-xs">
                {pastOrders.map((o) => (
                  <div key={o.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-slate-900 block">{o.order_number}</span>
                      <span className="text-[10px] text-slate-400">{formatDateTime(o.created_at)}</span>
                    </div>
                    <div className="text-right">
                      <strong className="text-slate-900 block">{formatCurrency(o.total_amount)}</strong>
                      <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[10px] font-bold">
                        {o.total_amount >= settings.loyalty_min_order_amount ? '+1 Stamp Earned' : 'Order Placed'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Redeemed Rewards History */}
          {redemptions.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-6 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 text-green-700">
                <CheckCircle2 className="w-4 h-4" />
                <span>Redeemed Vouchers ({redemptions.length})</span>
              </h4>

              <div className="divide-y divide-slate-100 text-xs">
                {redemptions.map((rdm) => (
                  <div key={rdm.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-slate-800">{rdm.redemption_code}</span>
                      <span className="text-[10px] text-slate-400 block">
                        {rdm.redeemed_at ? `Redeemed on ${formatDateTime(rdm.redeemed_at)}` : `Claimed on ${formatDateTime(rdm.created_at)}`}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded font-bold text-[10px]">
                      {rdm.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Program Rules Card */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-5 text-xs text-slate-600 space-y-2">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-slate-400" />
              <span>Loyalty Rules & Fair Play</span>
            </h4>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-500">
              <li>1 stamp awarded per eligible completed dining order (minimum order ₹{settings.loyalty_min_order_amount}).</li>
              <li>Stamps are awarded automatically after authorized cash or verified UPI payment confirmation.</li>
              <li>A single order never generates duplicate stamps.</li>
              <li>Each reward voucher is valid for {settings.loyalty_reward_validity_days || 30} days from date of unlocking.</li>
            </ul>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* UNIQUE REWARD CLAIM & REDEMPTION MODAL (MODULE 4.2 / 4.3)      */}
      {/* ============================================================== */}
      <Modal
        isOpen={!!claimedReward}
        onClose={() => setClaimedReward(null)}
        title="Reward Claim Voucher"
        description="Present this unique code to your server or counter"
      >
        {claimedReward && (
          <div className="space-y-4 text-center">
            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl">
              <span className="px-2 py-0.5 rounded bg-brand-orange text-white text-[10px] font-bold uppercase tracking-wider">
                Voucher Code
              </span>
              <h4 className="text-base font-extrabold text-slate-900 mt-1">
                {claimedReward.reward.title}
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                {claimedReward.reward.description}
              </p>
            </div>

            {/* Unique Redemption Code Display */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-1 shadow-inner">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                Unique Redemption Code
              </span>
              <span className="text-2xl font-extrabold font-mono text-amber-400 tracking-wider block">
                {claimedReward.reward.redemption_code || claimedReward.reward.voucher_code}
              </span>
              <div className="pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs py-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                  leftIcon={copiedCode ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  onClick={() => handleCopyCode(claimedReward.reward.redemption_code || claimedReward.reward.voucher_code)}
                >
                  {copiedCode ? 'Copied to Clipboard!' : 'Copy Code'}
                </Button>
              </div>
            </div>

            {/* QR Code Presentation for Waiter Scanning */}
            {claimQrUrl && (
              <div className="w-40 h-40 mx-auto bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center">
                <img src={claimQrUrl} alt="Reward Redemption QR" className="w-full h-full object-contain" />
              </div>
            )}

            <p className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200 text-left">
              <strong>Instructions:</strong> Please show this screen or read out the 8-character claim code to your assigned waiter or at the front cash register to redeem your dish.
            </p>

            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setClaimedReward(null)}
            >
              Done / Close
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};
