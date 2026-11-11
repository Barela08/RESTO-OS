import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSessionStore } from '../../store/sessionStore';
import { useCartStore } from '../../store/cartStore';
import { useCustomerAuthStore } from '../../store/customerAuthStore';
import { dbAdapter } from '../../services/databaseAdapter';
import { MenuItem, MenuAddon, MenuVariant, WaiterCall } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { VegNonVegBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import {
  Search,
  Plus,
  Minus,
  Sparkles,
  Flame,
  Clock,
  ShoppingBag,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Check,
  Receipt,
  UtensilsCrossed,
  PhoneCall,
} from 'lucide-react';

export const MenuPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const { isVerified, table, currentSession, verifyAndSetToken, isRepeatScanPending } = useSessionStore();
  const {
    items: cartItems,
    addItem,
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
  const { customer, isLoggedIn } = useCustomerAuthStore();

  const categories = dbAdapter.getCategories();
  const allMenuItems = dbAdapter.getMenuItems();
  const restaurant = dbAdapter.getRestaurant();

  // Search & Filter state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);

  // Customization modal state
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<MenuVariant | undefined>(undefined);
  const [selectedAddons, setSelectedAddons] = useState<MenuAddon[]>([]);
  const [customInstructions, setCustomInstructions] = useState('');
  const [customQuantity, setCustomQuantity] = useState(1);

  // Cart Drawer modal state (for mobile)
  const isCartOpen = searchParams.get('cart') === 'open';
  const [customerName, setCustomerName] = useState(customer?.full_name || currentSession?.customer_name || '');
  const [customerPhone, setCustomerPhone] = useState(customer?.phone || currentSession?.customer_phone || '');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Active waiter call state for current dining session
  const [activeWaiterCall, setActiveWaiterCall] = useState<WaiterCall | undefined>(() =>
    currentSession ? dbAdapter.getActiveWaiterCallForSession(currentSession.id) : undefined
  );

  useEffect(() => {
    const update = () => {
      if (currentSession) {
        setActiveWaiterCall(dbAdapter.getActiveWaiterCallForSession(currentSession.id));
      } else {
        setActiveWaiterCall(undefined);
      }
    };
    update();
    return dbAdapter.subscribe(update);
  }, [currentSession]);

  const handleCallWaiter = () => {
    if (!currentSession) {
      alert('Please select or scan a dining table first.');
      return;
    }
    dbAdapter.requestService({
      tableSessionId: currentSession.id,
      requestType: 'CALL_WAITER',
    });
  };

  // Listen to QR Token in URL
  useEffect(() => {
    const token = searchParams.get('token');
    if (token && !isVerified) {
      verifyAndSetToken(token);
    }
  }, [searchParams, isVerified, verifyAndSetToken]);

  // Sync category param from URL
  useEffect(() => {
    const catParam = searchParams.get('category');
    if (catParam) {
      setSelectedCategoryId(catParam);
    }
  }, [searchParams]);

  // Filter items
  const filteredItems = allMenuItems.filter((item) => {
    if (!item.is_available) return false;
    if (selectedCategoryId !== 'all' && item.category_id !== selectedCategoryId) return false;
    if (vegOnly && !item.is_veg) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q);
    }
    return true;
  });

  const handleOpenCustomize = (item: MenuItem) => {
    setCustomizingItem(item);
    setSelectedVariant(item.variants?.[0]);
    setSelectedAddons([]);
    setCustomInstructions('');
    setCustomQuantity(1);
  };

  const handleAddCustomizedToCart = () => {
    if (!customizingItem) return;
    addItem(customizingItem, customQuantity, selectedVariant, selectedAddons, customInstructions);
    setCustomizingItem(null);
  };

  const handleToggleAddon = (addon: MenuAddon) => {
    if (selectedAddons.some((a) => a.id === addon.id)) {
      setSelectedAddons(selectedAddons.filter((a) => a.id !== addon.id));
    } else {
      setSelectedAddons([...selectedAddons, addon]);
    }
  };

  const calculateCustomTotal = () => {
    if (!customizingItem) return 0;
    const base = customizingItem.base_price + (selectedVariant?.price_delta || 0);
    const addonsTotal = selectedAddons.reduce((sum, a) => sum + a.price, 0);
    return (base + addonsTotal) * customQuantity;
  };

  const handlePlaceOrder = async () => {
    if (!currentSession) {
      alert('Please select or scan a dining table first.');
      return;
    }
    if (cartItems.length === 0) return;

    setIsSubmittingOrder(true);
    try {
      const idempotencyKey = `idem-${currentSession.id}-${Date.now()}`;
      const order = dbAdapter.placeOrder({
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
      setSearchParams({});
      navigate(`/order/track/${order.id}`);
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to place order');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const subtotal = getSubtotal();
  const cgst = getCGST();
  const sgst = getSGST();
  const total = getTotal();
  const itemCount = getItemCount();

  return (
    <div className="space-y-6">
      {/* Table Service & Call Waiter Status Bar */}
      {table && (
        <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 border border-orange-200/80 rounded-2xl p-3.5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center font-extrabold text-sm shadow-md flex-shrink-0">
              {table.table_number}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-slate-900 text-sm">Table {table.table_number}</h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-brand-orange border border-orange-200">
                  Active Dining Session
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeWaiterCall
                  ? activeWaiterCall.status === 'PENDING'
                    ? 'Floor staff notified • Waiter alerted'
                    : activeWaiterCall.status === 'ACKNOWLEDGED'
                    ? 'Request accepted • Waiter attending soon'
                    : 'Waiter is on the way to your table!'
                  : 'Need napkins, water, or order help?'}
              </p>
            </div>
          </div>

          <div className="w-full sm:w-auto flex items-center gap-2">
            {activeWaiterCall ? (
              <div className={`w-full sm:w-auto flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold border ${
                activeWaiterCall.status === 'IN_PROGRESS'
                  ? 'bg-green-600 text-white border-green-700 animate-pulse'
                  : activeWaiterCall.status === 'ACKNOWLEDGED'
                  ? 'bg-blue-600 text-white border-blue-700'
                  : 'bg-amber-500 text-white border-amber-600 animate-pulse'
              }`}>
                <PhoneCall className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  {activeWaiterCall.status === 'IN_PROGRESS'
                    ? 'Waiter On The Way'
                    : activeWaiterCall.status === 'ACKNOWLEDGED'
                    ? 'Call Accepted'
                    : 'Waiter Called'}
                </span>
              </div>
            ) : (
              <button
                onClick={handleCallWaiter}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-brand-orange hover:bg-orange-600 active:scale-95 text-white text-xs font-extrabold shadow-sm transition-all"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Call Waiter</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search & Veg Filter Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pizza, pasta, biryani, dessert, cold drinks..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-orange transition-colors"
          />
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setVegOnly(!vegOnly)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-2 transition-all ${
              vegOnly
                ? 'bg-green-50 border-green-600 text-green-700 ring-2 ring-green-600/20'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <VegNonVegBadge isVeg={true} />
            <span>Pure Veg Only</span>
          </button>

          <span className="text-xs text-slate-500 font-medium">
            {filteredItems.length} dishes available
          </span>
        </div>
      </div>

      {/* Category Pills Horizontal Scroll */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
        <button
          onClick={() => setSelectedCategoryId('all')}
          className={`px-4 py-2.5 rounded-2xl font-bold whitespace-nowrap transition-all shadow-sm ${
            selectedCategoryId === 'all'
              ? 'bg-brand-orange text-white ring-2 ring-brand-orange/30'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          All Dishes
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategoryId(cat.id)}
            className={`px-4 py-2.5 rounded-2xl font-bold whitespace-nowrap transition-all shadow-sm ${
              selectedCategoryId === cat.id
                ? 'bg-brand-orange text-white ring-2 ring-brand-orange/30'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* ============================================================== */}
      {/* MAIN LAYOUT: MENU GRID (LEFT) + DESKTOP STICKY CART (RIGHT)    */}
      {/* ============================================================== */}
      <div className="flex items-start gap-8">
        {/* Left Food Grid */}
        <div className="flex-1 min-w-0">
          {filteredItems.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-100">
              <UtensilsCrossed className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-900 text-base">No Dishes Found</h3>
              <p className="text-xs text-slate-500 mt-1">
                Try clearing your search query or selecting a different category.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSelectedCategoryId('all');
                  setSearchQuery('');
                  setVegOnly(false);
                }}
              >
                Reset Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredItems.map((item) => {
                const inCart = cartItems.find((ci) => ci.menu_item.id === item.id);

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-3xl border border-slate-100 shadow-card hover:shadow-card-hover transition-all overflow-hidden flex flex-col justify-between group"
                  >
                    {/* Food Photo Header */}
                    <div
                      className="relative h-44 w-full overflow-hidden cursor-pointer bg-slate-100"
                      onClick={() => handleOpenCustomize(item)}
                    >
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <VegNonVegBadge isVeg={item.is_veg} />
                        {item.is_popular && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-0.5 shadow-sm">
                            <Sparkles className="w-2.5 h-2.5" /> Popular
                          </span>
                        )}
                      </div>
                      <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded-lg text-[10px] font-semibold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>{item.prep_time_minutes} min</span>
                      </div>
                    </div>

                    {/* Food Details Body */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div className="cursor-pointer" onClick={() => handleOpenCustomize(item)}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-brand-orange transition-colors">
                            {item.name}
                          </h3>
                          {item.spicy_level > 0 && (
                            <span className="text-red-500 flex items-center" title={`Spice Level: ${item.spicy_level}`}>
                              <Flame className="w-3.5 h-3.5 fill-red-500" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
                          {item.description}
                        </p>
                      </div>

                      {/* Price & Add to Bag Footer */}
                      <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                        <div>
                          <span className="text-base font-black text-slate-900">
                            {formatCurrency(item.base_price)}
                          </span>
                          {item.variants && item.variants.length > 0 && (
                            <p className="text-[10px] text-slate-400">Customizable</p>
                          )}
                        </div>

                        {inCart ? (
                          <div className="flex items-center gap-2 bg-orange-50 border border-brand-orange/30 p-1 rounded-xl">
                            <button
                              onClick={() => updateQuantity(inCart.id, -1)}
                              className="w-7 h-7 rounded-lg bg-white text-brand-orange flex items-center justify-center font-bold hover:bg-orange-100 shadow-xs"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-black text-xs text-brand-orange w-4 text-center">
                              {inCart.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(inCart.id, 1)}
                              className="w-7 h-7 rounded-lg bg-brand-orange text-white flex items-center justify-center font-bold hover:bg-brand-orange-dark shadow-xs"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenCustomize(item)}
                            className="px-4 py-2 rounded-xl bg-orange-50 hover:bg-brand-orange text-brand-orange hover:text-white border border-orange-200 text-xs font-black transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* DESKTOP STICKY SIDE CART PANEL (lg:block)                      */}
        {/* ============================================================== */}
        <aside className="hidden lg:block w-96 flex-shrink-0 sticky top-24 self-start">
          <div className="bg-white rounded-3xl border border-orange-100 shadow-card p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 text-brand-orange flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base leading-tight">My Dining Bag</h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {table ? `Table ${table.table_number}` : 'Select table to order'}
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-orange-50 text-brand-orange font-black text-xs">
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </span>
            </div>

            {cartItems.length === 0 ? (
              <div className="py-8 text-center">
                <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-2.5" />
                <p className="font-bold text-slate-700 text-sm">Your Bag is Empty</p>
                <p className="text-xs text-slate-400 mt-1 max-w-[200px] mx-auto">
                  Click 'Add' on any dish to begin building your meal.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Cart Items List */}
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {cartItems.map((item) => (
                    <div key={item.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div>
                          <p className="font-bold text-slate-900">{item.menu_item.name}</p>
                          {item.variant && (
                            <p className="text-[10px] text-amber-800 font-semibold">
                              Portion: {item.variant.name}
                            </p>
                          )}
                          {item.selected_addons.length > 0 && (
                            <p className="text-[10px] text-slate-500">
                              Addons: {item.selected_addons.map((a) => a.name).join(', ')}
                            </p>
                          )}
                        </div>
                        <span className="font-extrabold text-slate-900">
                          {formatCurrency(item.total_price)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-200/60">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-bold text-slate-900 w-4 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-red-500 hover:text-red-700 text-[11px] font-semibold flex items-center gap-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Special Instructions Input */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Special Table Instructions:
                  </label>
                  <input
                    type="text"
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    placeholder="e.g. Serve drinks first, less salt..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-brand-orange"
                  />
                </div>

                {/* Bill Breakdown */}
                <div className="space-y-1.5 pt-3 border-t border-slate-100 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Items Subtotal</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>CGST ({restaurant.name ? '2.5%' : '2.5%'})</span>
                    <span>{formatCurrency(cgst)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>SGST (2.5%)</span>
                    <span>{formatCurrency(sgst)}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-extrabold text-sm pt-2 border-t border-slate-200">
                    <span>Final Total</span>
                    <span className="text-brand-orange">{formatCurrency(total)}</span>
                  </div>
                </div>

                {/* Place Order Button */}
                <Button
                  variant="orange"
                  className="w-full mt-2 py-3 font-extrabold text-sm shadow-md"
                  onClick={handlePlaceOrder}
                  disabled={isSubmittingOrder || cartItems.length === 0}
                >
                  {isSubmittingOrder ? 'Placing Order...' : `Confirm & Place Order • ${formatCurrency(total)}`}
                </Button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ============================================================== */}
      {/* MOBILE CART DRAWER MODAL                                       */}
      {/* ============================================================== */}
      <Modal
        isOpen={isCartOpen}
        onClose={() => setSearchParams({})}
        title="Your Dining Bag"
        description={table ? `Ordering for Table ${table.table_number}` : 'Dining Order'}
      >
        {cartItems.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="font-bold text-slate-900 text-sm">Your Bag is Empty</h4>
            <p className="text-xs text-slate-500 mt-1">Add items from the menu to place your dining order.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {cartItems.map((item) => (
                <div key={item.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <p className="font-bold text-slate-900">{item.menu_item.name}</p>
                      {item.variant && (
                        <p className="text-[10px] text-amber-800 font-semibold">{item.variant.name}</p>
                      )}
                      {item.selected_addons.length > 0 && (
                        <p className="text-[10px] text-slate-500">
                          Addons: {item.selected_addons.map((a) => a.name).join(', ')}
                        </p>
                      )}
                    </div>
                    <span className="font-extrabold text-slate-900">{formatCurrency(item.total_price)}</span>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-600"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-bold text-slate-900 w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-600"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-red-500 text-[11px] font-semibold flex items-center gap-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Taxes (CGST 2.5% + SGST 2.5%)</span>
                <span>{formatCurrency(cgst + sgst)}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-extrabold text-sm pt-2 border-t border-slate-200">
                <span>Final Total</span>
                <span className="text-brand-orange">{formatCurrency(total)}</span>
              </div>
            </div>

            <Button
              variant="orange"
              className="w-full py-3 font-extrabold text-sm"
              onClick={handlePlaceOrder}
              disabled={isSubmittingOrder}
            >
              {isSubmittingOrder ? 'Placing Order...' : `Place Order • ${formatCurrency(total)}`}
            </Button>
          </div>
        )}
      </Modal>

      {/* ============================================================== */}
      {/* FOOD CUSTOMIZATION & DETAIL MODAL                           */}
      {/* ============================================================== */}
      {customizingItem && (
        <Modal
          isOpen={!!customizingItem}
          onClose={() => setCustomizingItem(null)}
          title={customizingItem.name}
          description="Portions, add-ons and special cooking instructions"
        >
          <div className="space-y-4">
            <div className="relative h-44 rounded-2xl overflow-hidden bg-slate-100">
              <img
                src={customizingItem.image_url}
                alt={customizingItem.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3">
                <VegNonVegBadge isVeg={customizingItem.is_veg} />
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {customizingItem.description}
            </p>

            {/* Variants */}
            {customizingItem.variants && customizingItem.variants.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-900 block">
                  Select Size / Portion:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {customizingItem.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        selectedVariant?.id === v.id
                          ? 'border-brand-orange bg-orange-50 text-brand-orange font-bold ring-2 ring-brand-orange/20'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span>{v.name}</span>
                        <span>{v.price_delta > 0 ? `+${formatCurrency(v.price_delta)}` : 'Standard'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Addons */}
            {customizingItem.addons && customizingItem.addons.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-900 block">
                  Optional Add-ons:
                </label>
                <div className="space-y-1.5">
                  {customizingItem.addons.map((addon) => {
                    const isSelected = selectedAddons.some((a) => a.id === addon.id);
                    return (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => handleToggleAddon(addon)}
                        className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                          isSelected
                            ? 'border-brand-orange bg-orange-50 text-brand-orange ring-1 ring-brand-orange/20'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                              isSelected
                                ? 'bg-brand-orange border-brand-orange text-white'
                                : 'border-slate-300'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="text-xs font-medium">{addon.name}</span>
                        </div>
                        <span className="text-xs font-bold">+{formatCurrency(addon.price)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Special Instructions */}
            <div>
              <label className="text-xs font-bold text-slate-900 block mb-1">
                Special Instructions:
              </label>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="e.g. less spicy, sauce on the side, extra crispy..."
                rows={2}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-brand-orange resize-none"
              />
            </div>

            {/* Quantity Controls & Add Button */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setCustomQuantity(Math.max(1, customQuantity - 1))}
                  className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-700 hover:bg-slate-200 shadow-sm transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="font-extrabold text-sm text-slate-900 w-4 text-center">
                  {customQuantity}
                </span>
                <button
                  type="button"
                  onClick={() => setCustomQuantity(customQuantity + 1)}
                  className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-700 hover:bg-slate-200 shadow-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <Button
                variant="orange"
                className="flex-1 flex items-center justify-between"
                onClick={handleAddCustomizedToCart}
              >
                <span>Add to Bag</span>
                <span className="font-extrabold">{formatCurrency(calculateCustomTotal())}</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
