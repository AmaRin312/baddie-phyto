"use client";

import { useEffect } from "react";
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
  closeOnBackdrop = false,
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

  useEffect(() => {
    const clearCardDraggingState = () => {
      document
        .querySelectorAll(".bf-battle-popup-backdrop.is-card-dragging")
        .forEach((backdrop) => backdrop.classList.remove("is-card-dragging"));
    };

    document.addEventListener("dragend", clearCardDraggingState, true);
    document.addEventListener("drop", clearCardDraggingState, true);
    window.addEventListener("blur", clearCardDraggingState);

    return () => {
      document.removeEventListener("dragend", clearCardDraggingState, true);
      document.removeEventListener("drop", clearCardDraggingState, true);
      window.removeEventListener("blur", clearCardDraggingState);
    };
  }, []);

  return (
    <div
      className={`bf-battle-popup-backdrop${lightBackdrop ? " is-light" : ""}`}
      role="presentation"
      onDragStartCapture={(event) => {
        event.currentTarget.classList.add("is-card-dragging");
      }}
      onDragEndCapture={(event) => {
        event.currentTarget.classList.remove("is-card-dragging");
      }}
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
