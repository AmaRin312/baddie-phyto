export function setBattleCardDragImage(
  dragTarget: HTMLElement,
  dataTransfer: DataTransfer
) {
  const cardImage =
    dragTarget.querySelector<HTMLElement>(".bp-board-card") ?? dragTarget;
  const bounds = cardImage.getBoundingClientRect();
  dataTransfer.setDragImage(cardImage, bounds.width / 2, bounds.height / 2);
}
