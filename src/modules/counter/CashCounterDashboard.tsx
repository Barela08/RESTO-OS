import React, { useState, useEffect } from 'react';
import { dbAdapter } from '../../services/databaseAdapter';
import { Order, Payment, Invoice, RepeatScanRequest } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { formatDateTime, formatTime } from '../../utils/date';
import { StaffLayout } from '../../components/layout/StaffLayout';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { PaymentStatusBadge, OrderStatusBadge } from '../../components/ui/Badge';
import { PrintableInvoice } from '../../components/common/PrintableInvoice';
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
} from 'lucide-react';

export const CashCounterDashboard: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [repeatScanRequests, setRepeatScanRequests] = useState<RepeatScanRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Cash Confirmation Modal State
  const [confirmingPayment, setConfirmingPayment] = useState<Payment | null>(null);
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [cashNotes, setCashNotes] = useState<string>('');
  const [confirmedResult, setConfirmedResult] = useState<{ invoice: Invoice; stampAwarded: boolean } | null>(null);

  // Invoice Preview Modal
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const restaurant = dbAdapter.getRestaurant();

  useEffect(() => {
    const updateData = () => {
      setPayments([...dbAdapter.getPayments()]);
      setOrders([...dbAdapter.getOrders()]);
      setInvoices([...dbAdapter.getInvoices()]);
      setRepeatScanRequests([...dbAdapter.getRepeatScanRequests()]);
    };
    updateData();
    return dbAdapter.subscribe(updateData);
  }, []);

  // Filter pending cash payments and paid transactions
  const pendingPayments = payments.filter(p => p.payment_status === 'PENDING');
  const paidPayments = payments.filter(p => p.payment_status === 'PAID');
  const pendingRepeatScans = repeatScanRequests.filter(r => r.status === 'PENDING');

  const totalCashCollected = paidPayments
    .filter(p => p.payment_method === 'CASH')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalOnlineCollected = paidPayments
    .filter(p => p.payment_method === 'UPI' || p.payment_method === 'RAZORPAY')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPendingAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

  const handleOpenCashModal = (pay: Payment) => {
    setConfirmingPayment(pay);
    setCashReceived(Math.ceil(pay.amount));
    setCashNotes('');
    setConfirmedResult(null);
  };

  const handleConfirmCashCollection = () => {
    if (!confirmingPayment) return;
    if (cashReceived < confirmingPayment.amount) {
      alert('Received amount is less than the bill total!');
      return;
    }

    const result = dbAdapter.confirmPayment({
      paymentId: confirmingPayment.id,
      staffId: 'st-ctr-1',
      cashReceivedAmount: cashReceived,
    });

    setConfirmedResult(result);
  };

  const handleRepeatScanDecision = (reqId: string, decision: 'APPROVED_CONTINUE' | 'APPROVED_NEW' | 'REJECTED') => {
    dbAdapter.handleRepeatScanApproval(reqId, decision, 'st-ctr-1');
  };

  return (
    <StaffLayout
      title="Cash Counter & Front Desk POS"
      subtitle="Bill Settlement, Cash Verification & Repeat Scan Authorizations"
      activeRole="counter"
    >
      <div className="space-y-6">
        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cash Collection</span>
            <p className="text-xl font-extrabold text-white mt-1">{formatCurrency(totalCashCollected)}</p>
            <span className="text-[10px] text-green-400 font-semibold">Verified at Register</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Online UPI Collection</span>
            <p className="text-xl font-extrabold text-white mt-1">{formatCurrency(totalOnlineCollected)}</p>
            <span className="text-[10px] text-brand-purple font-semibold">Digital Settlements</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pending Cash Bills</span>
            <p className="text-xl font-extrabold text-amber-400 mt-1">{formatCurrency(totalPendingAmount)}</p>
            <span className="text-[10px] text-amber-400 font-semibold">{pendingPayments.length} Tables Awaiting</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Repeat Scan Alerts</span>
            <p className="text-xl font-extrabold text-white mt-1">{pendingRepeatScans.length}</p>
            <span className="text-[10px] text-orange-400 font-semibold">Requires Staff Approval</span>
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

        {/* PENDING BILLS TABLE */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-card">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <div className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-amber-400" />
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-white">
                Pending Cash Collections ({pendingPayments.length})
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">Verify Cash In Hand</span>
          </div>

          {pendingPayments.length === 0 ? (
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
                  {pendingPayments.map((pay) => {
                    const table = dbAdapter.getTables().find(t => t.id === pay.table_id);
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
        ) : confirmingPayment && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Bill Amount Due:</p>
                <p className="text-2xl font-extrabold text-slate-900">{formatCurrency(confirmingPayment.amount)}</p>
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
              <strong className={`text-base font-extrabold ${cashReceived >= confirmingPayment.amount ? 'text-green-600' : 'text-red-500'}`}>
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
        )}
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
    </StaffLayout>
  );
};
