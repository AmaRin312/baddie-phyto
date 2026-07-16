"use client";

import { useState } from "react";

type MottoToggleProps = {
  original: string;
  translated: string;
};

export function MottoToggle({ original, translated }: MottoToggleProps) {
  const [translatedMode, setTranslatedMode] = useState(false);

  return (
    <button
      type="button"
      className="motto-toggle"
      onClick={() => setTranslatedMode((current) => !current)}
      aria-label="格言の表示を切り替える"
    >
      {translatedMode ? translated : original}
    </button>
  );
}