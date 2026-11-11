import React, { useState, useEffect } from 'react';
import { dbAdapter } from '../../services/databaseAdapter';
import {
  Order,
  Payment,
  Invoice,
  RepeatScanRequest,
  PaymentVerificationRequest,
  LoyaltyReward,
  Customer,
  RestaurantTable,
  TableStatus,
} from '../../types';
import { formatCurrency } from '../../utils/currency';
import { formatDateTime, formatTime, formatDate } from '../../utils/date';
import { StaffLayout } from '../../components/layout/StaffLayout';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { PaymentStatusBadge, OrderStatusBadge, TableStatusBadge } from '../../components/ui/Badge';
import { PrintableInvoice } from '../../components/common/PrintableInvoice';
import { TableDetailModal } from '../../components/common/TableDetailModal';
import {
  CreditCard,
  Banknote,
  Receipt,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Clock,
  Search,
  Check,
  X,
  FileText,
  ShieldCheck,
  Gift,
  Sparkles,
  Tag,
  Users,
  Calendar,
  Eye,
  UtensilsCrossed,
} from 'lucide-react';

export const CashCounterDashboard: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [repeatScanRequests, setRepeatScanRequests] = useState<RepeatScanRequest[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<PaymentVerificationRequest[]>([]);
  const [selectedDetailTable, setSelectedDetailTable] = useState<RestaurantTable | null>(null);

  // Table Collection Summary Filter State
  const [collectionDate, setCollectionDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');

  // Cash Confirmation Modal State
  const [confirmingPayment, setConfirmingPayment] = useState<Payment | null>(null);
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [cashNotes, setCashNotes] = useState<string>('');
  const [confirmedResult, setConfirmedResult] = useState<{ invoice: Invoice; stampAwarded: boolean } | null>(null);

  // UPI Rejection Modal State
  const [rejectingUpiReq, setRejectingUpiReq] = useState<PaymentVerificationRequest | null>(null);
  const [upiRejectionReason, setUpiRejectionReason] = useState<string>('UTR not found in merchant bank account statement.');

  // Reward Redemption Tool State
  const [rewardCodeInput, setRewardCodeInput] = useState<string>('');
  const [verifiedRewardData, setVerifiedRewardData] = useState<{
    valid: boolean;
    reward?: LoyaltyReward;
    customer?: Customer;
    message: string;
  } | null>(null);
  const [rewardRedemptionSuccess, setRewardRedemptionSuccess] = useState<string | null>(null);

  // Invoice Preview Modal
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const restaurant = dbAdapter.getRestaurant();

  useEffect(() => {
    const updateData = () => {
      setPayments([...dbAdapter.getPayments()]);
      setOrders([...dbAdapter.getOrders()]);
      setInvoices([...dbAdapter.getInvoices()]);
      setTables([...dbAdapter.getTables()]);
      setRepeatScanRequests([...dbAdapter.getRepeatScanRequests()]);
      setVerificationRequests([...dbAdapter.getPaymentVerificationRequests()]);
    };
    updateData();
    return dbAdapter.subscribe(updateData);
  }, []);

  const handleTableStatusChange = (tableId: string, status: TableStatus) => {
    dbAdapter.updateTable(tableId, { status });
    setSelectedDetailTable((prev) => (prev && prev.id === tableId ? { ...prev, status } : prev));
  };

  const tableSummaries = dbAdapter.getTableDailyCollectionSummary(collectionDate).filter((s) => {
    if (!tableSearchQuery.trim()) return true;
    return s.tableNumber.toLowerCase().includes(tableSearchQuery.toLowerCase());
  });

  // Filter pending cash payments, UPI verifications, and paid transactions
  const pendingCashPayments = payments.filter((p) => p.payment_method === 'CASH' && p.payment_status === 'PENDING');
  const pendingUpiVerifications = verificationRequests.filter((r) => r.status === 'PENDING');
  const paidPayments = payments.filter((p) => p.payment_status === 'PAID');
  const pendingRepeatScans = repeatScanRequests.filter((r) => r.status === 'PENDING');

  const totalCashCollected = paidPayments
    .filter((p) => p.payment_method === 'CASH')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalOnlineCollected = paidPayments
    .filter((p) => p.payment_method === 'UPI' || p.payment_method === 'RAZORPAY')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPendingAmount = pendingCashPayments.reduce((sum, p) => sum + p.amount, 0);

  // ------------------------------------------------------------------
  // Cash Handlers
  // ------------------------------------------------------------------
  const handleOpenCashModal = (pay: Payment) => {
    setConfirmingPayment(pay);
    setCashReceived(Math.ceil(pay.amount));
    setCashNotes('');
    setConfirmedResult(null);
  };

  const handleConfirmCashCollection = () => {
    if (!confirmingPayment) return;
    if (cashReceived < confirmingPayment.amount) {
      alert('Received cash amount is less than the bill total!');
      return;
    }

    const result = dbAdapter.confirmPayment({
      paymentId: confirmingPayment.id,
      staffId: 'st-ctr-1',
      cashReceivedAmount: cashReceived,
    });

    setConfirmedResult(result);
  };

  // ------------------------------------------------------------------
  // UPI QR Handlers (Module 2.4 & 2.5)
  // ------------------------------------------------------------------
  const handleApproveUpi = (reqId: string) => {
    try {
      const result = dbAdapter.approveUpiPayment(reqId, 'st-ctr-1');
      alert(`Payment Approved! Invoice #${result.invoice.invoice_number} generated successfully.`);
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to approve UPI payment.');
    }
  };

  const handleRejectUpi = () => {
    if (!rejectingUpiReq) return;
    try {
      dbAdapter.rejectUpiPayment(rejectingUpiReq.id, 'st-ctr-1', upiRejectionReason);
      setRejectingUpiReq(null);
      alert('UPI payment request has been rejected.');
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to reject payment.');
    }
  };

  // ------------------------------------------------------------------
  // Reward Redemption Tool Handlers (Module 4.3)
  // ------------------------------------------------------------------
  const handleVerifyRewardCode = () => {
    if (!rewardCodeInput.trim()) return;
    const res = dbAdapter.verifyRewardCode(rewardCodeInput.trim());
    setVerifiedRewardData(res);
    setRewardRedemptionSuccess(null);
  };

  const handleConfirmRedeemReward = () => {
    if (!rewardCodeInput.trim()) return;
    try {
      const res = dbAdapter.redeemRewardCode({
        redemptionCode: rewardCodeInput.trim(),
        staffId: 'st-ctr-1',
      });
      setRewardRedemptionSuccess(`Reward "${res.reward.title}" redeemed successfully for customer!`);
      setVerifiedRewardData(null);
      setRewardCodeInput('');
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to redeem reward.');
    }
  };

  const handleRepeatScanDecision = (
    reqId: string,
    decision: 'APPROVED_CONTINUE' | 'APPROVED_NEW' | 'REJECTED'
  ) => {
    dbAdapter.handleRepeatScanApproval(reqId, decision, 'st-ctr-1');
  };

  return (
    <StaffLayout
      title="Cash Counter & Front Desk POS"
      subtitle="Bill Settlement, Manual UPI Verification, Cash Desk & Reward Redemption"
      activeRole="counter"
    >
      <div className="space-y-6">
        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cash Register</span>
            <p className="text-xl font-extrabold text-white mt-1">{formatCurrency(totalCashCollected)}</p>
            <span className="text-[10px] text-green-400 font-semibold">Physical Cash Handed</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Online UPI Verified</span>
            <p className="text-xl font-extrabold text-white mt-1">{formatCurrency(totalOnlineCollected)}</p>
            <span className="text-[10px] text-brand-purple font-semibold">UTR Confirmed</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Pending UPI Requests</span>
            <p className="text-xl font-extrabold text-amber-400 mt-1">{pendingUpiVerifications.length}</p>
            <span className="text-[10px] text-amber-400 font-semibold">Requires Bank Verification</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Repeat Scan Alerts</span>
            <p className="text-xl font-extrabold text-white mt-1">{pendingRepeatScans.length}</p>
            <span className="text-[10px] text-orange-400 font-semibold">Session Authorizations</span>
          </div>
        </div>

        {/* ============================================================== */}
        {/* LIVE FLOOR & DINING TABLES (CLICK TO VIEW FULL DETAILS & MENU) */}
        {/* ============================================================== */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-card">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-orange" />
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-white">
                  Live Floor & Dining Tables ({tables.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Click any table card to inspect active orders, session duration, bill totals, or browse live menu
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">
              Realtime Floor Status
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {tables.map((tbl) => {
              const activeSession = dbAdapter.getSessions().find(
                (s) => s.table_id === tbl.id && s.status === 'ACTIVE'
              );
              const activeOrders = activeSession
                ? dbAdapter.getOrders().filter(
                    (o) => o.table_session_id === activeSession.id && o.status !== 'CANCELLED' && o.status !== 'REJECTED'
                  )
                : [];
              const sessionTotal = activeOrders.reduce((sum, o) => sum + o.total_amount, 0);

              return (
                <div
                  key={tbl.id}
                  onClick={() => setSelectedDetailTable(tbl)}
                  className={`group relative p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                    tbl.status === 'OCCUPIED'
                      ? 'bg-amber-950/20 border-amber-600/40 hover:border-amber-500 hover:bg-amber-950/30'
                      : tbl.status === 'PAYMENT_PENDING'
                      ? 'bg-orange-950/30 border-orange-500/60 hover:border-orange-400 hover:bg-orange-950/40 ring-1 ring-orange-500/30'
                      : tbl.status === 'CLEANING'
                      ? 'bg-purple-950/20 border-purple-600/40 hover:border-purple-500 hover:bg-purple-950/30'
                      : tbl.status === 'RESERVED'
                      ? 'bg-blue-950/20 border-blue-600/40 hover:border-blue-500 hover:bg-blue-950/30'
                      : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600 hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-lg font-black text-white group-hover:text-brand-orange transition-colors">
                      {tbl.table_number}
                    </span>
                    <TableStatusBadge status={tbl.status} />
                  </div>

                  <div className="mt-2 text-[11px] text-slate-400 space-y-0.5">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-slate-500" />
                      <span>{tbl.seating_capacity} Seats</span>
                    </div>

                    {activeSession ? (
                      <div className="pt-1.5 border-t border-slate-800/60">
                        <p className="font-bold text-white truncate text-xs">
                          {activeSession.customer_name || 'Guest Customer'}
                        </p>
                        <p className="text-[10px] text-amber-400 font-extrabold">
                          {activeOrders.length} {activeOrders.length === 1 ? 'Order' : 'Orders'} • {formatCurrency(sessionTotal)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500 pt-1">
                        {tbl.status === 'AVAILABLE' ? 'Ready for Guests' : tbl.status}
                      </p>
                    )}
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-800/40 flex items-center justify-between text-[10px] text-slate-400 group-hover:text-white transition-colors">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3 text-brand-orange" />
                      <span>Details & Menu</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ============================================================== */}
        {/* HIGH PRIORITY: PENDING UPI QR VERIFICATION REQUESTS (MODULE 2) */}
        {/* ============================================================== */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-card">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-orange animate-pulse" />
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-white">
                Pending UPI Payment Verification Requests ({pendingUpiVerifications.length})
              </h3>
            </div>
            <span className="text-xs text-amber-400 font-mono">Verify in Bank Statement before Approving</span>
          </div>

          {pendingUpiVerifications.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-1 opacity-30 text-green-400" />
              <span>No pending UPI payment verification requests.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="py-2.5 px-3">Table</th>
                    <th className="py-2.5 px-3">Order #</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Customer UPI UTR / Ref</th>
                    <th className="py-2.5 px-3">Amount Due</th>
                    <th className="py-2.5 px-3">Submitted At</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {pendingUpiVerifications.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-3">
                        <span className="font-extrabold text-white text-sm bg-orange-500/20 px-2 py-0.5 rounded text-orange-300">
                          Table {req.table_number}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300 font-bold">
                        {req.order_number}
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {req.customer_name || 'Guest'}
                        {req.customer_phone && <span className="block text-[10px] text-slate-500 font-mono">{req.customer_phone}</span>}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2.5 py-1 bg-amber-400/20 text-amber-300 font-mono font-extrabold rounded-md text-xs tracking-wider border border-amber-500/30">
                          {req.transaction_reference}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <strong className="text-green-400 text-sm font-extrabold">
                          {formatCurrency(req.submitted_amount)}
                        </strong>
                      </td>
                      <td className="py-3 px-3 text-slate-400 font-mono">
                        {formatTime(req.submitted_at)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="success"
                            className="text-xs py-1"
                            leftIcon={<Check className="w-3.5 h-3.5" />}
                            onClick={() => handleApproveUpi(req.id)}
                          >
                            Approve (Mark Paid)
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs py-1 border-red-800 text-red-400 hover:bg-red-950/60"
                            leftIcon={<X className="w-3.5 h-3.5" />}
                            onClick={() => {
                              setRejectingUpiReq(req);
                              setUpiRejectionReason('UTR could not be matched with bank statement.');
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* DIGITAL REWARD CODE REDEMPTION DESK (MODULE 4.3)               */}
        {/* ============================================================== */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-card">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-green-400" />
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-white">
                Customer Reward Redemption Desk
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">Verify 8-Stamp Vouchers</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div className="md:col-span-2 space-y-3">
              <p className="text-xs text-slate-400">
                Enter the unique 8-character reward claim code presented on customer's "My Rewards" page:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. CLM-8492-KW39 or RW-DELIGHT-88"
                  value={rewardCodeInput}
                  onChange={(e) => setRewardCodeInput(e.target.value.toUpperCase())}
                  className="p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm flex-1 focus:outline-none focus:border-green-500 uppercase"
                />
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Search className="w-4 h-4" />}
                  onClick={handleVerifyRewardCode}
                >
                  Verify Code
                </Button>
              </div>

              {rewardRedemptionSuccess && (
                <div className="p-3 bg-green-950/60 border border-green-700/60 rounded-xl text-green-300 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  <span>{rewardRedemptionSuccess}</span>
                </div>
              )}
            </div>

            {/* Verification Result Box */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 min-h-[110px]">
              {verifiedRewardData ? (
                verifiedRewardData.valid ? (
                  <div className="space-y-2">
                    <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400 font-extrabold text-[10px] uppercase">
                      Valid Voucher Unlocked
                    </span>
                    <h5 className="font-bold text-white text-xs mt-1">
                      {verifiedRewardData.reward?.title}
                    </h5>
                    <p className="text-[11px] text-slate-400">
                      Member: <strong className="text-slate-200">{verifiedRewardData.customer?.full_name}</strong>
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      Expires: {verifiedRewardData.reward ? formatDate(verifiedRewardData.reward.expires_at) : '—'}
                    </p>
                    <Button
                      size="sm"
                      variant="success"
                      className="w-full text-xs mt-2 py-1.5"
                      leftIcon={<Gift className="w-3.5 h-3.5" />}
                      onClick={handleConfirmRedeemReward}
                    >
                      Confirm Reward Redemption
                    </Button>
                  </div>
                ) : (
                  <div className="text-red-400 text-xs space-y-1">
                    <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-bold text-[10px] uppercase">
                      Invalid / Already Redeemed
                    </span>
                    <p className="mt-1 font-semibold">{verifiedRewardData.message}</p>
                  </div>
                )
              ) : (
                <div className="text-slate-500 text-xs text-center py-4">
                  <span>Enter reward voucher code above to verify eligibility.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* REPEAT SCAN CONFIRMATION ALERTS (High Priority Counter Task) */}
        {pendingRepeatScans.length > 0 && (
          <div className="bg-amber-950/40 border border-amber-500/50 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 animate-bounce" />
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-amber-300">
                Repeat QR Scan Detected ({pendingRepeatScans.length})
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingRepeatScans.map((req) => (
                <div
                  key={req.id}
                  className="bg-slate-900 border border-amber-500/40 rounded-xl p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-extrabold text-xs">
                      Table {req.table?.table_number}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Scanned at {formatTime(req.new_scan_time)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">
                    Existing active session is ongoing. Confirm whether to continue current session or open new party session.
                  </p>

                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <Button
                      size="sm"
                      variant="orange"
                      className="text-xs py-1"
                      onClick={() => handleRepeatScanDecision(req.id, 'APPROVED_CONTINUE')}
                    >
                      Continue Session
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs py-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                      onClick={() => handleRepeatScanDecision(req.id, 'APPROVED_NEW')}
                    >
                      New Party
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PENDING CASH BILLS TABLE */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-card">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <div className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-amber-400" />
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-white">
                Pending Cash Collections ({pendingCashPayments.length})
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">Verify Cash In Hand</span>
          </div>

          {pendingCashPayments.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-1 opacity-30 text-green-400" />
              <span>No pending cash collections at this time.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="py-2.5 px-3">Table</th>
                    <th className="py-2.5 px-3">Session Ref</th>
                    <th className="py-2.5 px-3">Amount Due</th>
                    <th className="py-2.5 px-3">Requested At</th>
                    <th className="py-2.5 px-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {pendingCashPayments.map((pay) => {
                    const table = dbAdapter.getTables().find((t) => t.id === pay.table_id);
                    return (
                      <tr key={pay.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-3">
                          <span className="font-extrabold text-white text-sm">
                            Table {table?.table_number}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400">
                          {pay.table_session_id.substring(0, 12)}...
                        </td>
                        <td className="py-3 px-3">
                          <strong className="text-amber-400 text-sm">
                            {formatCurrency(pay.amount)}
                          </strong>
                        </td>
                        <td className="py-3 px-3 text-slate-400 font-mono">
                          {formatTime(pay.created_at)}
                        </td>
                        <td className="py-3 px-3">
                          <Button
                            size="sm"
                            variant="orange"
                            leftIcon={<Banknote className="w-3.5 h-3.5" />}
                            onClick={() => handleOpenCashModal(pay)}
                          >
                            Collect Cash
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RECENT SETTLED INVOICES TABLE */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-card">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-brand-purple" />
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-white">
                Settled Tax Invoices ({invoices.length})
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">GST Compliant</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3">Invoice No</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Payment Method</th>
                  <th className="py-2.5 px-3">Total Amount</th>
                  <th className="py-2.5 px-3">Issued Time</th>
                  <th className="py-2.5 px-3">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {invoices.slice(0, 8).map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono font-bold text-brand-purple">
                      {inv.invoice_number}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {inv.customer_name || 'Walk-in Guest'}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-green-400">
                      {inv.payment_method}
                    </td>
                    <td className="py-2.5 px-3 font-extrabold text-white">
                      {formatCurrency(inv.total_amount)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono">
                      {formatDateTime(inv.issued_at)}
                    </td>
                    <td className="py-2.5 px-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="text-xs py-1"
                        leftIcon={<Printer className="w-3.5 h-3.5" />}
                        onClick={() => setSelectedInvoice(inv)}
                      >
                        Print / View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ============================================================== */}
        {/* TABLE-WISE DAILY COLLECTION & BILLING LEDGER */}
        {/* ============================================================== */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-brand-orange" />
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-white">
                  Table-Wise Collections & Billing Ledger
                </h3>
                <p className="text-xs text-slate-400">
                  Daily financial breakdown by table: orders, settled bills, cash vs. UPI collection & pending dues
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="date"
                  value={collectionDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
                  className="bg-transparent text-xs text-white focus:outline-none"
                />
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter table..."
                  value={tableSearchQuery}
                  onChange={(e) => setTableSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-brand-orange w-32 sm:w-40"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3">Table</th>
                  <th className="py-2.5 px-3">Capacity</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-center">Today's Orders</th>
                  <th className="py-2.5 px-3 text-center">Settled Bills</th>
                  <th className="py-2.5 px-3 text-right">Cash Received</th>
                  <th className="py-2.5 px-3 text-right">UPI Received</th>
                  <th className="py-2.5 px-3 text-right">Total Billed</th>
                  <th className="py-2.5 px-3 text-right">Pending Due</th>
                  <th className="py-2.5 px-3">Last Settlement</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {tableSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-6 text-center text-slate-500 text-xs">
                      No tables match the selected date or search filter.
                    </td>
                  </tr>
                ) : (
                  tableSummaries.map((s) => {
                    const originalTable = tables.find((t) => t.id === s.tableId);
                    return (
                      <tr key={s.tableId} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3">
                          <span className="font-extrabold text-white text-sm">
                            {s.tableNumber}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">
                          {s.capacity} Seats
                        </td>
                        <td className="py-2.5 px-3">
                          <TableStatusBadge status={s.currentStatus} />
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-white">
                          {s.todayOrdersCount}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-green-400">
                          {s.completedBillsCount}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-amber-300">
                          {formatCurrency(s.cashCollection)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-brand-purple">
                          {formatCurrency(s.upiCollection)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-white">
                          {formatCurrency(s.totalBilledAmount)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-extrabold text-orange-400">
                          {s.pendingAmount > 0 ? formatCurrency(s.pendingAmount) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                          {s.lastTransactionTime ? formatTime(s.lastTransactionTime) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {originalTable && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="text-xs py-1 px-2.5"
                              leftIcon={<Eye className="w-3 h-3" />}
                              onClick={() => setSelectedDetailTable(originalTable)}
                            >
                              Inspect
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {tableSummaries.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-700 bg-slate-800/30 font-bold text-white text-xs">
                    <td colSpan={3} className="py-3 px-3">
                      Total ({tableSummaries.length} Tables)
                    </td>
                    <td className="py-3 px-3 text-center">
                      {tableSummaries.reduce((sum, s) => sum + s.todayOrdersCount, 0)}
                    </td>
                    <td className="py-3 px-3 text-center text-green-400">
                      {tableSummaries.reduce((sum, s) => sum + s.completedBillsCount, 0)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-amber-300">
                      {formatCurrency(tableSummaries.reduce((sum, s) => sum + s.cashCollection, 0))}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-brand-purple">
                      {formatCurrency(tableSummaries.reduce((sum, s) => sum + s.upiCollection, 0))}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-white font-black">
                      {formatCurrency(tableSummaries.reduce((sum, s) => sum + s.totalBilledAmount, 0))}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-orange-400 font-black">
                      {formatCurrency(tableSummaries.reduce((sum, s) => sum + s.pendingAmount, 0))}
                    </td>
                    <td colSpan={2} className="py-3 px-3 text-slate-500 font-normal">
                      As of {collectionDate}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Cash Collection Modal */}
      <Modal
        isOpen={Boolean(confirmingPayment)}
        onClose={() => setConfirmingPayment(null)}
        title="Collect & Confirm Cash Payment"
        description="Verify physical cash note received from customer before confirming"
      >
        {confirmedResult ? (
          <div className="space-y-4 text-center py-4">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto animate-bounce" />
            <h4 className="font-extrabold text-slate-900 text-base">Payment Confirmed as PAID!</h4>
            <p className="text-xs text-slate-500">
              Invoice #{confirmedResult.invoice.invoice_number} generated. Table marked for cleaning.
            </p>

            {confirmedResult.stampAwarded && (
              <p className="text-xs font-bold text-amber-600 bg-amber-50 p-2 rounded-xl border border-amber-200">
                +1 Loyalty Stamp awarded to registered customer!
              </p>
            )}

            <Button
              className="w-full mt-2"
              variant="orange"
              onClick={() => {
                const inv = confirmedResult.invoice;
                setConfirmingPayment(null);
                setSelectedInvoice(inv);
              }}
            >
              Print Tax Invoice
            </Button>
          </div>
        ) : (
          confirmingPayment && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">Bill Amount Due:</p>
                  <p className="text-2xl font-extrabold text-slate-900">
                    {formatCurrency(confirmingPayment.amount)}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                  Cash Collection
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Enter Cash Received from Customer:
                </label>
                <input
                  type="number"
                  step="1"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(parseFloat(e.target.value) || 0)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-base font-extrabold focus:outline-none focus:border-brand-purple"
                />
              </div>

              {/* Change Calculator */}
              <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Change to Return Customer:</span>
                <strong
                  className={`text-base font-extrabold ${
                    cashReceived >= confirmingPayment.amount ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  {cashReceived >= confirmingPayment.amount
                    ? formatCurrency(cashReceived - confirmingPayment.amount)
                    : 'Insufficient Cash'}
                </strong>
              </div>

              <Button
                className="w-full mt-2"
                variant="orange"
                size="lg"
                disabled={cashReceived < confirmingPayment.amount}
                onClick={handleConfirmCashCollection}
              >
                Confirm Cash Collection & Emit Invoice
              </Button>
            </div>
          )
        )}
      </Modal>

      {/* Reject UPI Request Modal */}
      <Modal
        isOpen={Boolean(rejectingUpiReq)}
        onClose={() => setRejectingUpiReq(null)}
        title="Reject UPI Payment Request"
        description={
          rejectingUpiReq
            ? `Table ${rejectingUpiReq.table_number} • UTR: ${rejectingUpiReq.transaction_reference}`
            : ''
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Specify the reason for rejection. This reason will be displayed on the customer's payment screen:
          </p>

          <textarea
            rows={3}
            value={upiRejectionReason}
            onChange={(e) => setUpiRejectionReason(e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-brand-purple"
            placeholder="e.g. UTR not found in merchant bank account statement."
          />

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setRejectingUpiReq(null)}
            >
              Cancel
            </Button>
            <Button
              variant="orange"
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              onClick={handleRejectUpi}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invoice Preview Modal */}
      <Modal
        isOpen={Boolean(selectedInvoice)}
        onClose={() => setSelectedInvoice(null)}
        maxWidth="xl"
      >
        {selectedInvoice && (
          <PrintableInvoice
            invoice={selectedInvoice}
            restaurant={restaurant}
            onClose={() => setSelectedInvoice(null)}
          />
        )}
      </Modal>

      {/* Complete Table Details & Live Menu Modal */}
      <TableDetailModal
        table={selectedDetailTable}
        isOpen={Boolean(selectedDetailTable)}
        onClose={() => setSelectedDetailTable(null)}
        onStatusChange={handleTableStatusChange}
      />
    </StaffLayout>
  );
};
