import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Supabase's client expects the project URL, not the REST endpoint URL.
// Accept a copied `/rest/v1` URL as well so a harmless dashboard copy/paste
// mistake cannot produce `/rest/v1/auth/v1/...` OAuth requests.
const configuredSupabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseUrl = configuredSupabaseUrl?.replace(/\/rest\/v1\/?$/, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// The public pages can be previewed with the bundled mock data before a
// Supabase project is connected. Keep the client valid so authenticated
// features become available automatically when the env vars are added.
export const supabase = createClient<Database>(
  supabaseUrl || 'https://preview-placeholder.supabase.co',
  supabaseAnonKey || 'preview-placeholder-anon-key',
);
