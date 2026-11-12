// ====================================================================
// RESTO OS: Edge Function - create-order
// Database-authoritative order creation with price & variant validation,
// tax computation, idempotency check, kitchen ticket and voice notification
// ====================================================================

import { corsHeaders } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/response.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

interface OrderItemInput {
  menu_item_id: string;
  quantity: number;
  variant_id?: string;
  addon_ids?: string[];
  notes?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed. Use POST.', 405, 'METHOD_NOT_ALLOWED');
    }

    const body = await req.json().catch(() => ({}));
    const {
      restaurant_id,
      table_session_id,
      session_token,
      items,
      customer_name,
      customer_phone,
      special_notes,
    } = body;

    const idempotencyKey =
      req.headers.get('idempotency-key') || body.idempotency_key;

    if (!restaurant_id || !table_session_id || !session_token) {
      return errorResponse(
        'Missing required parameters: restaurant_id, table_session_id, session_token.',
        400,
        'MISSING_REQUIRED_FIELDS'
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return errorResponse('Order must contain at least one item.', 400, 'EMPTY_ORDER');
    }

    const supabase = getServiceClient();

    // 1. Verify Active Table Session
    const { data: session, error: sessionErr } = await supabase
      .from('table_sessions')
      .select('id, table_id, restaurant_id, status, session_token, restaurant_tables(table_number, floor_area)')
      .eq('id', table_session_id)
      .eq('restaurant_id', restaurant_id)
      .single();

    if (sessionErr || !session) {
      return errorResponse('Invalid table session.', 404, 'SESSION_NOT_FOUND');
    }

    if (session.status !== 'ACTIVE' || session.session_token !== session_token) {
      return errorResponse('Table session is not active or token mismatch.', 403, 'INVALID_SESSION');
    }

    // 2. Check Idempotency Key (prevent double order submissions)
    if (idempotencyKey) {
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('table_session_id', table_session_id)
        .eq('special_instructions', `[idempotency:${idempotencyKey}]`)
        .maybeSingle();

      if (existingOrder) {
        return jsonResponse(
          {
            success: true,
            is_idempotent_duplicate: true,
            order: existingOrder,
            message: 'Returning existing order for idempotency key.',
          },
          200
        );
      }
    }

    // 3. Fetch Restaurant Settings for Taxes
    const { data: settings } = await supabase
      .from('restaurant_settings')
      .select('cgst_rate, sgst_rate, service_charge_rate')
      .eq('restaurant_id', restaurant_id)
      .maybeSingle();

    const cgstRate = settings?.cgst_rate ?? 2.5;
    const sgstRate = settings?.sgst_rate ?? 2.5;
    const serviceChargeRate = settings?.service_charge_rate ?? 0.0;

    // 4. Validate Menu Items & Calculate Line Prices from Database
    const validatedItems: Array<{
      menu_item_id: string;
      item_name: string;
      quantity: number;
      unit_price: number;
      line_total: number;
      variant_id?: string;
      addon_ids?: string[];
      notes?: string;
    }> = [];

    let subtotal = 0;

    for (const rawItem of items as OrderItemInput[]) {
      const qty = Math.max(1, Math.floor(rawItem.quantity || 1));

      const { data: menuItem, error: itemErr } = await supabase
        .from('menu_items')
        .select('id, name, base_price, is_available')
        .eq('id', rawItem.menu_item_id)
        .eq('restaurant_id', restaurant_id)
        .single();

      if (itemErr || !menuItem || !menuItem.is_available) {
        return errorResponse(
          `Item ${rawItem.menu_item_id} is unavailable or invalid.`,
          400,
          'ITEM_UNAVAILABLE'
        );
      }

      let unitPrice = Number(menuItem.base_price);

      // Check variant price delta
      if (rawItem.variant_id) {
        const { data: variant } = await supabase
          .from('menu_variants')
          .select('price_adjustment')
          .eq('id', rawItem.variant_id)
          .eq('menu_item_id', menuItem.id)
          .maybeSingle();

        if (variant) {
          unitPrice += Number(variant.price_adjustment || 0);
        }
      }

      // Check addons price
      if (Array.isArray(rawItem.addon_ids) && rawItem.addon_ids.length > 0) {
        const { data: addons } = await supabase
          .from('menu_addons')
          .select('price')
          .in('id', rawItem.addon_ids)
          .eq('is_available', true);

        if (addons) {
          const addonsSum = addons.reduce((acc, a) => acc + Number(a.price || 0), 0);
          unitPrice += addonsSum;
        }
      }

      const lineTotal = Math.round(unitPrice * qty * 100) / 100;
      subtotal += lineTotal;

      validatedItems.push({
        menu_item_id: menuItem.id,
        item_name: menuItem.name,
        quantity: qty,
        unit_price: unitPrice,
        line_total: lineTotal,
        variant_id: rawItem.variant_id,
        addon_ids: rawItem.addon_ids,
        notes: rawItem.notes,
      });
    }

    subtotal = Math.round(subtotal * 100) / 100;
    const cgstAmount = Math.round(subtotal * (cgstRate / 100) * 100) / 100;
    const sgstAmount = Math.round(subtotal * (sgstRate / 100) * 100) / 100;
    const serviceCharge = Math.round(subtotal * (serviceChargeRate / 100) * 100) / 100;
    const totalAmount = Math.round((subtotal + cgstAmount + sgstAmount + serviceCharge) * 100) / 100;

    // 5. Generate Sequential-Like Order Number
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const instructionsText = idempotencyKey
      ? `[idempotency:${idempotencyKey}] ${special_notes || ''}`.trim()
      : special_notes || null;

    // 6. Insert Order
    const { data: newOrder, error: orderInsertErr } = await supabase
      .from('orders')
      .insert({
        restaurant_id,
        table_id: session.table_id,
        table_session_id,
        order_number: orderNumber,
        customer_name: customer_name || null,
        customer_phone: customer_phone || null,
        subtotal,
        cgst_amount: cgstAmount,
        sgst_amount: sgstAmount,
        total_amount: totalAmount,
        order_status: 'PENDING',
        special_instructions: instructionsText,
      })
      .select()
      .single();

    if (orderInsertErr || !newOrder) {
      console.error('Failed to insert order:', orderInsertErr);
      return errorResponse('Failed to create order record.', 500, 'ORDER_CREATION_FAILED');
    }

    // 7. Insert Order Items & Addons
    const createdItems = [];
    for (const item of validatedItems) {
      const { data: createdItem, error: oiErr } = await supabase
        .from('order_items')
        .insert({
          order_id: newOrder.id,
          menu_item_id: item.menu_item_id,
          variant_id: item.variant_id || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
          special_requests: item.notes || null,
          status: 'PENDING',
        })
        .select()
        .single();

      if (!oiErr && createdItem) {
        createdItems.push(createdItem);

        // Insert addons if any
        if (item.addon_ids && item.addon_ids.length > 0) {
          const addonRows = item.addon_ids.map((aid) => ({
            order_item_id: createdItem.id,
            addon_id: aid,
          }));
          await supabase.from('order_item_addons').insert(addonRows).catch(() => {});
        }
      }
    }

    // 8. Create Kitchen Ticket
    const ticketNumber = `KOT-${newOrder.order_number.replace('ORD-', '')}`;
    const { data: kot } = await supabase
      .from('kitchen_tickets')
      .insert({
        restaurant_id,
        order_id: newOrder.id,
        ticket_number: ticketNumber,
        status: 'PENDING',
      })
      .select()
      .single();

    if (kot && createdItems.length > 0) {
      const ticketItems = createdItems.map((ci) => ({
        kitchen_ticket_id: kot.id,
        order_item_id: ci.id,
        quantity: ci.quantity,
        status: 'PENDING',
      }));
      await supabase.from('kitchen_ticket_items').insert(ticketItems).catch(() => {});
    }

    // 9. Record Order Status History
    await supabase.from('order_status_history').insert({
      order_id: newOrder.id,
      from_status: 'NONE',
      to_status: 'PENDING',
      actor_role: 'CUSTOMER',
      notes: 'Customer placed order via Smart Table QR',
    }).catch(() => {});

    // 10. Trigger Realtime Notification Event for Staff Dashboards & Voice Announcements
    const tableNumber =
      (session.restaurant_tables as unknown as { table_number?: string })?.table_number || 'Dining Table';

    await supabase.from('notification_events').insert({
      restaurant_id,
      event_type: 'NEW_ORDER',
      target_role: 'counter',
      table_id: session.table_id,
      table_number: tableNumber,
      order_id: newOrder.id,
      title: 'New Table Order Received',
      message_en: `Attention! A new order ${orderNumber} has been received from Table Number ${tableNumber}.`,
      message_hi: `Dhyan dijiye! Table number ${tableNumber} se naya order aaya hai. Kripya order check karein.`,
      payload: {
        order_id: newOrder.id,
        order_number: orderNumber,
        table_number: tableNumber,
        total_amount: totalAmount,
        item_count: validatedItems.length,
      },
    }).catch((err: unknown) => console.error('Notification dispatch err:', err));

    return jsonResponse(
      {
        success: true,
        order: newOrder,
        items: createdItems,
        kitchen_ticket: kot,
        message: 'Order created successfully.',
      },
      201
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('Unhandled exception in create-order:', err);
    return errorResponse(message, 500, 'INTERNAL_SERVER_ERROR');
  }
});
