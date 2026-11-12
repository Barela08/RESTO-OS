// ====================================================================
// RESTO OS: Edge Function - send-notification
// Centralized notification & voice announcement dispatcher
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
      event_type,
      target_role,
      target_user_id,
      table_id,
      table_number,
      order_id,
      title,
      message_en,
      message_hi,
      payload,
    } = body;

    if (!restaurant_id || !event_type || !title) {
      return errorResponse('Missing required parameters: restaurant_id, event_type, title.', 400, 'MISSING_FIELDS');
    }

    const supabase = getServiceClient();

    // Insert into notification_events (triggers Supabase Realtime broadcast to connected clients)
    const { data: event, error: eventErr } = await supabase
      .from('notification_events')
      .insert({
        restaurant_id,
        event_type,
        target_role: target_role || null,
        target_user_id: target_user_id || null,
        table_id: table_id || null,
        table_number: table_number || null,
        order_id: order_id || null,
        title,
        message_en: message_en || title,
        message_hi: message_hi || null,
        payload: payload || {},
      })
      .select()
      .single();

    if (eventErr || !event) {
      return errorResponse('Failed to create notification event.', 500, 'DATABASE_ERROR', eventErr?.message);
    }

    // Insert into persistent notifications
    await supabase.from('notifications').insert({
      restaurant_id,
      recipient_role: target_role || null,
      recipient_user_id: target_user_id || null,
      title,
      message: message_en || title,
      event_type,
      reference_id: order_id || table_id || null,
      is_read: false,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      event_id: event.id,
      event_type: event.event_type,
      message: 'Notification event dispatched successfully.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return errorResponse(message, 500, 'INTERNAL_SERVER_ERROR');
  }
});
