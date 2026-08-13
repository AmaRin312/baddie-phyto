export type BattleShortcutBlockState = {
  isShortcutCaptureOpen?: boolean;
  isBattleActionPopupOpen?: boolean;
  isContextMenuOpen?: boolean;
  isSelectionModeOpen?: boolean;
  isDeckCountPopupOpen?: boolean;
  isDeckBrowserPopupOpen?: boolean;
  isDeckDropDialogOpen?: boolean;
  isBiriKinataPopupOpen?: boolean;
  isFaceDownSoulPopupOpen?: boolean;
  isHyakuganPopupOpen?: boolean;
  isAbilityNotificationOpen?: boolean;
};

export function isBattleShortcutBlocked(state: BattleShortcutBlockState) {
  return Object.values(state).some(Boolean);
}
