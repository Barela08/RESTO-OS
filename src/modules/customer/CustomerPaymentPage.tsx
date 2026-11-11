import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { dbAdapter } from '../../services/databaseAdapter';
import { QRService } from '../../services/qrService';
import { Order, Payment, Invoice, PaymentSettings, PaymentVerificationRequest } from '../../types';
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
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  XCircle,
  HelpCircle,
} from 'lucide-react';

export const CustomerPaymentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(dbAdapter.getPaymentSettings());
  const [verificationReq, setVerificationReq] = useState<PaymentVerificationRequest | null>(null);

  const [selectedMethod, setSelectedMethod] = useState<'UPI' | 'CASH'>('UPI');
  const [transactionRef, setTransactionRef] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [dynamicQrUrl, setDynamicQrUrl] = useState<string>('');
  const [stampWon, setStampWon] = useState(false);

  const restaurant = dbAdapter.getRestaurant();

  useEffect(() => {
    const updateData = () => {
      const ord = dbAdapter.getOrders().find(o => o.id === id);
      if (ord) {
        setOrder({ ...ord });
        setPaymentSettings(dbAdapter.getPaymentSettings());

        // Check for existing payment
        const existingPay = dbAdapter.getPayments().find(
          p => p.table_session_id === ord.table_session_id || p.order_id === ord.id
        );
        if (existingPay) {
          setPayment({ ...existingPay });
          const inv = dbAdapter.getInvoices().find(i => i.payment_id === existingPay.id || i.table_session_id === ord.table_session_id);
          if (inv) {
            setInvoice({ ...inv });
            // Check if loyalty stamp was earned
            if (ord.total_amount >= dbAdapter.getSettings().loyalty_min_order_amount) {
              setStampWon(true);
            }
          }
        }

        // Check for existing verification request
        const req = dbAdapter.getPaymentVerificationRequests().find(
          r => r.order_id === ord.id || (existingPay && r.payment_id === existingPay.id)
        );
        if (req) {
          setVerificationReq({ ...req });
        }
      }
    };

    updateData();
    return dbAdapter.subscribe(updateData);
  }, [id]);

  // Generate dynamic UPI URI and QR code
  useEffect(() => {
    if (!order || !paymentSettings.upi_id) return;

    const amountStr = order.total_amount.toFixed(2);
    const upiUri = `upi://pay?pa=${encodeURIComponent(paymentSettings.upi_id.trim())}&pn=${encodeURIComponent(
      paymentSettings.merchant_name.trim()
    )}&am=${amountStr}&cu=INR&tn=${encodeURIComponent(`Order ${order.order_number}`)}`;

    QRService.generateQRCodeDataUrl(upiUri).then((url) => {
      setDynamicQrUrl(url);
    });
  }, [order, paymentSettings]);

  if (!order) {
    return (
      <div className="text-center py-12 bg-white rounded-3xl p-8 border border-slate-100">
        <h3 className="font-bold text-slate-900 text-base">Order Not Found</h3>
        <Link to="/order">
          <Button variant="orange" size="sm" className="mt-4">
            Return to Menu
          </Button>
        </Link>
      </div>
    );
  }

  const upiUri = `upi://pay?pa=${encodeURIComponent(paymentSettings.upi_id.trim())}&pn=${encodeURIComponent(
    paymentSettings.merchant_name.trim()
  )}&am=${order.total_amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Order ${order.order_number}`)}`;

  const handleCopyUpiId = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(paymentSettings.upi_id);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    }
  };

  // Submit UPI Payment for Counter Verification (Manual QR Workflow)
  const handleSubmitUpiVerification = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanRef = transactionRef.trim().toUpperCase();
    if (!cleanRef || cleanRef.length < 6) {
      setErrorMessage('Please enter a valid UPI transaction reference / UTR (at least 6 characters).');
      return;
    }

    setIsSubmitting(true);
    try {
      // Find logged in customer ID if present
      let customerId: string | undefined;
      if (typeof window !== 'undefined') {
        const storedCustomer = localStorage.getItem('resto_customer_auth');
        if (storedCustomer) {
          try {
            const parsed = JSON.parse(storedCustomer);
            customerId = parsed.id;
          } catch {
            // Ignored
          }
        }
      }

      const result = dbAdapter.submitUpiPaymentVerification({
        tableSessionId: order.table_session_id,
        transactionReference: cleanRef,
        submittedAmount: order.total_amount,
        customerId,
      });

      setVerificationReq(result.request);
      setPayment(result.payment);
      setIsSubmitting(false);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Failed to submit payment verification request.');
      setIsSubmitting(false);
    }
  };

  // Handle Pay at Cash Counter
  const handlePayAtCounter = () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const pay = dbAdapter.initiateCustomerPayment({
        tableSessionId: order.table_session_id,
        method: 'CASH',
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
      });
      setPayment(pay);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsSubmitting(false);
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

      {/* ============================================================== */}
      {/* 1. PAYMENT CONFIRMED / TAX INVOICE STATE                       */}
      {/* ============================================================== */}
      {invoice && payment?.payment_status === 'PAID' ? (
        <div className="space-y-4">
          <div className="p-6 bg-green-50 border border-green-200 rounded-3xl text-center">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-2 animate-bounce" />
            <h3 className="text-lg font-extrabold text-green-950">Payment Confirmed & Verified!</h3>
            <p className="text-xs text-green-800 mt-0.5">
              Thank you for dining at {restaurant.name}. Your tax invoice has been officially generated.
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
      ) : verificationReq && verificationReq.status === 'PENDING' ? (
        /* ============================================================== */
        /* 2. UPI VERIFICATION PENDING AT CASH COUNTER                   */
        /* ============================================================== */
        <div className="bg-white rounded-3xl border border-amber-200 shadow-card p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
            <Clock className="w-7 h-7 animate-pulse text-amber-600" />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold uppercase tracking-wider">
              UPI Verification in Progress
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 mt-2">
              Waiting for Counter Approval
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
              We received your payment reference. Our cash counter staff is verifying the credit in our merchant bank records.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs space-y-2">
            <div className="flex justify-between items-center text-slate-600">
              <span>Submitted UTR / Ref:</span>
              <span className="font-mono font-extrabold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300">
                {verificationReq.transaction_reference}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Amount Submitted:</span>
              <strong className="text-sm text-slate-900 font-extrabold">
                {formatCurrency(verificationReq.submitted_amount)}
              </strong>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Table & Order:</span>
              <span>Table {order.table?.table_number} • {order.order_number}</span>
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 text-left flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              <strong>Zero Fraud Protection:</strong> Static UPI payments require manual verification by our cashier. Once approved, your bill will update here instantly.
            </span>
          </div>

          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs text-slate-600 border-slate-300 hover:bg-slate-100"
              onClick={() => {
                setVerificationReq(null);
                setTransactionRef('');
              }}
            >
              Re-enter Transaction Reference
            </Button>
          </div>
        </div>
      ) : verificationReq && verificationReq.status === 'REJECTED' ? (
        /* ============================================================== */
        /* 3. UPI VERIFICATION REJECTED REASON                           */
        /* ============================================================== */
        <div className="bg-white rounded-3xl border border-red-200 shadow-card p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-inner">
            <XCircle className="w-7 h-7" />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold uppercase tracking-wider">
              Verification Unsuccessful
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 mt-2">
              Payment Not Verified
            </h2>
            <p className="text-xs text-red-700 mt-2 font-medium bg-red-50 p-3 rounded-xl border border-red-200">
              Reason from Cashier: {verificationReq.rejection_reason || 'UTR could not be matched with merchant bank account.'}
            </p>
          </div>

          <p className="text-xs text-slate-600">
            Please double-check your bank reference or choose to pay at the cash counter directly.
          </p>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="orange"
              onClick={() => {
                setVerificationReq(null);
                setTransactionRef('');
              }}
            >
              Enter Correct UTR & Retry
            </Button>
            <Button
              variant="secondary"
              onClick={handlePayAtCounter}
            >
              Pay Cash at Register
            </Button>
          </div>
        </div>
      ) : payment?.payment_method === 'CASH' && payment.payment_status === 'PENDING' ? (
        /* ============================================================== */
        /* 4. CASH PAYMENT PENDING AT REGISTER                           */
        /* ============================================================== */
        <div className="bg-white rounded-3xl border border-amber-200 shadow-card p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
            <Banknote className="w-7 h-7 animate-pulse text-amber-600" />
          </div>

          <div>
            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold uppercase tracking-wider">
              Payment Pending at Cash Counter
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 mt-2">
              Please Pay at the Front Desk
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
              Please present your table number (<strong>Table {order.table?.table_number}</strong>) at the cash counter. Our cashier will collect the cash and confirm your payment.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left text-xs space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Amount Due:</span>
              <strong className="text-base text-slate-900 font-extrabold">{formatCurrency(payment.amount)}</strong>
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

          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs text-slate-600 border-slate-300"
            onClick={() => setSelectedMethod('UPI')}
          >
            Switch to UPI Payment Instead
          </Button>
        </div>
      ) : (
        /* ============================================================== */
        /* 5. PAYMENT METHOD SELECTION & UPI DETAILS                     */
        /* ============================================================== */
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-6">
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight mb-1">
              Final Bill Settlement
            </h2>
            <p className="text-xs text-slate-500">
              {restaurant.name} • Table {order.table?.table_number} • Order #{order.order_number}
            </p>

            {/* Bill Breakdown */}
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

            {/* Channel Selection */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Payment Option
              </label>

              {/* Option A: Direct UPI */}
              {paymentSettings.upi_enabled && (
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
                      <h4 className="font-bold text-slate-900 text-xs">
                        {paymentSettings.upi_display_name || 'Direct UPI (0% Fee)'}
                      </h4>
                      <p className="text-[11px] text-slate-500">Google Pay, PhonePe, Paytm, BHIM</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-brand-orange">Scan & Pay</span>
                </button>
              )}

              {/* Option B: Pay at Cash Counter */}
              {paymentSettings.cash_enabled && (
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
              )}
            </div>

            {/* UPI Payment Flow */}
            {selectedMethod === 'UPI' && (
              <div className="mt-6 pt-5 border-t border-slate-100 space-y-4">
                {/* UPI VPA Display & Copy */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                      Merchant UPI ID (VPA)
                    </span>
                    <span className="font-mono font-bold text-xs text-slate-900">
                      {paymentSettings.upi_id}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-xs py-1"
                    leftIcon={copiedUpi ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    onClick={handleCopyUpiId}
                  >
                    {copiedUpi ? 'Copied!' : 'Copy UPI'}
                  </Button>
                </div>

                {/* QR Code Presentation */}
                <div className="p-5 bg-gradient-to-b from-slate-50 to-orange-50/30 border border-orange-100 rounded-3xl text-center space-y-3">
                  <span className="text-xs font-extrabold text-slate-800 block">
                    Scan with any UPI Application
                  </span>

                  <div className="w-48 h-48 mx-auto bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center">
                    {dynamicQrUrl ? (
                      <img src={dynamicQrUrl} alt="UPI Payment QR" className="w-full h-full object-contain" />
                    ) : paymentSettings.qr_image_url ? (
                      <img src={paymentSettings.qr_image_url} alt="Merchant UPI QR" className="w-full h-full object-contain" />
                    ) : (
                      <QrCode className="w-24 h-24 text-slate-400 animate-pulse" />
                    )}
                  </div>

                  <p className="text-[11px] text-slate-600 max-w-xs mx-auto">
                    Amount: <strong className="text-slate-900">{formatCurrency(order.total_amount)}</strong> • Exact bill amount encoded
                  </p>

                  {/* Intent Link Button (for mobile phones with GPay/PhonePe installed) */}
                  <a
                    href={upiUri}
                    className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-brand-purple hover:bg-brand-purple-hover text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Pay Using UPI App on This Phone</span>
                  </a>
                </div>

                {/* Instructions */}
                <p className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {paymentSettings.payment_instructions ||
                    'Scan the QR code using any UPI app (GPay, PhonePe, Paytm, BHIM) and enter the 12-digit UTR/Ref number below.'}
                </p>

                {/* Error message */}
                {errorMessage && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-medium flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* UTR Input Form */}
                <form onSubmit={handleSubmitUpiVerification} className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      UPI Transaction Reference / UTR Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 419283749201"
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value.toUpperCase())}
                      className="w-full p-3 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-brand-orange uppercase"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Find the 12-digit UPI Ref / UTR number in your UPI app payment receipt.
                    </span>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    variant="orange"
                    size="lg"
                    isLoading={isSubmitting}
                  >
                    Submit Payment for Verification
                  </Button>
                </form>
              </div>
            )}

            {/* Cash Payment Flow */}
            {selectedMethod === 'CASH' && (
              <div className="mt-6 pt-5 border-t border-slate-100 space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
                  <p className="font-bold">Pay at Cash Register</p>
                  <p className="text-[11px] text-amber-800">
                    Your table bill of <strong>{formatCurrency(order.total_amount)}</strong> will be sent to the front cash counter. You can walk up and pay with physical currency.
                  </p>
                </div>

                <Button
                  className="w-full"
                  variant="secondary"
                  size="lg"
                  isLoading={isSubmitting}
                  onClick={handlePayAtCounter}
                >
                  Confirm Pay at Cash Counter
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
