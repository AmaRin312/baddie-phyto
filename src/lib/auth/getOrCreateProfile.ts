import { supabase } from "@/lib/supabase/client";

export type Profile = {
  id: string;
  email: string | null;
  nickname: string | null;
  created_at: string;
  updated_at: string;
};

function buildFallbackProfile(user: {
  id: string;
  email?: string | null;
  created_at?: string;
  updated_at?: string;
}): Profile {
  const timestamp = new Date().toISOString();

  return {
    id: user.id,
    email: user.email ?? null,
    nickname: null,
    created_at: user.created_at ?? timestamp,
    updated_at: user.updated_at ?? user.created_at ?? timestamp
  };
}

export async function getOrCreateProfile(): Promise<Profile | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (error) {
    console.warn("profiles select failed; falling back to auth user", error);
    return buildFallbackProfile(userData.user);
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
    console.warn("profiles insert failed; falling back to auth user", insertError);
    return buildFallbackProfile(userData.user);
  }

  return inserted as Profile;
}
