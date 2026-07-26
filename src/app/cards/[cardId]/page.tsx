"use client";

import { useEffect, useState } from "react";
import { CardAbilityEditor } from "@/components/cards/CardAbilityEditor";
import { CardAdminForm } from "@/components/cards/CardAdminForm";
import { CardImageInput } from "@/components/cards/CardImageInput";
import { CardViewer } from "@/components/cards/CardViewer";
import { AppCard } from "@/components/common/card/AppCard";
import { Button } from "@/components/common/button";
import { AppShell } from "@/components/common/layout/AppShell";
import { BackButton } from "@/components/common/navigation/BackButton";
import {
  getOrCreateProfile,
  type Profile
} from "@/lib/auth/getOrCreateProfile";
import {
  deleteCard,
  loadCard,
  setCardActive,
  updateCard,
  type CreateCardInput
} from "@/lib/cards/cardActions";
import {
  deleteCardImage,
  getPublicCardImageUrl,
  loadCardImages,
  setDefaultCardImage,
  uploadCardImage
} from "@/lib/storage/cardImageStorage";
import {
  getCardTypeLabel,
  type CardImageRecord,
  type CardRecord
} from "@/types/baddiePhyto";

type CardEditPageProps = { params: Promise<{ cardId: string }> };

export default function CardEditPage({ params }: CardEditPageProps) {
  const [cardId, setCardId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [card, setCard] = useState<CardRecord | null>(null);
  const [images, setImages] = useState<CardImageRecord[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingImageId, setSavingImageId] = useState("");
  const [changingActive, setChangingActive] = useState(false);
  const [deletingCard, setDeletingCard] = useState(false);
  const [message, setMessage] = useState("");

  async function reload(nextCardId: string) {
    const [cardResult, imageResult] = await Promise.all([
      loadCard(nextCardId),
      loadCardImages(nextCardId)
    ]);

    if (cardResult.error || imageResult.error || !cardResult.data) {
      console.error(cardResult.error ?? imageResult.error);
      setMessage(
        cardResult.error?.message ??
          imageResult.error?.message ??
          "カードが見つかりません。"
      );
      setCard(null);
      return;
    }
    setCard(cardResult.data as CardRecord);
    setImages(imageResult.data ?? []);
  }

  useEffect(() => {
    async function loadPage() {
      const [{ cardId: resolvedCardId }, nextProfile] = await Promise.all([
        params,
        getOrCreateProfile()
      ]);

      if (!nextProfile) {
        window.location.href = "/login";
        return;
      }

      setProfile(nextProfile);
      setCardId(resolvedCardId);
      await reload(resolvedCardId);
      setLoading(false);
    }
    void loadPage();
  }, [params]);

  async function handleSubmit(input: CreateCardInput) {
    if (!cardId) return;
    setSaving(true);
    setMessage("");
    const { error } = await updateCard(cardId, input);
    setSaving(false);

    if (error) {
      console.error(error);
      setMessage(`カード更新に失敗しました。${error.message}`);
      return;
    }

    await reload(cardId);
    setMessage("カードを更新しました。");
  }

  async function handleSetActive(nextActive: boolean) {
    if (!card) return;
    const actionLabel = nextActive ? "有効化" : "無効化";
    if (!window.confirm(`「${card.name}」を${actionLabel}しますか？`)) return;

    setChangingActive(true);
    setMessage("");
    const { error } = await setCardActive(card.id, nextActive);
    setChangingActive(false);

    if (error) {
      console.error(error);
      setMessage(`カードの${actionLabel}に失敗しました。${error.message}`);
      return;
    }

    await reload(card.id);
    setMessage(`カードを${actionLabel}しました。`);
  }

  async function handleDeleteCard() {
    if (!card) return;
    if (
      !window.confirm(
        `「${card.name}」を物理削除しますか？\nデッキや収録情報などで参照されている場合は削除できません。`
      )
    ) {
      return;
    }

    setDeletingCard(true);
    setMessage("");
    const { error } = await deleteCard(card.id);
    setDeletingCard(false);

    if (error) {
      console.error(error);
      setMessage(
        `カード削除に失敗しました。デッキ・フラッグ・収録情報などで使用中の可能性があります。${error.message}`
      );
      return;
    }

    await Promise.all(
      images.map((image) =>
        deleteCardImage({
          imageId: image.id,
          imagePath: image.image_path,
          thumbnailPath: image.thumbnail_path
        })
      )
    );
    window.location.href = "/cards";
  }

  async function handleUploadImage() {
    if (!profile || !card || !imageFile) return;

    setUploading(true);
    setMessage("");
    const { error } = await uploadCardImage({
      ownerId: profile.id,
      cardId: card.id,
      file: imageFile
    });
    setUploading(false);

    if (error) {
      console.error(error);
      setMessage(`画像アップロードに失敗しました。${error.message}`);
      return;
    }

    setImageFile(null);
    await reload(card.id);
    setMessage("画像を登録しました。");
  }

  async function handleSetDefaultImage(image: CardImageRecord) {
    if (!card) return;

    setSavingImageId(image.id);
    setMessage("");
    const { error } = await setDefaultCardImage({
      cardId: card.id,
      imageId: image.id
    });
    setSavingImageId("");

    if (error) {
      console.error(error);
      setMessage(`Default画像の設定に失敗しました。${error.message}`);
      return;
    }

    await reload(card.id);
    setMessage("Default画像を更新しました。");
  }

  async function handleDeleteImage(image: CardImageRecord) {
    if (!card || !window.confirm("この画像を削除しますか？")) return;

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
      setMessage(`画像削除に失敗しました。${error.message}`);
      return;
    }

    await reload(card.id);
    setMessage("画像を削除しました。");
  }

  return (
    <AppShell kicker="EDIT CARD" title={card?.name ?? "カード編集"}>
      <div className="dm-page-actions">
        <BackButton fallbackHref="/cards" />
      </div>

      {loading ? (
        <AppCard title="読み込み中" description="カード情報を取得しています。" />
      ) : card ? (
        <div className="dm-app-grid">
          <AppCard
            title="カード編集"
            description={`${getCardTypeLabel(card.card_type)} / ${
              card.is_active ? "有効" : "無効"
            }`}
          >
            <CardAdminForm
              key={`${card.id}:${card.updated_at}:${card.is_active}`}
              initialCard={card}
              submitLabel="カードを更新"
              loading={saving}
              onSubmit={handleSubmit}
            />
          </AppCard>

          <AppCard
            title="カード表示プレビュー"
            description="Default画像があれば画像表示、画像がなければHTMLカード表示になります。"
          >
            <CardViewer card={card} images={images} />
            <div className="dm-dialog-actions">
              <Button
                variant={card.is_active ? "danger" : "secondary"}
                loading={changingActive}
                onClick={() => handleSetActive(!card.is_active)}
              >
                {card.is_active ? "カードを無効化" : "カードを有効化"}
              </Button>
              <Button
                variant="danger"
                loading={deletingCard}
                onClick={handleDeleteCard}
              >
                カードを削除
              </Button>
            </div>
          </AppCard>

          <AppCard
            title="画像アップロード"
            description="カード画像をStorageへアップロードし、card_imagesへ登録します。"
          >
            <CardImageInput
              value={imageFile}
              onChange={setImageFile}
              onValidationError={setMessage}
            />
            <Button
              variant="primary"
              loading={uploading}
              disabled={!imageFile}
              onClick={handleUploadImage}
            >
              画像をアップロード
            </Button>
          </AppCard>

          <AppCard
            title="Ability紐付け"
            description="カードにAbilityを紐付けます。"
          >
            <CardAbilityEditor cardId={card.id} />
          </AppCard>

          <AppCard
            title="登録画像"
            description="1カードにつきDefault画像は1枚だけです。"
          >
            <div className="dm-image-grid">
              {images.map((image) => (
                <div key={image.id} className="dm-image-item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getPublicCardImageUrl(image.image_path) ?? ""}
                    alt={card.name}
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
                  画像は未登録です。Viewerや盤面ではHTMLカード表示にフォールバックします。
                </p>
              )}
            </div>
          </AppCard>
        </div>
      ) : (
        <AppCard
          title="エラー"
          description={message || "カードが見つかりません。"}
        />
      )}

      {message && card && <p className="dm-form-message">{message}</p>}
    </AppShell>
  );
}
