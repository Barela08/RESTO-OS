import React, { useState, useEffect } from 'react';
import { dbAdapter } from '../../services/databaseAdapter';
import { Payment, Invoice } from '../../types';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { formatCurrency } from '../../utils/currency';
import { formatDateTime } from '../../utils/date';
import { PaymentStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { PrintableInvoice } from '../../components/common/PrintableInvoice';
import { CreditCard, Printer, FileText } from 'lucide-react';

export const AdminPayments: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const restaurant = dbAdapter.getRestaurant();

  useEffect(() => {
    setPayments([...dbAdapter.getPayments()]);
    setInvoices([...dbAdapter.getInvoices()]);
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Payments & Tax Invoices</h1>
          <p className="text-xs text-slate-500 mt-0.5">Audited payment ledger, transaction references and GST invoice archives</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3">Transaction Date</th>
                  <th className="py-2.5 px-3">Table Session</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Payment Status</th>
                  <th className="py-2.5 px-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => {
                  const inv = invoices.find(i => i.payment_id === p.id);
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
