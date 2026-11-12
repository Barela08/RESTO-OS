import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSessionStore } from '../../store/sessionStore';
import { useCartStore } from '../../store/cartStore';
import { useCustomerAuthStore } from '../../store/customerAuthStore';
import { dbAdapter } from '../../services/databaseAdapter';
import { formatCurrency } from '../../utils/currency';
import { Button } from '../../components/ui/Button';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  Sparkles,
  Receipt,
  UtensilsCrossed,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Tag,
  AlertCircle,
} from 'lucide-react';

export const CustomerBagPage: React.FC = () => {
  const navigate = useNavigate();
  const { table, currentSession, isVerified } = useSessionStore();
  const {
    items: cartItems,
    updateQuantity,
    removeItem,
    clearCart,
    getSubtotal,
    getCGST,
    getSGST,
    getTotal,
    getItemCount,
    specialInstructions,
    setSpecialInstructions,
  } = useCartStore();
  const { customer, isLoggedIn, lookupAndRecognize } = useCustomerAuthStore();

  const restaurant = dbAdapter.getRestaurant();
  const settings = dbAdapter.getSettings();

  const [customerName, setCustomerName] = useState(customer?.full_name || currentSession?.customer_name || '');
  const [customerPhone, setCustomerPhone] = useState(customer?.phone || currentSession?.customer_phone || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [recognitionNote, setRecognitionNote] = useState<string | null>(null);

  const handlePhoneChange = (val: string) => {
    setCustomerPhone(val);
    const clean = val.replace(/\D/g, '');
    if (clean.length === 10) {
      const res = lookupAndRecognize(val);
      if (res.isExisting && res.customer) {
        setCustomerName(res.customer.full_name);
        setRecognitionNote(`Auto-recognized: ${res.customer.full_name}`);
      } else {
        setRecognitionNote('New guest phone number');
      }
    } else {
      setRecognitionNote(null);
    }
  };

  const subtotal = getSubtotal();
  const cgst = getCGST();
  const sgst = getSGST();
  const rawTotal = getTotal();
  const finalTotal = Math.max(0, rawTotal - appliedDiscount);
  const itemCount = getItemCount();

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponCode.trim().toUpperCase();
    if (code === 'WELCOME50') {
      const discount = Math.min(50, Math.round(subtotal * 0.1));
      setAppliedDiscount(discount);
      setCouponMessage(`Promo code applied! You saved ${formatCurrency(discount)}`);
    } else if (code === 'BISTRO100') {
      if (subtotal >= 600) {
        setAppliedDiscount(100);
        setCouponMessage(`VIP promo applied! ₹100 discount added.`);
      } else {
        setCouponMessage(`Minimum order amount of ₹600 required for BISTRO100.`);
      }
    } else {
      setCouponMessage('Invalid or expired coupon code.');
    }
  };

  const handlePlaceOrder = async () => {
    if (!currentSession) {
      alert('Please connect to a dining table first.');
      return;
    }
    if (cartItems.length === 0) return;

    setIsSubmitting(true);
    try {
      const idempotencyKey = `idem-${currentSession.id}-${Date.now()}`;
      const order = await dbAdapter.placeOrderAsync({
        tableSessionId: currentSession.id,
        items: cartItems.map((i) => ({
          menuItemId: i.menu_item.id,
          variantId: i.variant?.id,
          addonIds: i.selected_addons.map((a) => a.id),
          quantity: i.quantity,
          specialInstructions: i.special_instructions,
        })),
        customerName: customerName.trim() || customer?.full_name || undefined,
        customerPhone: customerPhone.trim() || customer?.phone || undefined,
        specialNotes: specialInstructions.trim() || undefined,
        idempotencyKey,
      });

      clearCart();
      navigate(`/order/track/${order.id}`);
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to place order');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center bg-white rounded-3xl p-8 border border-slate-100 shadow-card">
        <div className="w-20 h-20 rounded-3xl bg-orange-50 text-brand-orange flex items-center justify-center mx-auto mb-4 shadow-inner">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-2">
          Your Dining Bag is Empty
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mb-6">
          Looks like you haven't added any dishes yet. Browse our chef-curated menu to start your feast!
        </p>
        <Link to="/menu">
          <Button variant="orange" size="md" className="inline-flex items-center gap-2">
            <UtensilsCrossed className="w-4 h-4" />
            <span>Explore Menu & Add Food</span>
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Bag Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Review Your Dining Bag
          </h1>
          <p className="text-xs text-slate-500">
            {itemCount} {itemCount === 1 ? 'item' : 'items'} selected for Table {table?.table_number || 'Session'}
          </p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1.5 p-2 rounded-xl hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear All</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Cart Items List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-6 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-brand-orange" />
              <span>Selected Dishes</span>
            </h3>

            <div className="space-y-3.5">
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={item.menu_item.image_url}
                      alt={item.menu_item.name}
                      className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                    />
                    <div>
                      <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">
                        {item.menu_item.name}
                      </h4>
                      {item.variant && (
                        <p className="text-[11px] font-semibold text-amber-800">
                          Portion: {item.variant.name}
                        </p>
                      )}
                      {item.selected_addons.length > 0 && (
                        <p className="text-[11px] text-slate-500">
                          Addons: {item.selected_addons.map((a) => a.name).join(', ')}
                        </p>
                      )}
                      {item.special_instructions && (
                        <p className="text-[10px] text-slate-400 italic mt-0.5">
                          "{item.special_instructions}"
                        </p>
                      )}
                      <p className="text-xs font-black text-slate-900 mt-1">
                        {formatCurrency(item.unit_price)} each
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                    <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl border border-slate-200 shadow-2xs">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-extrabold text-xs text-slate-900 w-5 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-7 h-7 rounded-lg bg-brand-orange text-white hover:bg-brand-orange-dark flex items-center justify-center transition-colors shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <span className="font-black text-sm text-slate-900 sm:w-20 text-right">
                      {formatCurrency(item.total_price)}
                    </span>

                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Remove Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Special Instructions Textarea */}
            <div className="pt-3 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-800 block mb-1.5">
                Special Dining Instructions for Kitchen:
              </label>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="e.g. Serve drinks first, less spice in curry, deliver extra cutlery..."
                rows={2}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-none focus:border-brand-orange resize-none"
              />
            </div>
          </div>

          {/* Table & Customer Contact Card */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-6 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-600" />
              <span>Dining Table & Customer Verification</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Mobile Phone (for digital invoice & stamps):</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="e.g. 98888 77665"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-brand-orange"
                />
                {recognitionNote && (
                  <p className="text-[11px] font-bold text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{recognitionNote}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Your Full Name:</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Rohit Sharma"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-brand-orange"
                />
              </div>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center gap-2.5 text-xs text-amber-900">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>
                Orders are linked to <strong>Table {table?.table_number || 'Session'}</strong> ({table?.floor_area || 'Main Dining'}).
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary & Placement */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-card p-5 sm:p-6 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-brand-orange" />
              <span>Bill Summary</span>
            </h3>

            {/* Promo Code Input */}
            <form onSubmit={handleApplyCoupon} className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Promo Code (e.g. WELCOME50)"
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 uppercase focus:outline-none focus:border-brand-orange"
                />
                <Button type="submit" variant="outline" size="sm">
                  Apply
                </Button>
              </div>
              {couponMessage && (
                <p className={`text-[10px] font-semibold ${appliedDiscount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {couponMessage}
                </p>
              )}
            </form>

            {/* Financial Breakdown */}
            <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal</span>
                <span className="font-bold text-slate-900">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>CGST (2.5%)</span>
                <span>{formatCurrency(cgst)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>SGST (2.5%)</span>
                <span>{formatCurrency(sgst)}</span>
              </div>

              {appliedDiscount > 0 && (
                <div className="flex justify-between text-green-600 font-bold">
                  <span>Special Offer Discount</span>
                  <span>-{formatCurrency(appliedDiscount)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-900 font-black text-base pt-3 border-t border-slate-200">
                <span>Total Amount</span>
                <span className="text-brand-orange">{formatCurrency(finalTotal)}</span>
              </div>
            </div>

            {/* Place Order CTA */}
            <Button
              variant="orange"
              className="w-full py-3.5 font-black text-sm shadow-md"
              onClick={handlePlaceOrder}
              disabled={isSubmitting || cartItems.length === 0}
            >
              {isSubmitting ? 'Submitting to Kitchen...' : `Place Dining Order • ${formatCurrency(finalTotal)}`}
            </Button>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 space-y-1">
              <p className="flex items-center gap-1.5 font-bold text-slate-700">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Earn 1 Loyalty Stamp on this order</span>
              </p>
              <p>Stamps unlock complimentary chef starters & artisan desserts!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
