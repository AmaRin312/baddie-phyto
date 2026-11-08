import { supabase } from "@/lib/supabase/client";

export const SITE_UPDATE_NOTICE_DURATION_MS = 3 * 60 * 60 * 1000;

export type SiteUpdateAnnouncement = {
  announcement_id: string | null;
  announced_at: string | null;
};

const announcementColumns = "announcement_id, announced_at";

export async function loadSiteUpdateAnnouncement() {
  return supabase
    .from("site_update_announcements")
    .select(announcementColumns)
    .eq("id", true)
    .maybeSingle<SiteUpdateAnnouncement>();
}

export async function announceSiteUpdate() {
  const now = new Date().toISOString();
  return supabase
    .from("site_update_announcements")
    .update({ announcement_id: crypto.randomUUID(), announced_at: now, updated_at: now })
    .eq("id", true)
    .select(announcementColumns)
    .single<SiteUpdateAnnouncement>();
}

export async function endSiteUpdateAnnouncement() {
  return supabase
    .from("site_update_announcements")
    .update({ announcement_id: null, announced_at: null, updated_at: new Date().toISOString() })
    .eq("id", true)
    .select(announcementColumns)
    .single<SiteUpdateAnnouncement>();
}
