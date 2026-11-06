"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/common/button";

type BackButtonProps = {
  fallbackHref: string;
  fullWidth?: boolean;
};

export function BackButton({ fallbackHref, fullWidth = false }: BackButtonProps) {
  const router = useRouter();

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <Button variant="secondary" onClick={handleBack} fullWidth={fullWidth}>
      戻る
    </Button>
  );
}
