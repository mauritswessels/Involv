import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// The public pages can be previewed with the bundled mock data before a
// Supabase project is connected. Keep the client valid so authenticated
// features become available automatically when the env vars are added.
export const supabase = createClient<Database>(
  supabaseUrl || 'https://preview-placeholder.supabase.co',
  supabaseAnonKey || 'preview-placeholder-anon-key',
);
