// ====================================================================
// RESTO OS: Edge Function - settle-payment
// Authoritative bill settlement & session closing by Cashier / Admin
// ====================================================================

import { corsHeaders } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/response.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

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
      table_id,
      session_id,
      payment_method,
      transaction_ref,
      staff_id,
    } = body;

    if (!restaurant_id || !table_id || !session_id || !payment_method) {
      return errorResponse(
        'Missing required parameters: restaurant_id, table_id, session_id, payment_method.',
        400,
        'MISSING_REQUIRED_FIELDS'
      );
    }

    const method = String(payment_method).toUpperCase();
    if (!['CASH', 'UPI', 'CARD', 'ONLINE'].includes(method)) {
      return errorResponse('Invalid payment method. Allowed: CASH, UPI, CARD.', 400, 'INVALID_PAYMENT_METHOD');
    }

    const supabase = getServiceClient();

    // Call stored procedure
    const { data, error } = await supabase.rpc('settle_table_bill_and_close_session', {
      p_restaurant_id: restaurant_id,
      p_table_id: table_id,
      p_session_id: session_id,
      p_payment_method: method,
      p_transaction_ref: transaction_ref || null,
    });

    if (error) {
      console.error('Error in settle_table_bill_and_close_session RPC:', error);
      return errorResponse('Failed to settle bill.', 500, 'DATABASE_ERROR', error.message);
    }

    if (!data || !data.success) {
      return errorResponse(data?.message || 'Bill settlement failed.', 400, data?.error || 'SETTLEMENT_FAILED');
    }

    // Trigger Notification for Table Cleaning
    const { data: table } = await supabase
      .from('restaurant_tables')
      .select('table_number')
      .eq('id', table_id)
      .single();

    const tNum = table?.table_number || 'Table';

    await supabase.from('notification_events').insert({
      restaurant_id,
      event_type: 'PAYMENT_RECEIVED',
      target_role: 'waiter',
      table_id,
      table_number: tNum,
      title: 'Payment Received - Table Needs Cleaning',
      message_en: `Payment of ₹${data.total_amount} received for Table ${tNum}. Table is ready for cleaning.`,
      message_hi: `Table ${tNum} ka payment receive ho gaya hai. Table cleaning kijiye.`,
      payload: {
        table_id,
        table_number: tNum,
        invoice_number: data.invoice_number,
        total_amount: data.total_amount,
        payment_method: method,
      },
    }).catch(() => {});

    return jsonResponse(data, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('Unhandled exception in settle-payment:', err);
    return errorResponse(message, 500, 'INTERNAL_SERVER_ERROR');
  }
});
