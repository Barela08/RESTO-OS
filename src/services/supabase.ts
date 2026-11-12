import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim();

const isValidSupabaseUrl = (value?: string): value is string => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
};

export const isLiveSupabaseConfigured = (): boolean =>
  isValidSupabaseUrl(supabaseUrl) &&
  Boolean(supabasePublishableKey) &&
  !supabasePublishableKey?.startsWith('your-') &&
  !supabasePublishableKey?.startsWith('demo-');

if (!isLiveSupabaseConfigured()) {
  throw new Error(
    'RESTO OS is not configured. Set VITE_SUPABASE_URL and ' +
    'VITE_SUPABASE_PUBLISHABLE_KEY in the deployment environment. ' +
    'Never use a Supabase service-role or secret key in the browser.'
  );
}

export const supabase = createClient(supabaseUrl!, supabasePublishableKey!, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
