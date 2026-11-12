// ====================================================================
// RESTO OS: Edge Functions Client
// Client interface to invoke production Supabase Edge Functions
// with robust error handling, session token passing and local fallbacks
// ====================================================================

import { supabase, isLiveSupabaseConfigured } from './supabase';

export interface EdgeResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

export class EdgeFunctionsClient {
  private static async invoke<T>(
    functionName: string,
    body: Record<string, unknown>,
    headers: Record<string, string> = {}
  ): Promise<EdgeResponse<T>> {
    if (!isLiveSupabaseConfigured()) {
      return {
        success: false,
        error: 'Live Supabase is not configured in client environment.',
        errorCode: 'SUPABASE_NOT_CONFIGURED',
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      });

      if (error) {
        const isNotDeployed =
          error.message?.includes('non-2xx') ||
          error.message?.includes('404') ||
          error.message?.includes('NOT_FOUND') ||
          (error as any)?.context?.status === 404;
        return {
          success: false,
          error: error.message || 'Edge function call failed',
          errorCode: isNotDeployed ? 'EDGE_FUNCTION_NOT_DEPLOYED' : 'EDGE_FUNCTION_ERROR',
        };
      }

      if (data && typeof data === 'object' && 'success' in data && data.success === false) {
        return {
          success: false,
          error: (data as { error?: string }).error || 'Operation failed',
          errorCode: (data as { errorCode?: string }).errorCode,
        };
      }

      return {
        success: true,
        data: data as T,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown Edge function invocation error';
      return {
        success: false,
        error: msg,
        errorCode: 'NETWORK_ERROR',
      };
    }
  }

  // 1. Verify Table QR
  public static async verifyTableQR(params: {
    tokenHash: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.invoke<{
      success: boolean;
      session_id: string;
      session_token: string;
      qr_token_id?: string;
      table_id: string;
      table_number: string;
      table_status: string;
      restaurant_id: string;
      is_resumed: boolean;
      message: string;
    }>('verify-table-qr', {
      token_hash: params.tokenHash,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
    });
  }

  // 2. Create Order
  public static async createOrder(params: {
    restaurantId: string;
    tableSessionId: string;
    sessionToken: string;
    items: Array<{
      menu_item_id: string;
      quantity: number;
      variant_id?: string;
      addon_ids?: string[];
      notes?: string;
    }>;
    customerName?: string;
    customerPhone?: string;
    specialNotes?: string;
    idempotencyKey?: string;
  }) {
    return this.invoke<{
      success: boolean;
      order: Record<string, unknown>;
      items: Array<Record<string, unknown>>;
      message: string;
    }>(
      'create-order',
      {
        restaurant_id: params.restaurantId,
        table_session_id: params.tableSessionId,
        session_token: params.sessionToken,
        items: params.items,
        customer_name: params.customerName,
        customer_phone: params.customerPhone,
        special_notes: params.specialNotes,
        idempotency_key: params.idempotencyKey,
      },
      params.idempotencyKey ? { 'idempotency-key': params.idempotencyKey } : {}
    );
  }

  // 3. Calculate Bill
  public static async calculateBill(params: {
    restaurantId: string;
    tableSessionId?: string;
    tableId?: string;
  }) {
    return this.invoke<{
      success: boolean;
      subtotal: number;
      cgst_amount: number;
      sgst_amount: number;
      service_charge_amount: number;
      total_amount: number;
      items: Array<Record<string, unknown>>;
    }>('calculate-bill', {
      restaurant_id: params.restaurantId,
      table_session_id: params.tableSessionId,
      table_id: params.tableId,
    });
  }

  // 4. Settle Payment
  public static async settlePayment(params: {
    restaurantId: string;
    tableId: string;
    sessionId: string;
    paymentMethod: 'CASH' | 'UPI' | 'CARD';
    transactionRef?: string;
    staffId?: string;
  }) {
    return this.invoke<{
      success: boolean;
      invoice_id: string;
      invoice_number: string;
      payment_id: string;
      total_amount: number;
      table_status: string;
      message: string;
    }>('settle-payment', {
      restaurant_id: params.restaurantId,
      table_id: params.tableId,
      session_id: params.sessionId,
      payment_method: params.paymentMethod,
      transaction_ref: params.transactionRef,
      staff_id: params.staffId,
    });
  }

  // 5. Verify UPI Payment
  public static async submitUpiUtr(params: {
    restaurantId: string;
    tableSessionId: string;
    tableId: string;
    amount: number;
    utrNumber: string;
    customerPhone?: string;
  }) {
    return this.invoke<{
      success: boolean;
      request_id: string;
      status: string;
      message: string;
    }>('verify-upi-payment', {
      action: 'SUBMIT_UTR',
      restaurant_id: params.restaurantId,
      table_session_id: params.tableSessionId,
      table_id: params.tableId,
      amount: params.amount,
      utr_number: params.utrNumber,
      customer_phone: params.customerPhone,
    });
  }

  public static async decideUpiVerification(params: {
    requestId: string;
    decision: 'APPROVED' | 'REJECTED';
    rejectionReason?: string;
    staffId?: string;
  }) {
    return this.invoke<{
      success: boolean;
      decision: string;
      message: string;
    }>('verify-upi-payment', {
      action: 'COUNTER_DECISION',
      request_id: params.requestId,
      decision: params.decision,
      rejection_reason: params.rejectionReason,
      staff_id: params.staffId,
    });
  }

  // 6. Staff Authentication
  public static async staffAuth(params: {
    loginId: string;
    password: string;
    restaurantId?: string;
  }) {
    return this.invoke<{
      success: boolean;
      token: string;
      profile: {
        id: string;
        email: string;
        full_name: string;
        phone?: string;
        role: string;
        role_id: string;
        restaurant_id: string;
      };
      message: string;
    }>('staff-auth', {
      login_id: params.loginId,
      password: params.password,
      restaurant_id: params.restaurantId,
    });
  }

  // 7. Send Notification
  public static async sendNotification(params: {
    restaurantId: string;
    eventType: string;
    title: string;
    targetRole?: string;
    targetUserId?: string;
    tableId?: string;
    tableNumber?: string;
    orderId?: string;
    messageEn?: string;
    messageHi?: string;
    payload?: Record<string, unknown>;
  }) {
    return this.invoke<{
      success: boolean;
      event_id: string;
      message: string;
    }>('send-notification', {
      restaurant_id: params.restaurantId,
      event_type: params.eventType,
      title: params.title,
      target_role: params.targetRole,
      target_user_id: params.targetUserId,
      table_id: params.tableId,
      table_number: params.tableNumber,
      order_id: params.orderId,
      message_en: params.messageEn,
      message_hi: params.messageHi,
      payload: params.payload,
    });
  }

  // 8. Manage Refund
  public static async manageRefund(params: {
    restaurantId: string;
    paymentId: string;
    amount: number;
    reason: string;
    authorizedByStaffId?: string;
  }) {
    return this.invoke<{
      success: boolean;
      refund: Record<string, unknown>;
      message: string;
    }>('manage-refund', {
      restaurant_id: params.restaurantId,
      payment_id: params.paymentId,
      amount: params.amount,
      reason: params.reason,
      authorized_by_staff_id: params.authorizedByStaffId,
    });
  }
}
