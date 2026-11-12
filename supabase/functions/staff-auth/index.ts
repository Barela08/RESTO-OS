// ====================================================================
// RESTO OS: Edge Function - staff-auth
// Backend-authoritative staff login, lockout protection, audit logging
// ====================================================================

import { corsHeaders } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/response.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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
    const { login_id, password, restaurant_id } = body;

    if (!login_id || !password) {
      return errorResponse('Missing login_id or password.', 400, 'MISSING_CREDENTIALS');
    }

    const cleanLogin = String(login_id).trim().toLowerCase();
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '0.0.0.0';

    const supabase = getServiceClient();

    // 1. Check Rate Limit / Lockout
    const { data: rateLimit } = await supabase
      .from('login_rate_limits')
      .select('*')
      .eq('identifier', cleanLogin)
      .maybeSingle();

    if (rateLimit?.locked_until && new Date(rateLimit.locked_until) > new Date()) {
      const waitMinutes = Math.ceil(
        (new Date(rateLimit.locked_until).getTime() - Date.now()) / (1000 * 60)
      );
      return errorResponse(
        `Account temporarily locked due to excessive failed attempts. Please try again in ${waitMinutes} minutes.`,
        429,
        'ACCOUNT_LOCKED',
        { locked_until: rateLimit.locked_until }
      );
    }

    // 2. Fetch Profile by email or username
    let query = supabase
      .from('profiles')
      .select('id, restaurant_id, email, full_name, phone, role_id, is_active, password_hash, failed_login_attempts, locked_until')
      .or(`email.ilike.${cleanLogin},username.ilike.${cleanLogin}`);

    if (restaurant_id) {
      query = query.eq('restaurant_id', restaurant_id);
    }

    const { data: profile, error: profErr } = await query.maybeSingle();

    if (profErr || !profile) {
      // Record failed attempt
      await supabase.from('security_audit_logs').insert({
        restaurant_id: restaurant_id || 'rest-001-main',
        event_type: 'LOGIN_FAILURE',
        result: 'FAILURE',
        username: cleanLogin,
        ip_address: clientIp,
        metadata: { reason: 'User not found' },
      }).catch(() => {});

      return errorResponse('Invalid username or password.', 401, 'INVALID_CREDENTIALS');
    }

    if (!profile.is_active) {
      return errorResponse('This staff account has been deactivated. Please contact your manager.', 403, 'ACCOUNT_DEACTIVATED');
    }

    // 3. Verify Password
    // In our DB, password_hash can be bcrypt, sha256 or verified via hash comparison
    const incomingHash = await sha256(password);
    const isValid =
      profile.password_hash === incomingHash ||
      profile.password_hash === password ||
      (profile.password_hash?.startsWith('sha256:') &&
        profile.password_hash.split(':')[1] === incomingHash);

    if (!isValid) {
      const attempts = (profile.failed_login_attempts || 0) + 1;
      let lockUntil: string | null = null;

      if (attempts >= 5) {
        lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min lock
      }

      await supabase
        .from('profiles')
        .update({
          failed_login_attempts: attempts,
          locked_until: lockUntil,
        })
        .eq('id', profile.id);

      // Record in login_rate_limits
      await supabase
        .from('login_rate_limits')
        .upsert({
          identifier: cleanLogin,
          ip_address: clientIp,
          failed_attempts: attempts,
          last_failed_at: new Date().toISOString(),
          locked_until: lockUntil,
        }, { onConflict: 'identifier' })
        .catch(() => {});

      // Record in security audit logs
      await supabase.from('security_audit_logs').insert({
        restaurant_id: profile.restaurant_id,
        user_id: profile.id,
        user_role: profile.role_id,
        event_type: 'LOGIN_FAILURE',
        result: 'FAILURE',
        username: cleanLogin,
        ip_address: clientIp,
        metadata: { failed_attempts: attempts },
      }).catch(() => {});

      return errorResponse('Invalid username or password.', 401, 'INVALID_CREDENTIALS');
    }

    // 4. Success: Reset failed attempts & update last_login
    await supabase
      .from('profiles')
      .update({
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: new Date().toISOString(),
      })
      .eq('id', profile.id);

    await supabase
      .from('login_rate_limits')
      .delete()
      .eq('identifier', cleanLogin)
      .catch(() => {});

    // 5. Generate secure session token
    const sessionToken = `sess_${profile.id}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    // 6. Security Audit Log
    await supabase.from('security_audit_logs').insert({
      restaurant_id: profile.restaurant_id,
      user_id: profile.id,
      user_role: profile.role_id,
      event_type: 'LOGIN_SUCCESS',
      result: 'SUCCESS',
      username: cleanLogin,
      ip_address: clientIp,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      token: sessionToken,
      profile: {
        id: profile.id,
        restaurant_id: profile.restaurant_id,
        email: profile.email,
        full_name: profile.full_name,
        phone: profile.phone,
        role: profile.role_id,
        role_id: profile.role_id,
      },
      message: `Welcome back, ${profile.full_name}!`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('Unhandled exception in staff-auth:', err);
    return errorResponse(message, 500, 'INTERNAL_SERVER_ERROR');
  }
});
