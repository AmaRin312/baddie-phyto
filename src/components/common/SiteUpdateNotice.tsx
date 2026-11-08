"use client";

import { useEffect, useState } from "react";
import {
  loadSiteUpdateAnnouncement,
  SITE_UPDATE_NOTICE_DURATION_MS
} from "@/lib/siteUpdates";

const DISMISSED_ANNOUNCEMENT_KEY = "site-update-dismissed-id";

export function SiteUpdateNotice() {
  const [announcement, setAnnouncement] = useState<{
    id: string;
    expiresAt: number;
  } | null>(null);

  useEffect(() => {
    let active = true;
    let checking = false;
    async function checkForAnnouncement() {
      if (checking || document.visibilityState === "hidden") return;
      checking = true;
      try {
        const { data, error } = await loadSiteUpdateAnnouncement();
        if (!active || error) return;
        const id = data?.announcement_id;
        const announcedAt = data?.announced_at;
        const expiresAt = announcedAt
          ? Date.parse(announcedAt) + SITE_UPDATE_NOTICE_DURATION_MS
          : 0;
        setAnnouncement(
          id && expiresAt > Date.now() &&
          sessionStorage.getItem(DISMISSED_ANNOUNCEMENT_KEY) !== id
            ? { id, expiresAt }
            : null
        );
      } catch {
        // A transient network failure should not interrupt the current page.
      } finally {
        checking = false;
      }
    }

    void checkForAnnouncement();
    const timer = window.setInterval(() => void checkForAnnouncement(), 60_000);
    window.addEventListener("focus", checkForAnnouncement);
    document.addEventListener("visibilitychange", checkForAnnouncement);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", checkForAnnouncement);
      document.removeEventListener("visibilitychange", checkForAnnouncement);
    };
  }, []);

  useEffect(() => {
    if (!announcement) return;
    const timer = window.setTimeout(
      () => setAnnouncement(null),
      Math.max(0, announcement.expiresAt - Date.now())
    );
    return () => window.clearTimeout(timer);
  }, [announcement]);

  if (!announcement) return null;

  function dismiss() {
    if (!announcement) return;
    sessionStorage.setItem(DISMISSED_ANNOUNCEMENT_KEY, announcement.id);
    setAnnouncement(null);
  }

  return (
    <div className="dm-site-update-notice" role="dialog" aria-label="サイトの更新">
      <strong>サイトに新しい修正があります</strong>
      <p>受け入れるとページを更新します。未保存の入力は失われる場合があります。</p>
      <div>
        <button type="button" onClick={() => {
          dismiss();
          window.location.reload();
        }}>
          受け入れる
        </button>
        <button type="button" onClick={dismiss}>今は受け入れない</button>
      </div>
    </div>
  );
}
