import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export function getServiceClient() {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
    Deno.env.get('SUPABASE_SECRET_KEY') ||
    '';

  if (!url || !serviceKey) {
    throw new Error('Supabase service credentials missing from environment.');
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

export function getUserClient(authHeader?: string | null) {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const anonKey =
    Deno.env.get('SUPABASE_ANON_KEY') ||
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ||
    '';

  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });
}
