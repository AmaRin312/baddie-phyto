import { supabase } from "@/lib/supabase/client";

export type Profile = {
  id: string;
  email: string | null;
  nickname: string | null;
  created_at: string;
  updated_at: string;
};

export async function getOrCreateProfile(): Promise<Profile | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }

  if (data) return data as Profile;

  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: userData.user.id,
      email: userData.user.email ?? null,
      nickname: null
    })
    .select("*")
    .single();

  if (insertError) {
    console.error(insertError);
    return null;
  }

  return inserted as Profile;
}
