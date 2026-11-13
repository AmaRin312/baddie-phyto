export function setBattleCardDragImage(
  dragTarget: HTMLElement,
  dataTransfer: DataTransfer,
  selectedInstanceIds?: ReadonlySet<string>
) {
  const cardImage =
    dragTarget.querySelector<HTMLElement>(".bp-board-card") ?? dragTarget;
  const bounds = cardImage.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(cardImage);
  const sourceTransform = window.getComputedStyle(dragTarget).transform;
  const sourceMatrix = sourceTransform === "none" ? null : new DOMMatrixReadOnly(sourceTransform);
  const rotationDegrees = sourceMatrix
    ? (Math.atan2(sourceMatrix.b, sourceMatrix.a) * 180) / Math.PI
    : 0;
  const isQuarterTurn = Math.abs(Math.abs(rotationDegrees) - 90) < 1;
  const cardWidth = isQuarterTurn ? bounds.height : bounds.width;
  const cardHeight = isQuarterTurn ? bounds.width : bounds.height;
  const selectedButtons = selectedInstanceIds
    ? Array.from(document.querySelectorAll<HTMLElement>("[data-battle-card-instance-id]"))
        .filter((button) => {
          const id = button.dataset.battleCardInstanceId;
          return id !== dragTarget.dataset.battleCardInstanceId &&
            Boolean(id && selectedInstanceIds.has(id)) &&
            button.classList.contains("is-selected");
        })
        .slice(0, 2)
    : [];
  const cardButtons = [dragTarget, ...selectedButtons];
  const offset = 10;
  const dragImage = document.createElement("div");
  Object.assign(dragImage.style, {
    position: "fixed",
    left: `${bounds.left}px`,
    top: `${bounds.top}px`,
    width: `${cardWidth + offset * (cardButtons.length - 1)}px`,
    height: `${cardHeight + offset * (cardButtons.length - 1)}px`,
    margin: "0",
    opacity: "1",
    overflow: "visible",
    pointerEvents: "none",
    zIndex: "2147483647"
  });
  cardButtons.forEach((button, index) => {
    const image = button.querySelector<HTMLElement>(".bp-board-card") ?? button;
    const buttonTransform = window.getComputedStyle(button).transform;
    const matrix = buttonTransform === "none" ? null : new DOMMatrixReadOnly(buttonTransform);
    const angle = matrix ? (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI : 0;
    const quarterTurn = Math.abs(Math.abs(angle) - 90) < 1;
    const clone = image.cloneNode(true) as HTMLElement;
    Object.assign(clone.style, {
      position: "absolute",
      left: `${(quarterTurn ? (cardHeight - cardWidth) / 2 : 0) + offset * index}px`,
      top: `${(quarterTurn ? (cardWidth - cardHeight) / 2 : 0) + offset * index}px`,
      width: `${quarterTurn ? bounds.height : bounds.width}px`,
      height: `${quarterTurn ? bounds.width : bounds.height}px`,
      borderRadius: window.getComputedStyle(image).borderRadius,
      boxSizing: window.getComputedStyle(image).boxSizing,
      margin: "0",
      transform: quarterTurn ? `rotate(${angle}deg)` : "none",
      transformOrigin: "center",
      filter: "none"
    });
    dragImage.appendChild(clone);
  });
  document.body.appendChild(dragImage);
  dataTransfer.setDragImage(
    dragImage,
    (cardWidth + offset * (cardButtons.length - 1)) / 2,
    (cardHeight + offset * (cardButtons.length - 1)) / 2
  );

  // Keep the detached snapshot alive through the browser's drag-image capture.
  window.setTimeout(() => dragImage.remove(), 100);
}
