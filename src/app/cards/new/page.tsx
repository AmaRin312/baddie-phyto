"use client";

import { useEffect, useState } from "react";
import { CardAdminForm } from "@/components/cards/CardAdminForm";
import { CardImageInput } from "@/components/cards/CardImageInput";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { BackButton } from "@/components/common/navigation/BackButton";
import { Button } from "@/components/common/button";
import {
  getOrCreateProfile,
  type Profile
} from "@/lib/auth/getOrCreateProfile";
import { createCard, type CreateCardInput } from "@/lib/cards/cardActions";
import { addCardAbilityLink, createAbility } from "@/lib/cards/cardAbilityActions";
import { uploadCardImage } from "@/lib/storage/cardImageStorage";

export default function NewCardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [abilityName, setAbilityName] = useState("");
  const [abilityBehaviorKey, setAbilityBehaviorKey] = useState("");
  const [abilityDescription, setAbilityDescription] = useState("");
  const [createdCardId, setCreatedCardId] = useState("");

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

    const nextAbilityName = abilityName.trim();
    if (nextAbilityName) {
      const abilityResult = await createAbility({
        name: nextAbilityName,
        behaviorKey: abilityBehaviorKey,
        description: abilityDescription
      });
      if (abilityResult.error || !abilityResult.data) {
        console.error(abilityResult.error);
        setSaving(false);
        setCreatedCardId(result.data.id);
        setMessage(`カードは登録しましたが、Ability登録に失敗しました。${abilityResult.error?.message ?? "登録結果を取得できませんでした。"}`);
        return;
      }

      const linkResult = await addCardAbilityLink({
        cardId: result.data.id,
        abilityId: abilityResult.data.id
      });
      if (linkResult.error) {
        console.error(linkResult.error);
        setSaving(false);
        setCreatedCardId(result.data.id);
        setMessage(`カードとAbilityは登録しましたが、紐付けに失敗しました。${linkResult.error.message}`);
        return;
      }
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
          {!createdCardId && (
            <CardAdminForm
              submitLabel="カードを登録"
              loading={saving}
              onSubmit={handleSubmit}
            />
          )}
          {!createdCardId && profile?.is_admin && (
            <section className="dm-form-stack">
              <h3>Ability（任意）</h3>
              <p className="dm-muted-text">Ability名を入力すると、カード登録後にAbilityを新規登録してこのカードへ紐付けます。behavior_keyは任意です。</p>
              <label className="dm-form-field">
                <span>Ability名</span>
                <input
                  value={abilityName}
                  onChange={(event) => setAbilityName(event.target.value)}
                  maxLength={120}
                  placeholder="Ability名を入力"
                />
              </label>
              <label className="dm-form-field">
                <span>behavior_key（任意）</span>
                <input
                  value={abilityBehaviorKey}
                  onChange={(event) => setAbilityBehaviorKey(event.target.value)}
                  maxLength={120}
                  placeholder="ゲーム処理と連携する場合に入力"
                />
              </label>
              <label className="dm-form-field">
                <span>説明（任意）</span>
                <textarea
                  value={abilityDescription}
                  onChange={(event) => setAbilityDescription(event.target.value)}
                  rows={3}
                  maxLength={2000}
                />
              </label>
            </section>
          )}
          {message && <p className="dm-form-message">{message}</p>}
          {createdCardId && (
            <Button variant="primary" onClick={() => { window.location.href = `/cards/${createdCardId}`; }}>
              登録したカードを開く
            </Button>
          )}
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
