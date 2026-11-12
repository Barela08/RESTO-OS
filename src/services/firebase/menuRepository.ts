// ====================================================================
// RESTO OS - Firestore Menu & Catalog Repository
// Handles categories, menu items, variants, add-ons & availability
// ====================================================================

import { db } from '../../lib/firebase';
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import {
  FirestoreMenuCategory,
  FirestoreMenuItem,
  FirestoreMenuAddon,
} from '../../types/firestore';

export class MenuRepository {
  /**
   * Fetch active categories ordered by displayOrder
   */
  public static async getCategories(restaurantId: string): Promise<FirestoreMenuCategory[]> {
    if (!db) return [];
    const q = query(
      collection(db, 'menuCategories'),
      where('restaurantId', '==', restaurantId),
      orderBy('displayOrder', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), categoryId: d.id } as FirestoreMenuCategory));
  }

  /**
   * Fetch all menu items for a restaurant, optionally filtered by category
   */
  public static async getMenuItems(
    restaurantId: string,
    categoryId?: string
  ): Promise<FirestoreMenuItem[]> {
    if (!db) return [];
    let q = query(
      collection(db, 'menuItems'),
      where('restaurantId', '==', restaurantId)
    );
    if (categoryId) {
      q = query(q, where('categoryId', '==', categoryId));
    }
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), itemId: d.id } as FirestoreMenuItem));
  }

  /**
   * Fetch all add-ons for the restaurant
   */
  public static async getMenuAddons(restaurantId: string): Promise<FirestoreMenuAddon[]> {
    if (!db) return [];
    const q = query(
      collection(db, 'menuAddons'),
      where('restaurantId', '==', restaurantId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), addonId: d.id } as FirestoreMenuAddon));
  }

  /**
   * Real-time subscription to full restaurant menu
   */
  public static subscribeToMenu(
    restaurantId: string,
    callback: (data: {
      categories: FirestoreMenuCategory[];
      items: FirestoreMenuItem[];
      addons: FirestoreMenuAddon[];
    }) => void
  ): () => void {
    if (!db) return () => {};

    const catQuery = query(
      collection(db, 'menuCategories'),
      where('restaurantId', '==', restaurantId)
    );
    const itemQuery = query(
      collection(db, 'menuItems'),
      where('restaurantId', '==', restaurantId)
    );
    const addonQuery = query(
      collection(db, 'menuAddons'),
      where('restaurantId', '==', restaurantId)
    );

    let categories: FirestoreMenuCategory[] = [];
    let items: FirestoreMenuItem[] = [];
    let addons: FirestoreMenuAddon[] = [];

    const unsubCats = onSnapshot(catQuery, (snap) => {
      categories = snap.docs.map(
        (d) => ({ ...d.data(), categoryId: d.id } as FirestoreMenuCategory)
      );
      callback({ categories, items, addons });
    });

    const unsubItems = onSnapshot(itemQuery, (snap) => {
      items = snap.docs.map((d) => ({ ...d.data(), itemId: d.id } as FirestoreMenuItem));
      callback({ categories, items, addons });
    });

    const unsubAddons = onSnapshot(addonQuery, (snap) => {
      addons = snap.docs.map((d) => ({ ...d.data(), addonId: d.id } as FirestoreMenuAddon));
      callback({ categories, items, addons });
    });

    return () => {
      unsubCats();
      unsubItems();
      unsubAddons();
    };
  }

  /**
   * Toggle item 86 / availability state
   */
  public static async updateItemAvailability(
    restaurantId: string,
    itemId: string,
    isAvailable: boolean
  ): Promise<void> {
    if (!db) return;
    const itemRef = doc(db, 'menuItems', itemId);
    await updateDoc(itemRef, {
      isAvailable,
      updatedAt: serverTimestamp(),
    });
  }
}
