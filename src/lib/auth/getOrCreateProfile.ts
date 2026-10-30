import { supabase } from "@/lib/supabase/client";

export type Profile = {
  id: string;
  email: string | null;
  nickname: string | null;
  created_at: string;
  updated_at: string;
};

const PROFILE_CACHE_TTL_MS = 60_000;

let cachedProfile: Profile | null = null;
let cachedProfileAt = 0;
let inFlightProfilePromise: Promise<Profile | null> | null = null;

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
  if (cachedProfile && Date.now() - cachedProfileAt < PROFILE_CACHE_TTL_MS) {
    return cachedProfile;
  }

  if (inFlightProfilePromise) {
    return inFlightProfilePromise;
  }

  inFlightProfilePromise = (async () => {
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
    cachedProfile = fallbackProfile;
    cachedProfileAt = Date.now();
    return fallbackProfile;
  }

  if (data) {
    cachedProfile = data as Profile;
    cachedProfileAt = Date.now();
    return data as Profile;
  }

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
    cachedProfile = fallbackProfile;
    cachedProfileAt = Date.now();
    return fallbackProfile;
  }

  cachedProfile = inserted as Profile;
  cachedProfileAt = Date.now();
  return inserted as Profile;
  })();

  try {
    return await inFlightProfilePromise;
  } finally {
    inFlightProfilePromise = null;
  }
}
