"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";

type BattlePopupProps = {
  title?: string;
  description?: string;
  size?: "small" | "medium" | "large" | "fullscreen";
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  lightBackdrop?: boolean;
};

export function BattlePopup({
  title,
  description,
  size = "medium",
  closeOnEscape = true,
  closeOnBackdrop = true,
  onClose,
  children,
  footer,
  className,
  contentClassName,
  style,
  ariaLabel,
  lightBackdrop = false
}: BattlePopupProps) {
  useEscapeToClose({
    enabled: closeOnEscape,
    onClose
  });

  return (
    <div
      className={`bf-battle-popup-backdrop${lightBackdrop ? " is-light" : ""}`}
      role="presentation"
      onClick={() => {
        if (closeOnBackdrop) {
          onClose();
        }
      }}
    >
      <section
        className={`bf-battle-popup bf-battle-popup-${size}${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        style={style}
        onClick={(event) => event.stopPropagation()}
      >
        {(title || description) && (
          <header className="bf-battle-popup-header">
            <div>
              {title && <h2>{title}</h2>}
              {description && <p>{description}</p>}
            </div>
            <button type="button" onClick={onClose}>
              閉じる
            </button>
          </header>
        )}
        <div
          className={`bf-battle-popup-content${contentClassName ? ` ${contentClassName}` : ""}`}
        >
          {children}
        </div>
        {footer && <footer className="bf-battle-popup-footer">{footer}</footer>}
      </section>
    </div>
  );
}
