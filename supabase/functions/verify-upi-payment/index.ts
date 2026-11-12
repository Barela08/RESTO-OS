// ====================================================================
// RESTO OS: Edge Function - verify-upi-payment
// Handles Manual UPI QR payments, UTR submissions & Cashier verification
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
    const { action } = body;

    const supabase = getServiceClient();

    // -------------------------------------------------------------
    // ACTION 1: SUBMIT_UTR (Customer submits transaction reference)
    // -------------------------------------------------------------
    if (action === 'SUBMIT_UTR') {
      const {
        restaurant_id,
        table_session_id,
        table_id,
        amount,
        utr_number,
        customer_phone,
      } = body;

      if (!restaurant_id || !table_session_id || !utr_number || !amount) {
        return errorResponse(
          'Missing required parameters: restaurant_id, table_session_id, amount, utr_number.',
          400,
          'MISSING_REQUIRED_FIELDS'
        );
      }

      const cleanUtr = String(utr_number).trim().toUpperCase();

      // UTR Validation: standard Indian bank UTR is 12 digits, or min 8 alphanumeric chars
      if (cleanUtr.length < 8 || !/^[A-Z0-9]+$/.test(cleanUtr)) {
        return errorResponse(
          'Invalid UTR/Transaction Reference format. Please enter a valid 12-digit UPI reference.',
          400,
          'INVALID_UTR_FORMAT'
        );
      }

      // Check if UTR is already used on another completed payment
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id, payment_status, created_at')
        .eq('transaction_reference', cleanUtr)
        .eq('restaurant_id', restaurant_id)
        .eq('payment_status', 'SUCCESS')
        .maybeSingle();

      if (existingPayment) {
        return errorResponse(
          'This UTR has already been verified and processed for another bill.',
          409,
          'DUPLICATE_UTR'
        );
      }

      // Get Table info
      const { data: table } = await supabase
        .from('restaurant_tables')
        .select('table_number')
        .eq('id', table_id)
        .maybeSingle();

      const tableNumber = table?.table_number || 'Table';

      // Insert or update verification request
      const { data: reqRecord, error: reqErr } = await supabase
        .from('payment_verification_requests')
        .insert({
          restaurant_id,
          table_id,
          table_session_id,
          expected_amount: Number(amount),
          customer_submitted_ref: cleanUtr,
          customer_phone: customer_phone || null,
          verification_status: 'PENDING',
        })
        .select()
        .single();

      if (reqErr) {
        return errorResponse('Failed to record payment verification request.', 500, 'DATABASE_ERROR', reqErr.message);
      }

      // Record pending payment
      await supabase.from('payments').insert({
        restaurant_id,
        table_session_id,
        amount: Number(amount),
        payment_method: 'UPI',
        payment_status: 'PENDING',
        transaction_reference: cleanUtr,
      }).catch(() => {});

      // Dispatch Realtime Voice & Dashboard Notification to Cash Counter
      await supabase.from('notification_events').insert({
        restaurant_id,
        event_type: 'PAYMENT_RECEIVED',
        target_role: 'counter',
        table_id,
        table_number: tableNumber,
        title: 'UPI Payment Verification Required',
        message_en: `Attention! UPI payment of ₹${amount} submitted for Table ${tableNumber} with UTR ${cleanUtr}. Counter confirmation required.`,
        message_hi: `Dhyan dijiye! Table number ${tableNumber} se ₹${amount} ka UPI payment verification aaya hai. UTR check karein.`,
        payload: {
          request_id: reqRecord.id,
          table_id,
          table_number: tableNumber,
          amount: Number(amount),
          utr: cleanUtr,
        },
      }).catch(() => {});

      return jsonResponse({
        success: true,
        request_id: reqRecord.id,
        status: 'PENDING',
        message: 'Payment verification submitted. Counter staff will verify your UTR.',
      });
    }

    // -------------------------------------------------------------
    // ACTION 2: COUNTER_DECISION (Cashier verifies or rejects UTR)
    // -------------------------------------------------------------
    if (action === 'COUNTER_DECISION') {
      const {
        request_id,
        decision, // 'APPROVED' | 'REJECTED'
        rejection_reason,
        staff_id,
      } = body;

      if (!request_id || !decision || !['APPROVED', 'REJECTED'].includes(decision)) {
        return errorResponse(
          'Missing or invalid parameters: request_id, decision (APPROVED | REJECTED).',
          400,
          'INVALID_PARAMETERS'
        );
      }

      const { data: vReq, error: vReqErr } = await supabase
        .from('payment_verification_requests')
        .select('*')
        .eq('id', request_id)
        .single();

      if (vReqErr || !vReq) {
        return errorResponse('Payment verification request not found.', 404, 'NOT_FOUND');
      }

      if (vReq.verification_status !== 'PENDING') {
        return errorResponse(
          `Request already resolved with status ${vReq.verification_status}.`,
          409,
          'ALREADY_RESOLVED'
        );
      }

      if (decision === 'APPROVED') {
        // Settle Bill
        const { data: settleData, error: settleErr } = await supabase.rpc(
          'settle_table_bill_and_close_session',
          {
            p_restaurant_id: vReq.restaurant_id,
            p_table_id: vReq.table_id,
            p_session_id: vReq.table_session_id,
            p_payment_method: 'UPI',
            p_transaction_ref: vReq.customer_submitted_ref,
          }
        );

        if (settleErr || !settleData?.success) {
          return errorResponse(
            settleData?.message || 'Failed to settle bill during approval.',
            500,
            'SETTLEMENT_FAILED'
          );
        }

        // Update verification request
        await supabase
          .from('payment_verification_requests')
          .update({
            verification_status: 'APPROVED',
            verified_by_staff_id: staff_id || null,
            verified_at: new Date().toISOString(),
          })
          .eq('id', request_id);

        return jsonResponse({
          success: true,
          decision: 'APPROVED',
          settlement: settleData,
          message: 'UPI payment verified and bill marked PAID.',
        });
      } else {
        // REJECTED
        await supabase
          .from('payment_verification_requests')
          .update({
            verification_status: 'REJECTED',
            rejection_reason: rejection_reason || 'UTR could not be verified in merchant bank statement.',
            verified_by_staff_id: staff_id || null,
            verified_at: new Date().toISOString(),
          })
          .eq('id', request_id);

        return jsonResponse({
          success: true,
          decision: 'REJECTED',
          message: 'Payment verification rejected. Customer notified to retry or pay cash.',
        });
      }
    }

    return errorResponse('Invalid action. Use SUBMIT_UTR or COUNTER_DECISION.', 400, 'INVALID_ACTION');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('Unhandled exception in verify-upi-payment:', err);
    return errorResponse(message, 500, 'INTERNAL_SERVER_ERROR');
  }
});
