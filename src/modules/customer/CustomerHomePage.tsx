import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSessionStore } from '../../store/sessionStore';
import { useCartStore } from '../../store/cartStore';
import { useCustomerAuthStore } from '../../store/customerAuthStore';
import { dbAdapter } from '../../services/databaseAdapter';
import { MenuItem, MenuVariant, MenuAddon, Order } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { VegNonVegBadge, OrderStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import {
  Sparkles,
  Flame,
  Clock,
  Plus,
  Minus,
  Check,
  ArrowRight,
  PhoneCall,
  Receipt,
  Award,
  ChevronRight,
  Star,
  MapPin,
  UtensilsCrossed,
  ShieldCheck,
} from 'lucide-react';

export const CustomerHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { table, currentSession, isVerified } = useSessionStore();
  const { addItem, items: cartItems } = useCartStore();
  const { customer, isLoggedIn } = useCustomerAuthStore();

  const restaurant = dbAdapter.getRestaurant();
  const categories = dbAdapter.getCategories();
  const allMenuItems = dbAdapter.getMenuItems();
  const orders = dbAdapter.getOrders();

  // Find active order for this table/session if any
  const activeOrder = currentSession
    ? orders.find(
        (o) =>
          o.table_session_id === currentSession.id &&
          !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(o.status)
      )
    : null;

  // Customization modal state
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<MenuVariant | undefined>(undefined);
  const [selectedAddons, setSelectedAddons] = useState<MenuAddon[]>([]);
  const [customInstructions, setCustomInstructions] = useState('');
  const [customQuantity, setCustomQuantity] = useState(1);

  // Filter food subsets
  const popularDishes = allMenuItems.filter((i) => i.is_popular && i.is_available);
  const featuredDishes = allMenuItems.filter((i) => i.is_recommended && i.is_available);

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

  return (
    <div className="space-y-8">
      {/* ============================================================== */}
      {/* 1. RESTAURANT HERO SECTION                                     */}
      {/* ============================================================== */}
      <section className="relative rounded-3xl overflow-hidden bg-slate-900 text-white shadow-card">
        {/* Hero Background Image */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80"
            alt={restaurant.name}
            className="w-full h-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/70 to-transparent" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 p-6 sm:p-8 lg:p-12 max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-amber-300 text-xs font-bold mb-4 border border-white/10">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Welcome to Resto OS Smart Dining</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-white mb-2">
            {restaurant.name}
          </h1>

          <p className="text-sm sm:text-base text-slate-300 font-medium max-w-2xl mb-6">
            {restaurant.tagline || 'Experience exquisite handcrafted recipes, fresh seasonal produce and instant table service.'}
          </p>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-slate-300">
            <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-xl backdrop-blur-sm">
              <MapPin className="w-4 h-4 text-brand-orange" />
              <span>{restaurant.address}, {restaurant.city}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-xl backdrop-blur-sm">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="font-bold text-white">4.9 / 5</span>
              <span>(1,240+ Reviews)</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 2. TABLE STATUS & ACTIVE ORDER BANNER                          */}
      {/* ============================================================== */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Table & Customer Greeting Card */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-orange-100 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-brand-orange flex items-center justify-center font-extrabold text-lg shadow-inner">
              {table ? table.table_number : 'QR'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <h3 className="font-extrabold text-slate-900 text-base">
                  {isVerified && table ? `Dining at Table ${table.table_number}` : 'Guest Preview Mode'}
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isLoggedIn && customer
                  ? `Welcome, ${customer.full_name}!`
                  : 'Scan or select a dining table to begin.'}
              </p>
            </div>
          </div>

          <Link to="/menu">
            <Button variant="orange" size="sm" className="hidden sm:inline-flex items-center gap-1.5">
              <span>View Menu</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {/* Current Active Order Summary */}
        {activeOrder ? (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-3xl p-5 sm:p-6 shadow-md flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-white animate-spin" />
                <span className="text-xs font-black uppercase tracking-wider">
                  Order in Progress
                </span>
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                  {activeOrder.status}
                </span>
              </div>
              <p className="font-black text-lg text-white">
                {activeOrder.order_number} • {formatCurrency(activeOrder.total_amount)}
              </p>
              <p className="text-xs text-orange-100 mt-0.5">
                {activeOrder.items.length} items being prepared for your table
              </p>
            </div>

            <Link to={`/order/track/${activeOrder.id}`}>
              <button className="px-4 py-2 rounded-xl bg-white text-brand-orange text-xs font-black hover:bg-orange-50 transition-colors shadow-sm">
                Track Live
              </button>
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Bistro Epicure Club</h4>
                <p className="text-xs text-slate-500">Collect 8 stamps to unlock free dessert!</p>
              </div>
            </div>
            <Link to="/my-rewards">
              <Button variant="outline" size="sm">
                View Stamps
              </Button>
            </Link>
          </div>
        )}
      </section>

      {/* ============================================================== */}
      {/* 3. QUICK ACTION SHORTCUTS (CALL WAITER, BILL, REWARDS)         */}
      {/* ============================================================== */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Link
          to="/menu"
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-orange-200 transition-all flex items-center gap-3.5 group"
        >
          <div className="w-11 h-11 rounded-xl bg-orange-100 text-brand-orange flex items-center justify-center group-hover:scale-110 transition-transform">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Browse Menu</h4>
            <p className="text-[10px] sm:text-xs text-slate-500">All delicious items</p>
          </div>
        </Link>

        <Link
          to="/orders"
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-orange-200 transition-all flex items-center gap-3.5 group"
        >
          <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-xs sm:text-sm">My Orders</h4>
            <p className="text-[10px] sm:text-xs text-slate-500">Track & Reorder</p>
          </div>
        </Link>

        <Link
          to="/my-rewards"
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-orange-200 transition-all flex items-center gap-3.5 group"
        >
          <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-xs sm:text-sm">My Rewards</h4>
            <p className="text-[10px] sm:text-xs text-slate-500">Loyalty stamps</p>
          </div>
        </Link>

        <Link
          to="/bag"
          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-orange-200 transition-all flex items-center gap-3.5 group"
        >
          <div className="w-11 h-11 rounded-xl bg-green-100 text-green-700 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Pay Bill</h4>
            <p className="text-[10px] sm:text-xs text-slate-500">UPI QR or Cash</p>
          </div>
        </Link>
      </section>

      {/* ============================================================== */}
      {/* 4. FOOD CATEGORIES GRID / CAROUSEL                             */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              Explore Categories
            </h2>
            <p className="text-xs text-slate-500">Freshly made artisan dishes organized for you</p>
          </div>
          <Link to="/menu" className="text-xs font-bold text-brand-orange hover:underline flex items-center gap-1">
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {categories.map((cat) => {
            const count = allMenuItems.filter((i) => i.category_id === cat.id && i.is_available).length;
            return (
              <Link
                key={cat.id}
                to={`/menu?category=${cat.id}`}
                className="group relative rounded-2xl overflow-hidden bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-orange-200 transition-all p-3 text-center"
              >
                <div className="w-full h-24 sm:h-28 rounded-xl overflow-hidden mb-2.5 relative">
                  <img
                    src={cat.image_url}
                    alt={cat.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  <span className="absolute bottom-1.5 right-1.5 bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                    {count} items
                  </span>
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-1 group-hover:text-brand-orange transition-colors">
                  {cat.name}
                </h3>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ============================================================== */}
      {/* 5. CHEF's RECOMMENDATIONS (FEATURED)                          */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-brand-orange flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                Chef’s Recommendations
              </h2>
              <p className="text-xs text-slate-500">Hand-picked culinary highlights</p>
            </div>
          </div>
          <Link to="/menu" className="text-xs font-bold text-brand-orange hover:underline">
            Full Menu
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featuredDishes.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-card hover:shadow-hover transition-all flex flex-col justify-between"
            >
              <div className="relative h-44 w-full overflow-hidden">
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <VegNonVegBadge isVeg={item.is_veg} />
                  <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                    Chef Special
                  </span>
                </div>
              </div>

              <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 mb-1">
                    {item.name}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                    {item.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-base sm:text-lg font-black text-slate-900">
                    {formatCurrency(item.base_price)}
                  </span>
                  <button
                    onClick={() => handleOpenCustomize(item)}
                    className="px-3.5 py-1.5 rounded-xl bg-orange-50 hover:bg-brand-orange text-brand-orange hover:text-white border border-orange-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add to Bag</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================== */}
      {/* 6. MOST POPULAR DISHES                                         */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                Most Popular Dishes
              </h2>
              <p className="text-xs text-slate-500">Loved and ordered by hundreds of diners</p>
            </div>
          </div>
          <Link to="/menu" className="text-xs font-bold text-brand-orange hover:underline">
            View All
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {popularDishes.slice(0, 4).map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-all p-3 flex flex-col justify-between"
            >
              <div className="relative h-36 w-full rounded-xl overflow-hidden mb-2.5">
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-full h-full object-cover hover:scale-105 transition-transform"
                  loading="lazy"
                />
                <div className="absolute top-2 left-2">
                  <VegNonVegBadge isVeg={item.is_veg} />
                </div>
              </div>

              <div>
                <h4 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-1 mb-1">
                  {item.name}
                </h4>
                <p className="text-[11px] text-slate-500 line-clamp-2 mb-2">
                  {item.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-sm font-black text-slate-900">
                  {formatCurrency(item.base_price)}
                </span>
                <button
                  onClick={() => handleOpenCustomize(item)}
                  className="p-1.5 px-3 rounded-lg bg-brand-orange text-white text-xs font-bold hover:bg-brand-orange-dark transition-all flex items-center gap-1 shadow-sm active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================== */}
      {/* 7. FOOD CUSTOMIZATION & DETAIL MODAL                           */}
      {/* ============================================================== */}
      {customizingItem && (
        <Modal
          isOpen={!!customizingItem}
          onClose={() => setCustomizingItem(null)}
          title={customizingItem.name}
          description="Customize portions, add-ons and special notes"
        >
          <div className="space-y-4">
            {/* Dish Photo */}
            <div className="relative h-44 rounded-2xl overflow-hidden">
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

            {/* Variants Selector */}
            {customizingItem.variants && customizingItem.variants.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-900 block">
                  Select Portion / Size:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {customizingItem.variants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedVariant(variant)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        selectedVariant?.id === variant.id
                          ? 'border-brand-orange bg-orange-50 text-brand-orange font-bold ring-2 ring-brand-orange/20'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span>{variant.name}</span>
                        <span>
                          {variant.price_delta > 0
                            ? `+${formatCurrency(variant.price_delta)}`
                            : 'Standard'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Addons Selector */}
            {customizingItem.addons && customizingItem.addons.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-900 block">
                  Optional Add-ons & Sides:
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
                Special Cooking Instructions (Optional):
              </label>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="e.g., less oil, extra crispy, no onions..."
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
