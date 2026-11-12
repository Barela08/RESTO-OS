import { createClient } from '@supabase/supabase-js';

const supabaseUrl: string =
  (import.meta.env?.VITE_SUPABASE_URL as string)?.trim() ||
  (import.meta.env?.NEXT_PUBLIC_SUPABASE_URL as string)?.trim() ||
  'https://mklcrcyubohgfosgxmrm.supabase.co';

const supabaseAnonKey: string =
  (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string)?.trim() ||
  (import.meta.env?.VITE_SUPABASE_ANON_KEY as string)?.trim() ||
  (import.meta.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string)?.trim() ||
  (import.meta.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY as string)?.trim() ||
  'sb_publishable_7lji58Dx7rNxfkuAi4Diew_RZk-8Yn6';

export const isValidSupabaseUrl = (value?: string): value is string => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
};

export const isLiveSupabaseConfigured = (): boolean => {
  return (
    isValidSupabaseUrl(supabaseUrl) &&
    !supabaseUrl.includes('your-project') &&
    !supabaseUrl.includes('demo-resto-os') &&
    Boolean(supabaseAnonKey) &&
    !supabaseAnonKey.startsWith('your-') &&
    !supabaseAnonKey.startsWith('demo-')
  );
};

export const getSupabaseConfig = () => ({
  url: supabaseUrl,
  hasAnonKey: Boolean(supabaseAnonKey),
  isLive: isLiveSupabaseConfigured(),
});

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 15,
      },
    },
  }
);
