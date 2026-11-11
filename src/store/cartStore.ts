// ====================================================================
// RESTO OS - Customer Shopping Cart Store
// Calculates exact subtotal, CGST, SGST and item snapshots
// ====================================================================

import { create } from 'zustand';
import { CartItem, MenuAddon, MenuItem, MenuVariant } from '../types';

interface CartState {
  items: CartItem[];
  specialInstructions: string;
  addItem: (item: MenuItem, quantity?: number, variant?: MenuVariant, addons?: MenuAddon[], instructions?: string) => void;
  updateQuantity: (cartItemId: string, delta: number) => void;
  removeItem: (cartItemId: string) => void;
  setSpecialInstructions: (instructions: string) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getCGST: () => number;
  getSGST: () => number;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  specialInstructions: '',

  addItem: (menuItem, quantity = 1, variant, addons = [], instructions = '') => {
    const addonIds = addons.map(a => a.id).sort().join(',');
    const cartItemId = `${menuItem.id}-${variant?.id || 'base'}-${addonIds}`;

    set((state) => {
      const existingIdx = state.items.findIndex(i => i.id === cartItemId);
      const addonsTotal = addons.reduce((sum, a) => sum + a.price, 0);
      const unitPrice = (menuItem.base_price + (variant?.price_delta || 0)) + addonsTotal;

      if (existingIdx > -1) {
        const updated = [...state.items];
        const newQty = updated[existingIdx].quantity + quantity;
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: newQty,
          total_price: unitPrice * newQty,
        };
        return { items: updated };
      } else {
        const newItem: CartItem = {
          id: cartItemId,
          menu_item: menuItem,
          variant,
          selected_addons: addons,
          quantity,
          special_instructions: instructions,
          unit_price: unitPrice,
          total_price: unitPrice * quantity,
        };
        return { items: [...state.items, newItem] };
      }
    });
  },

  updateQuantity: (cartItemId, delta) => {
    set((state) => {
      const updated = state.items
        .map(item => {
          if (item.id === cartItemId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return {
              ...item,
              quantity: newQty,
              total_price: item.unit_price * newQty,
            };
          }
          return item;
        })
        .filter((i): i is CartItem => i !== null);

      return { items: updated };
    });
  },

  removeItem: (cartItemId) => {
    set((state) => ({
      items: state.items.filter(i => i.id !== cartItemId),
    }));
  },

  setSpecialInstructions: (instructions) => set({ specialInstructions: instructions }),

  clearCart: () => set({ items: [], specialInstructions: '' }),

  getSubtotal: () => {
    return get().items.reduce((sum, item) => sum + item.total_price, 0);
  },

  getCGST: () => {
    return get().getSubtotal() * 0.025; // 2.5% CGST
  },

  getSGST: () => {
    return get().getSubtotal() * 0.025; // 2.5% SGST
  },

  getTotal: () => {
    const sub = get().getSubtotal();
    return sub + get().getCGST() + get().getSGST();
  },

  getItemCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },
}));
