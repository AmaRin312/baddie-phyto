"use client";

import { useEffect, useState } from "react";
import { CardImageInput } from "@/components/cards/CardImageInput";
import { CardViewer } from "@/components/cards/CardViewer";
import { FlagAdminForm } from "@/components/flags/FlagAdminForm";
import { AppCard } from "@/components/common/card/AppCard";
import { Button } from "@/components/common/button";
import { AppShell } from "@/components/common/layout/AppShell";
import { BackButton } from "@/components/common/navigation/BackButton";
import {
  getOrCreateProfile,
  type Profile
} from "@/lib/auth/getOrCreateProfile";
import { loadCards } from "@/lib/cards/cardActions";
import {
  loadFlag,
  setFlagActive,
  updateFlag,
  type UpdateFlagInput
} from "@/lib/flags/flagActions";
import {
  deleteCardImage,
  getPublicCardImageUrl,
  loadCardImages,
  setDefaultCardImage,
  uploadCardImage
} from "@/lib/storage/cardImageStorage";
import type {
  CardImageRecord,
  CardRecord,
  FlagWithCardRecord
} from "@/types/baddiePhyto";

type FlagEditPageProps = { params: Promise<{ flagId: string }> };

function getFlagDisplayName(flag: FlagWithCardRecord) {
  return flag.name || flag.card?.name || "名称未設定";
}

export default function FlagEditPage({ params }: FlagEditPageProps) {
  const [flagId, setFlagId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [flag, setFlag] = useState<FlagWithCardRecord | null>(null);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [images, setImages] = useState<CardImageRecord[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingImageId, setSavingImageId] = useState("");
  const [message, setMessage] = useState("");

  async function reload(nextFlagId: string) {
    const [flagResult, cardResult] = await Promise.all([
      loadFlag(nextFlagId),
      loadCards({ activeOnly: true })
    ]);

    if (flagResult.error || !flagResult.data) {
      console.error(flagResult.error);
      setMessage(flagResult.error?.message ?? "フラッグが見つかりません。");
      setFlag(null);
      return;
    }

    if (cardResult.error) {
      console.error(cardResult.error);
      setMessage(`フラッグカード候補の読み込みに失敗しました。${cardResult.error.message}`);
      setCards([]);
    } else {
      setCards(
        ((cardResult.data ?? []) as CardRecord[]).filter(
          (card) => card.card_type === "flag_card" && card.is_active
        )
      );
    }

    const nextFlag = flagResult.data as FlagWithCardRecord;
    setFlag(nextFlag);

    if (nextFlag.card_id) {
      const imageResult = await loadCardImages(nextFlag.card_id);
      if (imageResult.error) {
        console.error(imageResult.error);
        setMessage(`フラッグ画像の読み込みに失敗しました。${imageResult.error.message}`);
        setImages([]);
      } else {
        setImages(imageResult.data ?? []);
      }
    } else {
      setImages([]);
    }
  }

  useEffect(() => {
    async function loadPage() {
      const [{ flagId: resolvedFlagId }, profile] = await Promise.all([
        params,
        getOrCreateProfile()
      ]);

      if (!profile) {
        window.location.href = "/login";
        return;
      }

      setProfile(profile);
      setFlagId(resolvedFlagId);
      await reload(resolvedFlagId);
      setLoading(false);
    }
    void loadPage();
  }, [params]);

  async function handleSubmit(input: UpdateFlagInput) {
    if (!flagId) return;
    setSaving(true);
    setMessage("");
    const { error } = await updateFlag(flagId, {
      ...input,
      cardId: input.cardId || undefined
    });
    setSaving(false);

    if (error) {
      console.error(error);
      setMessage(`フラッグ更新に失敗しました。${error.message}`);
      return;
    }

    await reload(flagId);
    setMessage("フラッグを更新しました。");
  }

  async function handleDeactivate() {
    if (!flag || !window.confirm(`「${getFlagDisplayName(flag)}」を無効化しますか？`)) {
      return;
    }

    setDeleting(true);
    setMessage("");
    const { error } = await setFlagActive(flag.id, false);
    setDeleting(false);

    if (error) {
      console.error(error);
      setMessage(`フラッグの無効化に失敗しました。${error.message}`);
      return;
    }

    await reload(flag.id);
    setMessage("フラッグを無効化しました。");
  }

  async function handleUploadImage() {
    if (!profile || !flag?.card_id || !imageFile) return;

    setUploading(true);
    setMessage("");
    const { error } = await uploadCardImage({
      ownerId: profile.id,
      cardId: flag.card_id,
      file: imageFile
    });
    setUploading(false);

    if (error) {
      console.error(error);
      setMessage(`フラッグ画像のアップロードに失敗しました。${error.message}`);
      return;
    }

    setImageFile(null);
    await reload(flag.id);
    setMessage("フラッグの別イラストを登録しました。");
  }

  async function handleSetDefaultImage(image: CardImageRecord) {
    if (!flag?.card_id) return;

    setSavingImageId(image.id);
    setMessage("");
    const { error } = await setDefaultCardImage({
      cardId: flag.card_id,
      imageId: image.id
    });
    setSavingImageId("");

    if (error) {
      console.error(error);
      setMessage(`Default画像の設定に失敗しました。${error.message}`);
      return;
    }

    await reload(flag.id);
    setMessage("フラッグのDefault画像を更新しました。");
  }

  async function handleDeleteImage(image: CardImageRecord) {
    if (!flag || !window.confirm("このフラッグ画像を削除しますか？")) return;

    setSavingImageId(image.id);
    setMessage("");
    const { error } = await deleteCardImage({
      imageId: image.id,
      imagePath: image.image_path,
      thumbnailPath: image.thumbnail_path
    });
    setSavingImageId("");

    if (error) {
      console.error(error);
      setMessage(`フラッグ画像の削除に失敗しました。${error.message}`);
      return;
    }

    await reload(flag.id);
    setMessage("フラッグ画像を削除しました。");
  }
  return (
    <AppShell>
      <div className="dm-page-actions">
        <BackButton fallbackHref="/flags" />
      </div>

      {loading ? (
        <AppCard title="読み込み中" description="フラッグ情報を取得しています。" />
      ) : flag ? (
        <div className="dm-app-grid">
          <AppCard
            title="フラッグ編集"
            description="ゲーム開始フラッグの初期値と選択候補表示を編集します。"
          >
            <FlagAdminForm
              key={flag.id}
              cards={cards}
              initialFlag={flag}
              submitLabel="フラッグを更新"
              loading={saving}
              onSubmit={(input) => handleSubmit(input as UpdateFlagInput)}
            />
          </AppCard>

          <AppCard
            title="現在の設定"
            description={flag.card_id ? "cards と紐付いています。" : "card_id が未設定の既存フラッグです。"}
          >
            <div className="dm-card-text-preview">
              <b>{getFlagDisplayName(flag)}</b>
              <span>card名：{flag.card?.name ?? "未設定"}</span>
              <span>使用可能ワールド：{flag.usable_worlds.join(", ") || "-"}</span>
              <span>
                初期値：手札{flag.initial_hand} / ゲージ{flag.initial_gauge} /
                ライフ{flag.initial_life}
              </span>
              <span>
                フラッグ選択候補：
                {flag.can_be_selected_as_flag ? "表示" : "非表示"}
              </span>
              <span>状態：{flag.is_active ? "有効" : "無効"}</span>
            </div>
            {flag.is_active ? (
              <Button
                variant="danger"
                loading={deleting}
                onClick={handleDeactivate}
              >
                論理削除する
              </Button>
            ) : (
              <p className="dm-muted-text">
                このフラッグは is_active=false の無効フラッグです。
              </p>
            )}
          </AppCard>
          <AppCard
            title="フラッグ画像プレビュー"
            description="紐づく flag_card の card_images を表示します。"
          >
            {flag.card ? (
              <CardViewer card={flag.card} images={images} />
            ) : (
              <p className="dm-muted-text">
                card_id が未設定のため、画像を登録するには先にフラッグカードを紐付けてください。
              </p>
            )}
          </AppCard>

          <AppCard
            title="フラッグ別イラスト追加"
            description="手動追加もインポート追加も同じ card_images として扱います。"
          >
            <CardImageInput
              value={imageFile}
              onChange={setImageFile}
              onValidationError={setMessage}
            />
            <Button
              variant="primary"
              loading={uploading}
              disabled={!flag.card_id || !imageFile}
              onClick={handleUploadImage}
            >
              フラッグ画像をアップロード
            </Button>
          </AppCard>

          <AppCard
            title="登録済みフラッグ画像"
            description="Default画像はデッキやViewerの未選択時に優先されます。"
          >
            <div className="dm-image-grid">
              {images.map((image) => (
                <div key={image.id} className="dm-image-item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getPublicCardImageUrl(image.image_path) ?? ""}
                    alt={getFlagDisplayName(flag)}
                  />
                  <p className="dm-card-image-selected">
                    {image.is_default ? "Default画像" : "通常画像"}
                  </p>
                  <div className="dm-deck-row-actions">
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={savingImageId === image.id && !image.is_default}
                      disabled={image.is_default}
                      onClick={() => handleSetDefaultImage(image)}
                    >
                      Defaultにする
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      loading={savingImageId === image.id}
                      onClick={() => handleDeleteImage(image)}
                    >
                      削除
                    </Button>
                  </div>
                </div>
              ))}
              {images.length === 0 && (
                <p className="dm-muted-text">
                  フラッグ画像は未登録です。画像なしの場合はHTMLカード表示にフォールバックします。
                </p>
              )}
            </div>
          </AppCard>
        </div>
      ) : (
        <AppCard
          title="エラー"
          description={message || "フラッグが見つかりません。"}
        />
      )}

      {message && flag && <p className="dm-form-message">{message}</p>}
    </AppShell>
  );
}
