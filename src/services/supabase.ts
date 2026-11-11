import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://demo-resto-os.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'demo-anon-key-resto-os-production-ready';

export const isLiveSupabaseConfigured = () => {
  return (
    supabaseUrl &&
    !supabaseUrl.includes('your-project') &&
    !supabaseUrl.includes('demo-resto-os') &&
    supabaseAnonKey &&
    !supabaseAnonKey.includes('your-anon-key') &&
    !supabaseAnonKey.includes('demo-anon-key')
  );
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
