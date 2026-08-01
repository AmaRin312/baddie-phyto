"use client";

import { useEffect, useState } from "react";
import { CardAdminForm } from "@/components/cards/CardAdminForm";
import { CardImageInput } from "@/components/cards/CardImageInput";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { BackButton } from "@/components/common/navigation/BackButton";
import {
  getOrCreateProfile,
  type Profile
} from "@/lib/auth/getOrCreateProfile";
import { createCard, type CreateCardInput } from "@/lib/cards/cardActions";
import { uploadCardImage } from "@/lib/storage/cardImageStorage";

export default function NewCardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void getOrCreateProfile().then((nextProfile) => {
      if (!nextProfile) {
        window.location.href = "/login";
        return;
      }
      setProfile(nextProfile);
    });
  }, []);

  async function handleSubmit(input: CreateCardInput) {
    if (!profile) {
      setMessage("ログインが必要です。");
      return;
    }

    setSaving(true);
    setMessage("");
    const result = await createCard(input);

    if (result.error || !result.data) {
      console.error(result.error);
      setMessage(`カード登録に失敗しました。${result.error?.message ?? ""}`);
      setSaving(false);
      return;
    }

    if (imageFile) {
      const imageResult = await uploadCardImage({
        ownerId: profile.id,
        cardId: result.data.id,
        file: imageFile
      });

      if (imageResult.error) {
        console.error(imageResult.error);
        setMessage(
          `カードは登録しましたが、画像アップロードに失敗しました。${imageResult.error.message}`
        );
        setSaving(false);
        window.location.href = `/cards/${result.data.id}`;
        return;
      }
    }

    setSaving(false);
    window.location.href = `/cards/${result.data.id}`;
  }

  return (
    <AppShell>
      <div className="dm-page-actions">
        <BackButton fallbackHref="/cards" />
      </div>
      <div className="dm-app-grid">
        <AppCard
          title="カード情報"
          description="カード情報を登録します。ワールドと種族はカンマ区切りで入力してください。"
        >
          <CardAdminForm
            submitLabel="カードを登録"
            loading={saving}
            onSubmit={handleSubmit}
          />
          {message && <p className="dm-form-message">{message}</p>}
        </AppCard>

        <AppCard
          title="カード画像"
          description="任意です。画像をドラッグ&ドロップすると、カード登録後に同時アップロードします。"
        >
          <CardImageInput
            value={imageFile}
            onChange={setImageFile}
            onValidationError={setMessage}
          />
        </AppCard>
      </div>
    </AppShell>
  );
}
