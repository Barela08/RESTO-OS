// ====================================================================
// RESTO OS: Edge Function - manage-refund
// Secure refund processing by Cashier / Admin with audit & loyalty reversal
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
      payment_id,
      amount,
      reason,
      authorized_by_staff_id,
    } = body;

    if (!restaurant_id || !payment_id || !amount || !reason) {
      return errorResponse(
        'Missing required parameters: restaurant_id, payment_id, amount, reason.',
        400,
        'MISSING_FIELDS'
      );
    }

    const refundAmount = Number(amount);
    if (isNaN(refundAmount) || refundAmount <= 0) {
      return errorResponse('Refund amount must be a positive number.', 400, 'INVALID_AMOUNT');
    }

    const supabase = getServiceClient();

    // 1. Fetch original payment
    const { data: payment, error: payErr } = await supabase
      .from('payments')
      .select('*, orders(id, customer_id, customer_phone, invoices(id, total_amount))')
      .eq('id', payment_id)
      .eq('restaurant_id', restaurant_id)
      .single();

    if (payErr || !payment) {
      return errorResponse('Original payment record not found.', 404, 'PAYMENT_NOT_FOUND');
    }

    if (payment.payment_status !== 'SUCCESS') {
      return errorResponse(
        `Cannot refund a payment with status ${payment.payment_status}. Only successful payments can be refunded.`,
        400,
        'INVALID_PAYMENT_STATUS'
      );
    }

    if (refundAmount > Number(payment.amount)) {
      return errorResponse(
        `Refund amount (₹${refundAmount}) cannot exceed original payment amount (₹${payment.amount}).`,
        400,
        'AMOUNT_EXCEEDS_PAYMENT'
      );
    }

    // Check existing refunds for this payment
    const { data: existingRefunds } = await supabase
      .from('refunds')
      .select('amount')
      .eq('payment_id', payment_id)
      .eq('status', 'APPROVED');

    const totalAlreadyRefunded = (existingRefunds || []).reduce(
      (acc, r) => acc + Number(r.amount || 0),
      0
    );

    if (totalAlreadyRefunded + refundAmount > Number(payment.amount)) {
      return errorResponse(
        `Cumulative refunds (₹${totalAlreadyRefunded + refundAmount}) would exceed payment amount (₹${payment.amount}).`,
        400,
        'EXCEEDS_CUMULATIVE_LIMIT'
      );
    }

    // 2. Create Refund Record
    const invoiceId = payment.orders?.invoices?.[0]?.id || null;

    const { data: refundRecord, error: refErr } = await supabase
      .from('refunds')
      .insert({
        restaurant_id,
        payment_id,
        invoice_id: invoiceId,
        amount: refundAmount,
        reason: String(reason).trim(),
        authorized_by_staff_id: authorized_by_staff_id || null,
        status: 'APPROVED',
      })
      .select()
      .single();

    if (refErr || !refundRecord) {
      return errorResponse('Failed to record refund.', 500, 'DATABASE_ERROR', refErr?.message);
    }

    // 3. Reverse Loyalty Stamp if full refund
    if (refundAmount >= Number(payment.amount)) {
      await supabase
        .from('loyalty_stamps')
        .update({
          is_reversed: true,
          reversed_reason: `Full refund issued: ${reason}`,
        })
        .eq('payment_id', payment_id)
        .catch(() => {});
    }

    // 4. Log to Audit Trail
    await supabase.from('audit_logs').insert({
      restaurant_id,
      user_id: authorized_by_staff_id || null,
      user_role: 'counter',
      action: 'ISSUE_REFUND',
      entity_name: 'refunds',
      entity_id: refundRecord.id,
      payload: {
        payment_id,
        refund_amount: refundAmount,
        original_payment_amount: Number(payment.amount),
        reason,
      },
    }).catch(() => {});

    return jsonResponse({
      success: true,
      refund: refundRecord,
      message: `Refund of ₹${refundAmount} processed successfully.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return errorResponse(message, 500, 'INTERNAL_SERVER_ERROR');
  }
});
