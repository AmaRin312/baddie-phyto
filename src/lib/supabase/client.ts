import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase environment variables are missing.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // The callback page exchanges the PKCE code explicitly. Disable the SDK's
    // URL auto-detection so the same one-time code cannot be exchanged twice.
    detectSessionInUrl: false
  }
});
