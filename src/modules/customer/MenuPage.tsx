import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSessionStore } from '../../store/sessionStore';
import { useCartStore } from '../../store/cartStore';
import { dbAdapter } from '../../services/databaseAdapter';
import { MenuItem, MenuAddon, MenuVariant } from '../../types';
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
} from 'lucide-react';

export const MenuPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const { isVerified, table, currentSession, verifyAndSetToken, isRepeatScanPending, repeatRequestId } = useSessionStore();
  const { items: cartItems, addItem, updateQuantity, removeItem, clearCart, getSubtotal, getCGST, getSGST, getTotal, getItemCount } = useCartStore();

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

  // Cart Drawer modal state
  const isCartOpen = searchParams.get('cart') === 'open';
  const [customerName, setCustomerName] = useState(currentSession?.customer_name || '');
  const [customerPhone, setCustomerPhone] = useState(currentSession?.customer_phone || '');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Listen to QR Token in URL
  useEffect(() => {
    const token = searchParams.get('token');
    if (token && !isVerified) {
      verifyAndSetToken(token);
    }
  }, [searchParams, isVerified, verifyAndSetToken]);

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
  };

  const handleAddCustomizedToCart = () => {
    if (!customizingItem) return;
    addItem(customizingItem, 1, selectedVariant, selectedAddons, customInstructions);
    setCustomizingItem(null);
  };

  const handleToggleAddon = (addon: MenuAddon) => {
    if (selectedAddons.some(a => a.id === addon.id)) {
      setSelectedAddons(selectedAddons.filter(a => a.id !== addon.id));
    } else {
      setSelectedAddons([...selectedAddons, addon]);
    }
  };

  const handlePlaceOrder = async () => {
    if (!currentSession) return;
    if (cartItems.length === 0) return;

    setIsSubmittingOrder(true);
    try {
      const order = dbAdapter.placeOrder({
        tableSessionId: currentSession.id,
        items: cartItems.map(i => ({
          menuItemId: i.menu_item.id,
          variantId: i.variant?.id,
          addonIds: i.selected_addons.map(a => a.id),
          quantity: i.quantity,
          specialInstructions: i.special_instructions,
        })),
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
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

  return (
    <div className="space-y-4">
      {/* Repeat Scan Warning Banner */}
      {isRepeatScanPending && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 shadow-sm animate-pulse-subtle">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs">
            <h4 className="font-bold text-amber-900">Repeat QR Scan Detected</h4>
            <p className="text-amber-700 mt-0.5">
              An active session already exists for Table {table?.table_number}. The Cash Counter is confirming continuation. You can continue placing items or view existing orders.
            </p>
          </div>
        </div>
      )}

      {/* Search Bar & Veg Filter */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search delicious dishes, starters, pizzas..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-orange shadow-sm"
          />
        </div>

        {/* Veg Only Toggle Pill */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVegOnly(!vegOnly)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-2 transition-all ${
                vegOnly
                  ? 'bg-green-50 border-green-600 text-green-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <VegNonVegBadge isVeg={true} />
              <span>Veg Only</span>
            </button>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            {filteredItems.length} dishes available
          </span>
        </div>
      </div>

      {/* Category Pills Horizon Scroll */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
        <button
          onClick={() => setSelectedCategoryId('all')}
          className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all shadow-sm ${
            selectedCategoryId === 'all'
              ? 'bg-brand-orange text-white'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          All Items
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategoryId(cat.id)}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all shadow-sm ${
              selectedCategoryId === cat.id
                ? 'bg-brand-orange text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Menu Item Cards List */}
      <div className="space-y-3.5">
        {filteredItems.map((item) => {
          const inCart = cartItems.find((ci) => ci.menu_item.id === item.id);

          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-100 shadow-card p-3.5 flex gap-3.5 transition-all hover:shadow-card-hover"
            >
              {/* Item Info */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <VegNonVegBadge isVeg={item.is_veg} />
                    {item.is_popular && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" /> Popular
                      </span>
                    )}
                    {item.spicy_level > 0 && (
                      <span className="text-red-500 flex items-center text-[11px]" title={`Spice: ${item.spicy_level}/3`}>
                        <Flame className="w-3 h-3 fill-red-500" />
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">{item.name}</h3>
                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                  <span className="font-extrabold text-slate-900 text-sm">
                    {formatCurrency(item.base_price)}
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {item.prep_time_minutes} min
                  </span>
                </div>
              </div>

              {/* Photo & Add Button Column */}
              <div className="w-28 flex flex-col items-center">
                <div className="w-28 h-24 rounded-xl overflow-hidden bg-slate-100 relative shadow-inner">
                  <img
                    src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300'}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                <div className="mt-2 w-full">
                  {inCart ? (
                    <div className="flex items-center justify-between bg-orange-50 border border-brand-orange text-brand-orange font-bold text-xs rounded-xl px-2 py-1 shadow-sm">
                      <button
                        onClick={() => updateQuantity(inCart.id, -1)}
                        className="p-1 hover:bg-orange-100 rounded"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span>{inCart.quantity}</span>
                      <button
                        onClick={() => updateQuantity(inCart.id, 1)}
                        className="p-1 hover:bg-orange-100 rounded"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleOpenCustomize(item)}
                      className="w-full py-1.5 bg-brand-orange hover:bg-brand-orange-dark text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1 active:scale-95"
                    >
                      <Plus className="w-3 h-3" />
                      <span>ADD</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Food Customization Modal */}
      <Modal
        isOpen={Boolean(customizingItem)}
        onClose={() => setCustomizingItem(null)}
        title={customizingItem?.name}
        description={`Base Price: ${customizingItem ? formatCurrency(customizingItem.base_price) : ''}`}
      >
        {customizingItem && (
          <div className="space-y-4">
            {/* Addons Selection */}
            {customizingItem.addons && customizingItem.addons.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Enhance Your Dish (Add-ons)
                </h4>
                <div className="space-y-2">
                  {customizingItem.addons.map((addon) => {
                    const isSelected = selectedAddons.some(a => a.id === addon.id);
                    return (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => handleToggleAddon(addon)}
                        className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                          isSelected
                            ? 'border-brand-orange bg-orange-50/50 font-bold text-brand-orange'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{addon.name}</span>
                        <span>+{formatCurrency(addon.price)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Special Instructions */}
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                Kitchen Instructions
              </label>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="E.g. Less spicy, dressing on the side, no onions..."
                rows={2}
                className="w-full p-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-brand-orange"
              />
            </div>

            {/* Total Price & Add to Cart button */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Total Item Price</p>
                <p className="text-base font-extrabold text-slate-900">
                  {formatCurrency(
                    customizingItem.base_price +
                    selectedAddons.reduce((sum, a) => sum + a.price, 0)
                  )}
                </p>
              </div>
              <Button variant="orange" onClick={handleAddCustomizedToCart}>
                Add to Order
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cart Drawer Modal */}
      <Modal
        isOpen={isCartOpen}
        onClose={() => setSearchParams({})}
        title="Your Dining Cart"
        description={table ? `Table ${table.table_number}` : undefined}
      >
        {cartItems.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-700 text-sm">Your cart is empty</p>
            <p className="text-xs text-slate-400 mt-1">Select items from our craft menu to begin.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Items list */}
            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {cartItems.map((item) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <h5 className="font-bold text-slate-800">{item.menu_item.name}</h5>
                    {item.selected_addons.length > 0 && (
                      <p className="text-[11px] text-slate-500">
                        + {item.selected_addons.map(a => a.name).join(', ')}
                      </p>
                    )}
                    <p className="text-slate-700 font-semibold mt-0.5">{formatCurrency(item.unit_price)} each</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-slate-100 rounded-lg p-1">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="p-1 hover:bg-slate-200 rounded text-slate-600"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 font-bold">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="p-1 hover:bg-slate-200 rounded text-slate-600"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="font-extrabold w-16 text-right">
                      {formatCurrency(item.total_price)}
                    </span>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-slate-400 hover:text-red-500 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Optional Customer info for digital loyalty stamps */}
            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <Sparkles className="w-3.5 h-3.5 text-brand-orange" />
                <span>Earn Digital Loyalty Stamps</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Your Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="p-2 bg-white rounded-lg border border-amber-200 text-xs focus:outline-none focus:border-brand-orange"
                />
                <input
                  type="tel"
                  placeholder="Mobile (For Stamps)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="p-2 bg-white rounded-lg border border-amber-200 text-xs focus:outline-none focus:border-brand-orange"
                />
              </div>
            </div>

            {/* Taxes & Bill Calculation */}
            <div className="border-t border-slate-100 pt-3 space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(getSubtotal())}</span>
              </div>
              <div className="flex justify-between">
                <span>CGST (2.5%):</span>
                <span>{formatCurrency(getCGST())}</span>
              </div>
              <div className="flex justify-between">
                <span>SGST (2.5%):</span>
                <span>{formatCurrency(getSGST())}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-slate-900 border-t border-slate-200 pt-2">
                <span>Grand Total:</span>
                <span className="text-brand-orange">{formatCurrency(getTotal())}</span>
              </div>
            </div>

            <Button
              className="w-full mt-2"
              variant="orange"
              size="lg"
              isLoading={isSubmittingOrder}
              onClick={handlePlaceOrder}
            >
              Place Kitchen Order
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};
