import React, { useState, useEffect } from 'react';
import { dbAdapter } from '../../services/databaseAdapter';
import { Payment, Invoice, PaymentVerificationRequest, NotificationEvent } from '../../types';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { formatCurrency } from '../../utils/currency';
import { formatDateTime, formatTime } from '../../utils/date';
import { PaymentStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { PrintableInvoice } from '../../components/common/PrintableInvoice';
import {
  CreditCard,
  Printer,
  FileText,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Volume2,
  AlertTriangle,
  QrCode,
} from 'lucide-react';

export const AdminPayments: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<PaymentVerificationRequest[]>([]);
  const [notificationEvents, setNotificationEvents] = useState<NotificationEvent[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'VERIFICATIONS' | 'EVENTS'>('LEDGER');

  const restaurant = dbAdapter.getRestaurant();

  useEffect(() => {
    const update = () => {
      setPayments([...dbAdapter.getPayments()]);
      setInvoices([...dbAdapter.getInvoices()]);
      setVerificationRequests([...dbAdapter.getPaymentVerificationRequests()]);
      setNotificationEvents([...dbAdapter.getNotificationEvents()]);
    };
    update();
    return dbAdapter.subscribe(update);
  }, []);

  const pendingVerificationCount = verificationRequests.filter((r) => r.status === 'PENDING').length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Payments, Verification & Audit Logs
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audited ledger, manual UPI verification monitoring and voice event history
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
          <button
            onClick={() => setActiveTab('LEDGER')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
              activeTab === 'LEDGER'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Tax Invoices & Payments ({invoices.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('VERIFICATIONS')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
              activeTab === 'VERIFICATIONS'
                ? 'bg-brand-orange text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>UPI Verification Monitoring</span>
            {pendingVerificationCount > 0 && (
              <span className="px-2 py-0.5 bg-white text-brand-orange rounded-full text-[10px] font-extrabold">
                {pendingVerificationCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('EVENTS')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
              activeTab === 'EVENTS'
                ? 'bg-brand-purple text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>Voice Event History ({notificationEvents.length})</span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: AUDITED PAYMENT & INVOICE LEDGER                        */}
        {/* ============================================================== */}
        {activeTab === 'LEDGER' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                    <th className="py-2.5 px-3">Transaction Date</th>
                    <th className="py-2.5 px-3">Table Session</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">UTR / Ref</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Payment Status</th>
                    <th className="py-2.5 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((p) => {
                    const inv = invoices.find((i) => i.payment_id === p.id);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3 font-mono text-slate-600">
                          {formatDateTime(p.created_at)}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-500">
                          {p.table_session_id.substring(0, 10)}...
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-800">
                          {p.payment_method}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600">
                          {inv?.transaction_ref || p.notes?.replace('Submitted UPI UTR: ', '') || '—'}
                        </td>
                        <td className="py-3 px-3 font-extrabold text-slate-900 text-sm">
                          {formatCurrency(p.amount)}
                        </td>
                        <td className="py-3 px-3">
                          <PaymentStatusBadge status={p.payment_status} />
                        </td>
                        <td className="py-3 px-3">
                          {inv ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="text-xs py-1"
                              leftIcon={<Printer className="w-3.5 h-3.5" />}
                              onClick={() => setSelectedInvoice(inv)}
                            >
                              Invoice
                            </Button>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: UPI VERIFICATION MONITORING (MODULE 2.4 / 6.1)          */}
        {/* ============================================================== */}
        {activeTab === 'VERIFICATIONS' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
              <h3 className="font-extrabold text-slate-900 text-sm mb-1 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-orange" />
                <span>UPI Payment Verification Requests</span>
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Customer-submitted transaction references (UTRs) requiring counter verification before order completion.
              </p>

              {verificationRequests.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-1 opacity-30 text-green-500" />
                  <span>No UPI verification requests submitted yet.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                        <th className="py-2.5 px-3">Submitted At</th>
                        <th className="py-2.5 px-3">Table</th>
                        <th className="py-2.5 px-3">Order #</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Transaction Ref (UTR)</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Verified By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {verificationRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3 font-mono text-slate-500">
                            {formatTime(req.submitted_at)}
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-900">
                            Table {req.table_number}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600">
                            {req.order_number}
                          </td>
                          <td className="py-3 px-3 text-slate-700">
                            {req.customer_name || 'Guest'}
                          </td>
                          <td className="py-3 px-3 font-mono font-extrabold text-slate-900">
                            {req.transaction_reference}
                          </td>
                          <td className="py-3 px-3 font-extrabold text-slate-900">
                            {formatCurrency(req.submitted_amount)}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                                req.status === 'APPROVED'
                                  ? 'bg-green-100 text-green-800'
                                  : req.status === 'REJECTED'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-amber-100 text-amber-800 animate-pulse'
                              }`}
                            >
                              {req.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3" />}
                              {req.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                              {req.status === 'PENDING' && <Clock className="w-3 h-3" />}
                              {req.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {req.verifier_name || (req.status === 'PENDING' ? 'Awaiting Counter' : '—')}
                            {req.rejection_reason && (
                              <p className="text-[10px] text-red-600 italic mt-0.5">
                                Reason: {req.rejection_reason}
                              </p>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: VOICE EVENT HISTORY (MODULE 1.7 / 6.1)                  */}
        {/* ============================================================== */}
        {activeTab === 'EVENTS' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
            <h3 className="font-extrabold text-slate-900 text-sm mb-1 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-brand-purple" />
              <span>Voice Announcement Event Stream</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Real-time audit log of spoken notifications dispatched across restaurant terminals.
            </p>

            {notificationEvents.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                <span>No voice events logged in this session.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                      <th className="py-2.5 px-3">Event Timestamp</th>
                      <th className="py-2.5 px-3">Event Type</th>
                      <th className="py-2.5 px-3">Reference ID</th>
                      <th className="py-2.5 px-3">Payload Summary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {notificationEvents.slice(0, 30).map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono text-slate-500">
                          {formatDateTime(ev.created_at)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-purple-50 text-brand-purple font-bold text-[10px] font-mono">
                            {ev.event_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">
                          {ev.reference_id || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {ev.event_payload.table_number && `Table ${ev.event_payload.table_number} `}
                          {ev.event_payload.amount && `• ${formatCurrency(ev.event_payload.amount)} `}
                          {ev.event_payload.waiter_name && `• Waiter: ${ev.event_payload.waiter_name} `}
                          {ev.event_payload.reason && `• Note: ${ev.event_payload.reason}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal isOpen={Boolean(selectedInvoice)} onClose={() => setSelectedInvoice(null)} maxWidth="xl">
        {selectedInvoice && (
          <PrintableInvoice
            invoice={selectedInvoice}
            restaurant={restaurant}
            onClose={() => setSelectedInvoice(null)}
          />
        )}
      </Modal>
    </AdminLayout>
  );
};
