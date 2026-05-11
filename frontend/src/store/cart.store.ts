import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import type { CartItem } from '@/types';

// =============================================================================
// Cart Store — Zustand with sessionStorage persistence
//
// SECURITY NOTE: Access tokens are NEVER stored here.
// Cart is persisted only to sessionStorage (cleared when tab closes).
// Prices are stored for display only — the backend re-validates prices
// at checkout time.
// =============================================================================

type CartStore = {
  // State
  items: CartItem[];

  // Computed (derived)
  totalItems: number;
  subtotalKopecks: number;

  // Actions
  addItem: (item: CartItem) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clearCart: () => void;
};

function computeTotals(items: CartItem[]): {
  totalItems: number;
  subtotalKopecks: number;
} {
  return items.reduce(
    (acc, item) => ({
      totalItems: acc.totalItems + item.quantity,
      subtotalKopecks: acc.subtotalKopecks + item.priceKopecks * item.quantity,
    }),
    { totalItems: 0, subtotalKopecks: 0 },
  );
}

export const useCartStore = create<CartStore>()(
  devtools(
    persist(
      (set, get) => ({
        items: [],
        totalItems: 0,
        subtotalKopecks: 0,

        addItem: (newItem: CartItem) => {
          const currentItems = get().items;
          const existingIndex = currentItems.findIndex(
            (i) => i.variantId === newItem.variantId,
          );

          let updatedItems: CartItem[];

          if (existingIndex >= 0) {
            // Increment quantity if item already in cart
            updatedItems = currentItems.map((item, idx) =>
              idx === existingIndex
                ? { ...item, quantity: item.quantity + newItem.quantity }
                : item,
            );
          } else {
            updatedItems = [...currentItems, newItem];
          }

          const totals = computeTotals(updatedItems);
          set({ items: updatedItems, ...totals }, false, 'addItem');
        },

        updateQuantity: (variantId: string, quantity: number) => {
          if (quantity < 1) {
            get().removeItem(variantId);
            return;
          }

          const updatedItems = get().items.map((item) =>
            item.variantId === variantId ? { ...item, quantity } : item,
          );

          const totals = computeTotals(updatedItems);
          set({ items: updatedItems, ...totals }, false, 'updateQuantity');
        },

        removeItem: (variantId: string) => {
          const updatedItems = get().items.filter(
            (item) => item.variantId !== variantId,
          );
          const totals = computeTotals(updatedItems);
          set({ items: updatedItems, ...totals }, false, 'removeItem');
        },

        clearCart: () => {
          set(
            { items: [], totalItems: 0, subtotalKopecks: 0 },
            false,
            'clearCart',
          );
        },
      }),
      {
        name: 'mylo-cart',
        // sessionStorage only — cart is wiped when browser tab/window closes
        storage: createJSONStorage(() => sessionStorage),
        // Persist only items — recompute totals on hydration
        partialize: (state) => ({ items: state.items }),
        // Rehydrate: recompute totals after loading from sessionStorage
        onRehydrateStorage: () => (state) => {
          if (state) {
            const totals = computeTotals(state.items);
            state.totalItems = totals.totalItems;
            state.subtotalKopecks = totals.subtotalKopecks;
          }
        },
        version: 1,
      },
    ),
    { name: 'CartStore', enabled: import.meta.env.DEV },
  ),
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectCartItems = (s: CartStore) => s.items;
export const selectCartTotalItems = (s: CartStore) => s.totalItems;
export const selectCartSubtotal = (s: CartStore) => s.subtotalKopecks;
export const selectIsInCart = (variantId: string) => (s: CartStore) =>
  s.items.some((i) => i.variantId === variantId);
export const selectCartItemQuantity = (variantId: string) => (s: CartStore) =>
  s.items.find((i) => i.variantId === variantId)?.quantity ?? 0;
