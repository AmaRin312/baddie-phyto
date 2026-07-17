"use client";

import { useEffect, useState } from "react";
import { CardAdminForm } from "@/components/cards/CardAdminForm";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { BackButton } from "@/components/common/navigation/BackButton";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { createCard, type CreateCardInput } from "@/lib/cards/cardActions";

export default function NewCardPage() {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void getOrCreateProfile().then((profile) => {
      if (!profile) window.location.href = "/login";
    });
  }, []);

  async function handleSubmit(input: CreateCardInput) {
    setSaving(true);
    setMessage("");
    const { error } = await createCard(input);
    setSaving(false);

    if (error) {
      console.error(error);
      setMessage(`カード登録に失敗しました。${error.message}`);
      return;
    }

    window.location.href = "/cards";
  }

  return (
    <AppShell kicker="NEW CARD" title="カード新規登録">
      <div className="dm-page-actions">
        <BackButton fallbackHref="/cards" />
      </div>
      <AppCard
        title="カード情報"
        description="画像なしで cards テーブルへカード情報を登録します。worlds と races はカンマ区切りで入力してください。"
      >
        <CardAdminForm
          submitLabel="カードを登録"
          loading={saving}
          onSubmit={handleSubmit}
        />
        {message && <p className="dm-form-message">{message}</p>}
      </AppCard>
    </AppShell>
  );
}
