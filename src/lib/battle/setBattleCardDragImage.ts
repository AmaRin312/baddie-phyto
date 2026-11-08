export function setBattleCardDragImage(
  dragTarget: HTMLElement,
  dataTransfer: DataTransfer
) {
  const cardImage =
    dragTarget.querySelector<HTMLElement>(".bp-board-card") ?? dragTarget;
  const bounds = cardImage.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(cardImage);
  const dragImage = cardImage.cloneNode(true) as HTMLElement;
  Object.assign(dragImage.style, {
    position: "fixed",
    left: `${bounds.left}px`,
    top: `${bounds.top}px`,
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
    borderRadius: computedStyle.borderRadius,
    boxSizing: computedStyle.boxSizing,
    margin: "0",
    opacity: "1",
    transform: "none",
    filter: "none",
    pointerEvents: "none",
    zIndex: "2147483647"
  });
  document.body.appendChild(dragImage);
  dataTransfer.setDragImage(dragImage, bounds.width / 2, bounds.height / 2);

  // Keep the detached snapshot alive through the browser's drag-image capture.
  window.setTimeout(() => dragImage.remove(), 100);
}
