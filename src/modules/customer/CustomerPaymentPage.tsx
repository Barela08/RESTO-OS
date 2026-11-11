import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { dbAdapter } from '../../services/databaseAdapter';
import { Order, Payment, Invoice } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { Button } from '../../components/ui/Button';
import { PrintableInvoice } from '../../components/common/PrintableInvoice';
import {
  CreditCard,
  Banknote,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Sparkles,
  ArrowLeft,
  Clock,
} from 'lucide-react';

export const CustomerPaymentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'UPI' | 'CASH'>('UPI');
  const [isProcessing, setIsProcessing] = useState(false);
  const [stampWon, setStampWon] = useState(false);

  const restaurant = dbAdapter.getRestaurant();

  useEffect(() => {
    const updateData = () => {
      const ord = dbAdapter.getOrders().find(o => o.id === id);
      if (ord) {
        setOrder({ ...ord });
        // Find existing payment if any
        const existingPay = dbAdapter.getPayments().find(p => p.table_session_id === ord.table_session_id);
        if (existingPay) {
          setPayment({ ...existingPay });
          const inv = dbAdapter.getInvoices().find(i => i.payment_id === existingPay.id);
          if (inv) setInvoice({ ...inv });
        }
      }
    };
    updateData();
    return dbAdapter.subscribe(updateData);
  }, [id]);

  if (!order) {
    return (
      <div className="text-center py-12 bg-white rounded-3xl p-8 border border-slate-100">
        <h3 className="font-bold text-slate-900 text-base">Order Not Found</h3>
        <Link to="/order">
          <Button variant="orange" size="sm" className="mt-4">Return to Menu</Button>
        </Link>
      </div>
    );
  }

  // Handle Online UPI Settlement
  const handlePayOnline = async () => {
    setIsProcessing(true);
    try {
      // 1. Initiate Online Payment
      const pay = dbAdapter.initiateCustomerPayment({
        tableSessionId: order.table_session_id,
        method: 'UPI',
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
      });

      // 2. Simulate gateway webhook response (Razorpay UPI verification)
      setTimeout(() => {
        const result = dbAdapter.confirmPayment({
          paymentId: pay.id,
          staffId: 'st-ctr-1',
          transactionRef: `UPI-RZP-${Date.now()}`,
        });
        setPayment({ ...pay, payment_status: 'PAID' });
        setInvoice(result.invoice);
        setStampWon(result.stampAwarded);
        setIsProcessing(false);
      }, 1500);
    } catch (err: unknown) {
      alert((err as Error).message || 'Payment initiation failed');
      setIsProcessing(false);
    }
  };

  // Handle Pay at Cash Counter
  const handlePayAtCounter = () => {
    setIsProcessing(true);
    try {
      const pay = dbAdapter.initiateCustomerPayment({
        tableSessionId: order.table_session_id,
        method: 'CASH',
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
      });
      setPayment(pay);
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Link
        to={`/order/track/${order.id}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Order Tracking</span>
      </Link>

      {/* Bill Success State if Paid */}
      {invoice && payment?.payment_status === 'PAID' ? (
        <div className="space-y-4">
          <div className="p-6 bg-green-50 border border-green-200 rounded-3xl text-center">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-2 animate-bounce" />
            <h3 className="text-lg font-extrabold text-green-950">Payment Confirmed!</h3>
            <p className="text-xs text-green-800 mt-0.5">
              Thank you for dining at {restaurant.name}. Your tax invoice has been generated.
            </p>

            {stampWon && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 border border-amber-300 rounded-full text-xs font-bold text-amber-900 shadow-sm animate-pulse">
                <Sparkles className="w-4 h-4 text-brand-orange" />
                <span>+1 Digital Loyalty Stamp Earned!</span>
              </div>
            )}
          </div>

          <PrintableInvoice invoice={invoice} restaurant={restaurant} order={order} />

          <div className="text-center pt-2">
            <Link to="/my-rewards">
              <Button variant="orange" className="w-full">
                View My Loyalty Stamps & Rewards
              </Button>
            </Link>
          </div>
        </div>
      ) : payment?.payment_method === 'CASH' && payment.payment_status === 'PENDING' ? (
        /* Cash Payment Pending Notification */
        <div className="bg-white rounded-3xl border border-amber-200 shadow-card p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
            <Clock className="w-7 h-7 animate-pulse" />
          </div>
          <div>
            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold uppercase tracking-wider">
              Payment Pending at Cash Counter
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 mt-2">
              Please Pay at the Cash Counter
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
              Please present your table number (<strong>Table {order.table?.table_number}</strong>) at the front desk. Our cashier will collect the cash and confirm your payment.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left text-xs space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Amount Due:</span>
              <strong className="text-base text-slate-900">{formatCurrency(payment.amount)}</strong>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Table:</span>
              <span>Table {order.table?.table_number}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Order Reference:</span>
              <span className="font-mono">{order.order_number}</span>
            </div>
          </div>

          <p className="text-[11px] text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200">
            <strong>Security Notice:</strong> Selecting cash does not automatically close your table bill. Authorized counter staff verification is required.
          </p>
        </div>
      ) : (
        /* Payment Options Selection */
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-6">
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight mb-1">
              Final Bill Settlement
            </h2>
            <p className="text-xs text-slate-500">
              Table {order.table?.table_number} • Order #{order.order_number}
            </p>

            <div className="my-4 py-3 border-y border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Taxable Subtotal:</span>
                <span>{formatCurrency(order.subtotal_amount)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>CGST (2.5%):</span>
                <span>{formatCurrency(order.cgst_amount)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>SGST (2.5%):</span>
                <span>{formatCurrency(order.sgst_amount)}</span>
              </div>
              <div className="flex justify-between text-lg font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Payable:</span>
                <span className="text-brand-orange">{formatCurrency(order.total_amount)}</span>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Payment Option
              </label>

              {/* Option A: Pay Online */}
              <button
                type="button"
                onClick={() => setSelectedMethod('UPI')}
                className={`w-full p-4 rounded-2xl border flex items-center justify-between text-left transition-all ${
                  selectedMethod === 'UPI'
                    ? 'border-brand-orange bg-orange-50/50 ring-2 ring-brand-orange/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-brand-purple flex items-center justify-center">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">Pay Online (Instant UPI)</h4>
                    <p className="text-[11px] text-slate-500">Google Pay, PhonePe, Paytm, BHIM</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-brand-orange">Recommended</span>
              </button>

              {/* Option B: Pay at Counter */}
              <button
                type="button"
                onClick={() => setSelectedMethod('CASH')}
                className={`w-full p-4 rounded-2xl border flex items-center justify-between text-left transition-all ${
                  selectedMethod === 'CASH'
                    ? 'border-brand-orange bg-orange-50/50 ring-2 ring-brand-orange/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">Pay at Cash Counter</h4>
                    <p className="text-[11px] text-slate-500">Settle physical cash with front desk</p>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-6">
              {selectedMethod === 'UPI' ? (
                <Button
                  className="w-full"
                  variant="orange"
                  size="lg"
                  isLoading={isProcessing}
                  onClick={handlePayOnline}
                >
                  Pay {formatCurrency(order.total_amount)} via UPI
                </Button>
              ) : (
                <Button
                  className="w-full"
                  variant="secondary"
                  size="lg"
                  isLoading={isProcessing}
                  onClick={handlePayAtCounter}
                >
                  Confirm Pay at Cash Counter
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
