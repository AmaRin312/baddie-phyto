"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent, ReactNode } from "react";
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
  const popupRef = useRef<HTMLElement | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [moving, setMoving] = useState(false);
  const moveRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    rect: DOMRect;
  } | null>(null);

  function startMove(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0 || !event.isPrimary || !popupRef.current) return;
    if ((event.target as Element).closest("button, a, input, select, textarea, [role='button']")) return;
    event.preventDefault();
    event.stopPropagation();
    moveRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
      rect: popupRef.current.getBoundingClientRect()
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setMoving(true);
  }

  function movePopup(event: PointerEvent<HTMLElement>) {
    const move = moveRef.current;
    if (!move || move.pointerId !== event.pointerId) return;
    const minX = 8 - move.rect.left;
    const maxX = Math.max(minX, window.innerWidth - move.rect.right - 8);
    const minY = 8 - move.rect.top;
    const maxY = Math.max(minY, window.innerHeight - move.rect.bottom - 8);
    setOffset({
      x: move.offsetX + Math.max(minX, Math.min(maxX, event.clientX - move.startX)),
      y: move.offsetY + Math.max(minY, Math.min(maxY, event.clientY - move.startY))
    });
  }

  function finishMove(event: PointerEvent<HTMLElement>) {
    if (moveRef.current?.pointerId !== event.pointerId) return;
    moveRef.current = null;
    setMoving(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

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
        ref={popupRef}
        className={`bf-battle-popup bf-battle-popup-${size}${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        style={{ ...style, translate: `${offset.x}px ${offset.y}px` }}
        onClick={(event) => event.stopPropagation()}
      >
        {(title || description) && (
          <header
            className={`bf-battle-popup-header${moving ? " is-moving" : ""}`}
            onPointerDown={startMove}
            onPointerMove={movePopup}
            onPointerUp={finishMove}
            onPointerCancel={finishMove}
            onLostPointerCapture={finishMove}
          >
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
