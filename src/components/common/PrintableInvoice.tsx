import React from 'react';
import { Invoice, Order, Restaurant } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { formatDateTime } from '../../utils/date';
import { Button } from '../ui/Button';
import { Printer, Download } from 'lucide-react';
import { PDFInvoiceService } from '../../services/pdfService';

interface PrintableInvoiceProps {
  invoice: Invoice;
  restaurant: Restaurant;
  order?: Order;
  onClose?: () => void;
}

export const PrintableInvoice: React.FC<PrintableInvoiceProps> = ({
  invoice,
  restaurant,
  order,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    PDFInvoiceService.generateInvoicePDF(invoice, restaurant, order);
  };

  return (
    <div className="bg-white p-6 max-w-xl mx-auto rounded-2xl shadow-elevated border border-slate-200">
      <div className="flex justify-end gap-2 mb-4 no-print">
        <Button size="sm" variant="outline" leftIcon={<Printer className="w-4 h-4" />} onClick={handlePrint}>
          Print Receipt
        </Button>
        <Button size="sm" variant="primary" leftIcon={<Download className="w-4 h-4" />} onClick={handleDownloadPDF}>
          Download PDF
        </Button>
      </div>

      <div className="border-b border-slate-200 pb-4 text-center">
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{restaurant.name}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{restaurant.tagline}</p>
        <p className="text-xs text-slate-600 mt-1">{restaurant.address}, {restaurant.city}</p>
        <p className="text-xs text-slate-600">Phone: {restaurant.phone} | Email: {restaurant.email}</p>
        <div className="flex justify-center gap-3 text-[11px] text-slate-500 mt-1 font-mono">
          <span>GSTIN: {restaurant.gstin || '29ABCDE1234F1Z5'}</span>
          <span>•</span>
          <span>FSSAI: {restaurant.fssai_license || '11223344556677'}</span>
        </div>
      </div>

      <div className="my-4 py-2 border-y border-dashed border-slate-300 grid grid-cols-2 text-xs">
        <div>
          <p><span className="text-slate-500">Invoice No:</span> <strong className="font-mono">{invoice.invoice_number}</strong></p>
          <p><span className="text-slate-500">Date:</span> {formatDateTime(invoice.issued_at)}</p>
          <p><span className="text-slate-500">Table:</span> <strong>Table #{invoice.table_id.substring(0, 5)}</strong></p>
        </div>
        <div className="text-right">
          <p><span className="text-slate-500">Payment:</span> <span className="font-bold text-green-700">{invoice.payment_method}</span></p>
          <p><span className="text-slate-500">Status:</span> <strong className="text-green-600">PAID</strong></p>
          {invoice.customer_phone && (
            <p><span className="text-slate-500">Customer:</span> {invoice.customer_name || 'Guest'} ({invoice.customer_phone})</p>
          )}
        </div>
      </div>

      <table className="w-full text-xs text-left my-4">
        <thead>
          <tr className="border-b border-slate-200 font-bold text-slate-700">
            <th className="py-2">Item</th>
            <th className="py-2 text-center">Qty</th>
            <th className="py-2 text-right">Rate</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {order && order.items && order.items.length > 0 ? (
            order.items.map(item => (
              <tr key={item.id}>
                <td className="py-2 font-medium text-slate-800">{item.item_name}</td>
                <td className="py-2 text-center">{item.quantity}</td>
                <td className="py-2 text-right">{formatCurrency(item.unit_price)}</td>
                <td className="py-2 text-right font-medium">{formatCurrency(item.total_price)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="py-2 font-medium text-slate-800">Dining Food & Beverage Service</td>
              <td className="py-2 text-center">1</td>
              <td className="py-2 text-right">{formatCurrency(invoice.subtotal_amount)}</td>
              <td className="py-2 text-right font-medium">{formatCurrency(invoice.subtotal_amount)}</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="border-t border-slate-200 pt-3 space-y-1.5 text-xs">
        <div className="flex justify-between text-slate-600">
          <span>Taxable Subtotal:</span>
          <span>{formatCurrency(invoice.subtotal_amount)}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>CGST ({invoice.cgst_rate}%):</span>
          <span>{formatCurrency(invoice.cgst_amount)}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>SGST ({invoice.sgst_rate}%):</span>
          <span>{formatCurrency(invoice.sgst_amount)}</span>
        </div>
        {invoice.discount_amount > 0 && (
          <div className="flex justify-between text-green-600 font-semibold">
            <span>Discount:</span>
            <span>-{formatCurrency(invoice.discount_amount)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-extrabold text-slate-900 border-t border-slate-300 pt-2">
          <span>TOTAL AMOUNT:</span>
          <span className="text-brand-purple">{formatCurrency(invoice.total_amount)}</span>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-dashed border-slate-300 text-center text-[10px] text-slate-500">
        <p className="font-semibold text-slate-700">Thank you for dining with us!</p>
        <p className="mt-0.5">Please visit again. For feedback & party bookings, call {restaurant.phone}.</p>
        <p className="mt-1 font-mono text-slate-400">Powered by RESTO OS • Real-Time Cloud POS</p>
      </div>
    </div>
  );
};
