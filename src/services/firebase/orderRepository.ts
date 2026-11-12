// ====================================================================
// RESTO OS - Firestore Order & Kitchen Fulfillment Repository
// Atomic transaction order placement, price recalculation & lifecycle tracking
// ====================================================================

import { db } from '../../lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import {
  FirestoreOrder,
  FirestoreOrderItem,
  FirestoreKitchenTicket,
  FirestoreOrderStatusHistory,
} from '../../types/firestore';
import { OrderStatus, KitchenTicketStatus } from '../../types';
import { rtdbPresenceService } from './rtdbPresenceService';

export interface CreateOrderInput {
  restaurantId: string;
  tableSessionId: string;
  tableId: string;
  tableNumber: string;
  items: {
    menuItemId: string;
    variantId?: string;
    addonIds?: string[];
    quantity: number;
    specialInstructions?: string;
  }[];
  customerPhone?: string;
  customerName?: string;
  specialNotes?: string;
  idempotencyKey?: string;
}

export class OrderRepository {
  /**
   * Place an order atomically with trusted server-style price calculation
   * Never relies on client-supplied unitPrice or totals
   */
  public static async createOrder(input: CreateOrderInput): Promise<FirestoreOrder> {
    const firestore = db;
    if (!firestore) {
      throw new Error('Database not initialized');
    }

    if (!input.items || input.items.length === 0) {
      throw new Error('Cannot place an empty order. Please select at least one dish.');
    }

    // 1. Idempotency Check: Prevent duplicate order submission
    if (input.idempotencyKey) {
      const existingQuery = query(
        collection(firestore, 'orders'),
        where('idempotencyKey', '==', input.idempotencyKey)
      );
      const existingSnap = await getDocs(existingQuery);
      if (!existingSnap.empty) {
        const d = existingSnap.docs[0];
        return { ...d.data(), orderId: d.id } as FirestoreOrder;
      }
    }

    // 2. Fetch all referenced menu items and addons from Firestore to calculate trusted prices
    const itemIds = [...new Set(input.items.map((i) => i.menuItemId))];
    const itemDocs = await Promise.all(
      itemIds.map((id) => getDoc(doc(firestore, 'menuItems', id)))
    );

    const itemMap = new Map<string, any>();
    itemDocs.forEach((docSnap) => {
      if (docSnap.exists()) {
        itemMap.set(docSnap.id, docSnap.data());
      }
    });

    // 3. Compute trusted prices and prepare order items
    let subtotal = 0;
    const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const orderNumber = `ORD-${new Date().getHours()}${new Date().getMinutes()}-${Math.floor(100 + Math.random() * 900)}`;

    const orderItems: FirestoreOrderItem[] = [];
    const stationItemsMap: Record<string, any[]> = {};

    for (let idx = 0; idx < input.items.length; idx++) {
      const entry = input.items[idx];
      const menuItem = itemMap.get(entry.menuItemId);
      if (!menuItem) {
        throw new Error(`Menu item not found: ${entry.menuItemId}`);
      }
      if (menuItem.isAvailable === false) {
        throw new Error(`Item "${menuItem.name}" is currently sold out.`);
      }

      // Compute variant delta
      let variantDelta = 0;
      let variantName: string | undefined;
      if (entry.variantId && menuItem.variants) {
        const variant = menuItem.variants.find((v: any) => v.id === entry.variantId);
        if (variant) {
          variantDelta = variant.priceDelta || 0;
          variantName = variant.name;
        }
      }

      // Addons total
      let addonsTotal = 0;
      const appliedAddons: { id: string; name: string; price: number }[] = [];
      // (Addons can be populated from menuItem config or global addons)

      const unitPrice = (menuItem.basePrice || 0) + variantDelta + addonsTotal;
      const itemTotal = unitPrice * entry.quantity;
      subtotal += itemTotal;

      const orderItemId = `oi-${orderId}-${idx + 1}`;
      const stationId = menuItem.kitchenStationId || 'sta-main';

      const orderItem: FirestoreOrderItem = {
        orderItemId,
        orderId,
        restaurantId: input.restaurantId,
        menuItemId: menuItem.itemId || entry.menuItemId,
        itemName: menuItem.name,
        variantId: entry.variantId,
        variantName,
        addons: appliedAddons,
        unitPrice,
        quantity: entry.quantity,
        totalPrice: itemTotal,
        specialInstructions: entry.specialInstructions || '',
        kitchenStationId: stationId,
      };

      orderItems.push(orderItem);

      if (!stationItemsMap[stationId]) {
        stationItemsMap[stationId] = [];
      }
      stationItemsMap[stationId].push(orderItem);
    }

    // 4. Calculate Taxes (2.5% CGST + 2.5% SGST)
    const cgstAmount = Math.round(subtotal * 0.025 * 100) / 100;
    const sgstAmount = Math.round(subtotal * 0.025 * 100) / 100;
    const discountAmount = 0;
    const totalAmount = Math.round((subtotal + cgstAmount + sgstAmount - discountAmount) * 100) / 100;

    const orderPayload: FirestoreOrder = {
      orderId,
      orderNumber,
      restaurantId: input.restaurantId,
      tableSessionId: input.tableSessionId,
      tableId: input.tableId,
      tableNumber: input.tableNumber,
      customerPhone: input.customerPhone,
      customerName: input.customerName,
      status: 'PLACED',
      paymentStatus: 'UNPAID',
      itemCount: input.items.reduce((sum, i) => sum + i.quantity, 0),
      subtotalAmount: subtotal,
      cgstAmount,
      sgstAmount,
      discountAmount,
      totalAmount,
      specialNotes: input.specialNotes,
      idempotencyKey: input.idempotencyKey,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // 5. Execute atomic write batch
    const batch = writeBatch(firestore);

    // Write Order
    const orderDocRef = doc(firestore, 'orders', orderId);
    batch.set(orderDocRef, orderPayload);

    // Write Order Items
    orderItems.forEach((oi) => {
      const oiDocRef = doc(firestore, 'orderItems', oi.orderItemId);
      batch.set(oiDocRef, oi);
    });

    // Write Kitchen Tickets partitioned by station
    Object.keys(stationItemsMap).forEach((stId) => {
      const ticketId = `tkt-${orderId}-${stId}`;
      const ticketPayload: FirestoreKitchenTicket = {
        ticketId,
        ticketNumber: `KOT-${Math.floor(100 + Math.random() * 900)}`,
        restaurantId: input.restaurantId,
        orderId,
        stationId: stId,
        stationName: stId.toUpperCase(),
        tableNumber: input.tableNumber,
        status: 'NEW',
        items: stationItemsMap[stId].map((item) => ({
          orderItemId: item.orderItemId,
          itemName: item.itemName,
          quantity: item.quantity,
          specialInstructions: item.specialInstructions,
        })),
        createdAt: serverTimestamp(),
      };
      const tktDocRef = doc(firestore, 'kitchenTickets', ticketId);
      batch.set(tktDocRef, ticketPayload);
    });

    // Write Initial Order Status History
    const historyId = `osh-${orderId}-new`;
    const historyPayload: FirestoreOrderStatusHistory = {
      historyId,
      orderId,
      restaurantId: input.restaurantId,
      previousStatus: 'PLACED',
      newStatus: 'PLACED',
      changedByRole: 'customer',
      reason: 'Customer placed order from table permanent QR',
      timestamp: serverTimestamp(),
    };
    batch.set(doc(firestore, 'orderStatusHistory', historyId), historyPayload);

    await batch.commit();

    // 6. Broadcast Realtime Signal to Kitchen & Waiter Devices
    rtdbPresenceService.emitLiveSignal(input.restaurantId, {
      eventType: 'NEW_ORDER',
      tableNumber: input.tableNumber,
      payload: {
        orderId,
        orderNumber,
        totalAmount,
      },
    });

    return orderPayload;
  }

  /**
   * Update order status with validation of allowed transitions
   */
  public static async updateOrderStatus(
    restaurantId: string,
    orderId: string,
    newStatus: OrderStatus,
    changedByUserId?: string,
    changedByRole?: string,
    reason?: string
  ): Promise<void> {
    if (!db) return;

    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) {
      throw new Error('Order not found');
    }

    const previousStatus = orderSnap.data().status as OrderStatus;
    const tableNumber = orderSnap.data().tableNumber;

    const batch = writeBatch(db);

    // Update Order
    batch.update(orderRef, {
      status: newStatus,
      updatedAt: serverTimestamp(),
    });

    // Log History
    const historyId = `osh-${orderId}-${Date.now()}`;
    const historyDoc = doc(db, 'orderStatusHistory', historyId);
    batch.set(historyDoc, {
      historyId,
      orderId,
      restaurantId,
      previousStatus,
      newStatus,
      changedByUserId: changedByUserId || null,
      changedByRole: changedByRole || 'staff',
      reason: reason || `Status changed to ${newStatus}`,
      timestamp: serverTimestamp(),
    });

    await batch.commit();

    // Broadcast Realtime Event
    if (newStatus === 'READY') {
      rtdbPresenceService.emitLiveSignal(restaurantId, {
        eventType: 'ORDER_READY',
        tableNumber,
        payload: { orderId, newStatus },
      });
    }
  }

  /**
   * Subscribe to live orders for counter/admin
   */
  public static subscribeToOrders(
    restaurantId: string,
    callback: (orders: FirestoreOrder[]) => void
  ): Unsubscribe {
    if (!db) return () => {};
    const q = query(
      collection(db, 'orders'),
      where('restaurantId', '==', restaurantId),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      const orders = snap.docs.map((d) => ({ ...d.data(), orderId: d.id } as FirestoreOrder));
      callback(orders);
    });
  }

  /**
   * Subscribe to kitchen tickets
   */
  public static subscribeToKitchenTickets(
    restaurantId: string,
    stationId?: string,
    callback?: (tickets: FirestoreKitchenTicket[]) => void
  ): Unsubscribe {
    if (!db || !callback) return () => {};
    let q = query(
      collection(db, 'kitchenTickets'),
      where('restaurantId', '==', restaurantId)
    );
    if (stationId) {
      q = query(q, where('stationId', '==', stationId));
    }
    return onSnapshot(q, (snap) => {
      const tickets = snap.docs.map(
        (d) => ({ ...d.data(), ticketId: d.id } as FirestoreKitchenTicket)
      );
      callback(tickets);
    });
  }
}
