import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Next.js only inlines NEXT_PUBLIC_* variables when they are referenced literally.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isConfigured = Boolean(url && key && !url.includes("your-project"));

export const supabase: SupabaseClient | null = isConfigured
  ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export const BUCKET = "attachments";
