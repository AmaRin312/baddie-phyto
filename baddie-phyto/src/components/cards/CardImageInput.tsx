"use client";

import { useId, useState, type ChangeEvent, type DragEvent } from "react";

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp"
]);

type CardImageInputProps = {
  value: File | null;
  onChange: (file: File | null) => void;
  onValidationError: (message: string) => void;
};

export function CardImageInput({
  value,
  onChange,
  onValidationError
}: CardImageInputProps) {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);

  function selectFile(file: File | null) {
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      onValidationError("PNG、JPEG、WebP形式の画像を選択してください。");
      return;
    }

    onValidationError("");
    onChange(file);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0] ?? null);
  }

  return (
    <div className="dm-card-image-input">
      <span className="dm-card-image-input-label">カード画像</span>
      <label
        htmlFor={inputId}
        className={`dm-card-image-drop-zone${isDragging ? " is-dragging" : ""}`}
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
        />
        <strong>画像をドラッグ＆ドロップ</strong>
        <span>またはクリックしてファイルを選択</span>
        <small>PNG / JPEG / WebP</small>
      </label>

      {value && (
        <p className="dm-card-image-selected" aria-live="polite">
          選択中：{value.name}
        </p>
      )}
    </div>
  );
}
