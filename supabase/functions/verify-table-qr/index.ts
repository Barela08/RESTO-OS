// ====================================================================
// RESTO OS: Edge Function - verify-table-qr
// Verifies QR cryptographic hash, resumes active session or initiates new
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
    const { token_hash, ip_address, user_agent } = body;

    if (!token_hash || typeof token_hash !== 'string' || token_hash.trim().length === 0) {
      return errorResponse('Missing or invalid token_hash parameter.', 400, 'INVALID_INPUT');
    }

    const cleanHash = token_hash.trim();
    const clientIp = ip_address || req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '0.0.0.0';
    const clientAgent = user_agent || req.headers.get('user-agent') || 'Unknown';

    const supabase = getServiceClient();

    // Call PostgreSQL stored procedure
    const { data, error } = await supabase.rpc('verify_table_qr_token', {
      p_token_hash: cleanHash,
      p_ip_address: clientIp,
      p_user_agent: clientAgent,
    });

    if (error) {
      console.error('Error invoking verify_table_qr_token RPC:', error);
      return errorResponse('Failed to verify table QR token.', 500, 'DATABASE_ERROR', error.message);
    }

    if (!data || !data.success) {
      const errCode = data?.error_code || 'INVALID_TOKEN';
      const errMsg = data?.message || 'QR code verification failed.';
      const status = errCode === 'EXPIRED_TOKEN' ? 410 : errCode === 'REVOKED_TOKEN' ? 403 : 400;
      return errorResponse(errMsg, status, errCode);
    }

    return jsonResponse(data, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('Unhandled exception in verify-table-qr:', err);
    return errorResponse(message, 500, 'INTERNAL_SERVER_ERROR');
  }
});
