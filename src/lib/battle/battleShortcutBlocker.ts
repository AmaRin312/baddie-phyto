export type BattleShortcutBlockState = {
  isShortcutCaptureOpen?: boolean;
  isBattleActionPopupOpen?: boolean;
  isContextMenuOpen?: boolean;
  isSelectionModeOpen?: boolean;
  isDeckCountPopupOpen?: boolean;
  isDeckBrowserPopupOpen?: boolean;
  isDeckDropDialogOpen?: boolean;
  isBiriKinataPopupOpen?: boolean;
};

export function isBattleShortcutBlocked(state: BattleShortcutBlockState) {
  return Object.values(state).some(Boolean);
}
