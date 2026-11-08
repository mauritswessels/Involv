import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { DEMO_ANON_KEY, DEMO_MODE, DEMO_STORAGE_KEY, DEMO_SUPABASE_URL } from '../demo/demoMode';
import { demoFetch, DemoSocket } from '../demo/demoBackend';

// Supabase's client expects the project URL, not the REST endpoint URL.
// Accept a copied `/rest/v1` URL as well so a harmless dashboard copy/paste
// mistake cannot produce `/rest/v1/auth/v1/...` OAuth requests.
const configuredSupabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseUrl = configuredSupabaseUrl?.replace(/\/rest\/v1\/?$/, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True when the site can talk to a backend: the real Supabase project, or the in-browser demo. */
export const isSupabaseConfigured = DEMO_MODE || Boolean(supabaseUrl && supabaseAnonKey);

// Demo mode (VITE_DEMO_MODE=true) swaps the network for an in-browser backend with
// sample data. Every service keeps calling `supabase` exactly as it does in production.
// Otherwise, public pages can be previewed before a Supabase project is connected:
// keep the client valid so features appear automatically when the env vars are added.
export const supabase = DEMO_MODE
  ? createClient<Database>(DEMO_SUPABASE_URL, DEMO_ANON_KEY, {
      global: { fetch: demoFetch },
      auth: { storageKey: DEMO_STORAGE_KEY, detectSessionInUrl: false },
      realtime: { transport: DemoSocket as unknown as typeof WebSocket },
    })
  : createClient<Database>(
      supabaseUrl || 'https://preview-placeholder.supabase.co',
      supabaseAnonKey || 'preview-placeholder-anon-key',
    );
