import { createClient } from '@supabase/supabase-js';

const supabaseUrl: string =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string) ||
  '';

const supabaseAnonKey: string =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string) ||
  '';

export const isLiveSupabaseConfigured = (): boolean => {
  return (
    !!supabaseUrl &&
    !supabaseUrl.includes('your-project') &&
    !supabaseUrl.includes('demo-resto-os') &&
    !!supabaseAnonKey &&
    !supabaseAnonKey.includes('your-anon-key') &&
    !supabaseAnonKey.includes('demo-anon-key')
  );
};

export const getSupabaseConfig = () => ({
  url: supabaseUrl,
  hasAnonKey: !!supabaseAnonKey,
  isLive: isLiveSupabaseConfigured(),
});

export const supabase = createClient(
  supabaseUrl || 'https://mklcrcyubohgfosgxmrm.supabase.co',
  supabaseAnonKey || 'sb_publishable_7lji58Dx7rNxfkuAi4Diew_RZk-8Yn6',
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
