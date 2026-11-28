import { supabase } from "@/lib/supabase/client";

export const SITE_UPDATE_NOTICE_DURATION_MS = 3 * 60 * 60 * 1000;

export type SiteUpdateAnnouncement = {
  announcement_id: string | null;
  announced_at: string | null;
};

const announcementColumns = "announcement_id, announced_at";
const announcementCacheKey = "site-update-announcement-cache-v1";
const announcementCacheTtlMs = 60_000;

type CachedAnnouncement = {
  data: SiteUpdateAnnouncement;
  savedAt: number;
};

let announcementRequest: ReturnType<typeof fetchAnnouncementFromSupabase> | null = null;

function readCachedAnnouncement(): CachedAnnouncement | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(announcementCacheKey);
    if (!value) return null;
    const parsed = JSON.parse(value) as CachedAnnouncement;
    return parsed?.data && typeof parsed.savedAt === "number" ? parsed : null;
  } catch {
    return null;
  }
}

function cacheAnnouncement(data: SiteUpdateAnnouncement) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      announcementCacheKey,
      JSON.stringify({ data, savedAt: Date.now() } satisfies CachedAnnouncement)
    );
  } catch {
    // Storage can be unavailable in private browsing or when full.
  }
}

async function fetchAnnouncementFromSupabase() {
  const result = await supabase
    .from("site_update_announcements")
    .select(announcementColumns)
    .eq("id", true)
    .maybeSingle<SiteUpdateAnnouncement>();
  if (!result.error && result.data) cacheAnnouncement(result.data);
  return result;
}

export async function loadSiteUpdateAnnouncement() {
  const cached = readCachedAnnouncement();
  if (cached && Date.now() - cached.savedAt < announcementCacheTtlMs) {
    return { data: cached.data, error: null };
  }

  if (!announcementRequest) {
    announcementRequest = fetchAnnouncementFromSupabase().finally(() => {
      announcementRequest = null;
    });
  }
  const result = await announcementRequest;

  return result;
}

export async function announceSiteUpdate() {
  const now = new Date().toISOString();
  const result = await supabase
    .from("site_update_announcements")
    .update({ announcement_id: crypto.randomUUID(), announced_at: now, updated_at: now })
    .eq("id", true)
    .select(announcementColumns)
    .single<SiteUpdateAnnouncement>();
  if (!result.error && result.data) cacheAnnouncement(result.data);
  return result;
}

export async function endSiteUpdateAnnouncement() {
  const result = await supabase
    .from("site_update_announcements")
    .update({ announcement_id: null, announced_at: null, updated_at: new Date().toISOString() })
    .eq("id", true)
    .select(announcementColumns)
    .single<SiteUpdateAnnouncement>();
  if (!result.error && result.data) cacheAnnouncement(result.data);
  return result;
}
