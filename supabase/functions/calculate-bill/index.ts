// ====================================================================
// RESTO OS: Edge Function - calculate-bill
// Computes itemized bill, taxes, service charges and discounts for table sessions
// ====================================================================

import { corsHeaders } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/response.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let restaurant_id: string | null = null;
    let table_session_id: string | null = null;
    let table_id: string | null = null;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      restaurant_id = url.searchParams.get('restaurant_id');
      table_session_id = url.searchParams.get('table_session_id');
      table_id = url.searchParams.get('table_id');
    } else if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      restaurant_id = body.restaurant_id;
      table_session_id = body.table_session_id;
      table_id = body.table_id;
    }

    if (!restaurant_id || (!table_session_id && !table_id)) {
      return errorResponse(
        'Missing parameters: restaurant_id and (table_session_id or table_id) are required.',
        400,
        'MISSING_REQUIRED_FIELDS'
      );
    }

    const supabase = getServiceClient();

    // 1. If table_id passed without table_session_id, find active session
    let sessionId = table_session_id;
    if (!sessionId && table_id) {
      const { data: actSession } = await supabase
        .from('table_sessions')
        .select('id')
        .eq('table_id', table_id)
        .eq('status', 'ACTIVE')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (actSession) {
        sessionId = actSession.id;
      }
    }

    if (!sessionId) {
      return errorResponse('No active dining session found.', 404, 'SESSION_NOT_FOUND');
    }

    // 2. Fetch all valid orders for this session
    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('*, order_items(*, menu_items(name, base_price))')
      .eq('table_session_id', sessionId)
      .neq('order_status', 'CANCELLED');

    if (ordersErr) {
      return errorResponse('Failed to fetch orders.', 500, 'DATABASE_ERROR', ordersErr.message);
    }

    // 3. Fetch Restaurant Settings
    const { data: settings } = await supabase
      .from('restaurant_settings')
      .select('cgst_rate, sgst_rate, service_charge_rate, currency, currency_symbol')
      .eq('restaurant_id', restaurant_id)
      .maybeSingle();

    const cgstRate = settings?.cgst_rate ?? 2.5;
    const sgstRate = settings?.sgst_rate ?? 2.5;
    const serviceChargeRate = settings?.service_charge_rate ?? 0.0;

    // 4. Aggregate Subtotals
    let subtotal = 0;
    const allItems: Array<{
      order_id: string;
      item_name: string;
      quantity: number;
      unit_price: number;
      line_total: number;
    }> = [];

    for (const ord of orders || []) {
      for (const item of ord.order_items || []) {
        const lineTotal = Number(item.line_total || item.unit_price * item.quantity);
        subtotal += lineTotal;
        allItems.push({
          order_id: ord.id,
          item_name: item.menu_items?.name || 'Dish Item',
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          line_total: lineTotal,
        });
      }
    }

    subtotal = Math.round(subtotal * 100) / 100;
    const cgstAmount = Math.round(subtotal * (cgstRate / 100) * 100) / 100;
    const sgstAmount = Math.round(subtotal * (sgstRate / 100) * 100) / 100;
    const serviceCharge = Math.round(subtotal * (serviceChargeRate / 100) * 100) / 100;
    const totalAmount = Math.round((subtotal + cgstAmount + sgstAmount + serviceCharge) * 100) / 100;

    return jsonResponse({
      success: true,
      table_session_id: sessionId,
      orders_count: (orders || []).length,
      subtotal,
      cgst_rate: cgstRate,
      cgst_amount: cgstAmount,
      sgst_rate: sgstRate,
      sgst_amount: sgstAmount,
      service_charge_rate: serviceChargeRate,
      service_charge_amount: serviceCharge,
      total_amount: totalAmount,
      items: allItems,
      orders: orders || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return errorResponse(message, 500, 'INTERNAL_SERVER_ERROR');
  }
});
