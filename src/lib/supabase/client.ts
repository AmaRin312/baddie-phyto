import { createClient } from "@supabase/supabase-js";
import { createResilientFetch } from "./resilientFetch";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase environment variables are missing.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: createResilientFetch() },
  auth: {
    // Let Supabase handle both PKCE codes and implicit-flow tokens returned by
    // OAuth providers before the callback page checks for an active session.
    detectSessionInUrl: true
  }
});
