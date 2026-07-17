"use client";

import { useEffect } from "react";

type UseEscapeToCloseInput = {
  enabled?: boolean;
  onClose: () => void;
};

export function useEscapeToClose({
  enabled = true,
  onClose
}: UseEscapeToCloseInput) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [enabled, onClose]);
}
