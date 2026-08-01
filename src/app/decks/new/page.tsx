"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/common/card/AppCard";
import { Button } from "@/components/common/button";
import { AppShell } from "@/components/common/layout/AppShell";
import { BackButton } from "@/components/common/navigation/BackButton";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { createDraftDeck } from "@/lib/decks/deckActions";

export default function NewDeckPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function checkLogin() {
      if (!(await getOrCreateProfile())) {
        router.replace("/login");
      }
    }
    void checkLogin();
  }, [router]);

  async function handleStartDeckCreation() {
    setCreating(true);
    setMessage("");

    const { data, error } = await createDraftDeck();
    if (error || !data) {
      console.error(error);
      setMessage(
        "デッキ作成を開始できませんでした。ログイン状態、またはdecks.flag_id / buddy_card_idのNULL許可SQLを確認してください。"
      );
      setCreating(false);
      return;
    }

    router.replace(`/decks/${data.id}`);
  }

  return (
    <AppShell>
      <div className="dm-page-actions">
        <BackButton fallbackHref="/decks" />
      </div>

      <AppCard
        title="デッキ作成を開始"
        description="デッキ名・フラッグ・バディが未定でも、先に編集画面へ進めます。設定は編集画面で保存してください。"
      >
        <Button
          type="button"
          variant="primary"
          loading={creating}
          onClick={handleStartDeckCreation}
          fullWidth
        >
          デッキ作成画面へ進む
        </Button>
        {message && <p className="dm-form-message">{message}</p>}
      </AppCard>
    </AppShell>
  );
}
