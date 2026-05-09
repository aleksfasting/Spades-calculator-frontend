import { createClient } from '@supabase/supabase-js';

export function isSupabaseConfigured(): boolean {
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim();
  const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  return url !== '' && key !== '';
}

export const supabase = createClient(
  String(import.meta.env.VITE_SUPABASE_URL ?? '').trim(),
  String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim(),
);
