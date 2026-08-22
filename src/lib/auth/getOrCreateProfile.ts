import { supabase } from "@/lib/supabase/client";

export type Profile = {
  id: string;
  email: string | null;
  nickname: string | null;
  created_at: string;
  updated_at: string;
};

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAuthenticatedUser() {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (!userError && userData.user) {
      return { user: userData.user, error: null };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user) {
      return { user: sessionData.session.user, error: null };
    }

    if (attempt < 3) {
      await wait(250 * (attempt + 1));
    }
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  return { user: userData.user ?? null, error: userError ?? null };
}

export async function getOrCreateProfile(): Promise<Profile | null> {
  const { user, error: userError } = await getAuthenticatedUser();
  if (userError || !user) return null;

  const fallbackProfile: Profile = {
    id: user.id,
    email: user.email ?? null,
    nickname: null,
    created_at: user.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.warn("profiles read failed; using auth user as fallback profile.", error);
    return fallbackProfile;
  }

  if (data) return data as Profile;

  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email ?? null,
      nickname: null
    })
    .select("*")
    .single();

  if (insertError) {
    console.warn(
      "profiles insert failed; using auth user as fallback profile.",
      insertError
    );
    return fallbackProfile;
  }

  return inserted as Profile;
}
