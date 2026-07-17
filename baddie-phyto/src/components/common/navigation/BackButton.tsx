"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/common/button";

type BackButtonProps = {
  fallbackHref: string;
};

export function BackButton({ fallbackHref }: BackButtonProps) {
  const router = useRouter();

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <Button variant="secondary" onClick={handleBack}>
      戻る
    </Button>
  );
}
