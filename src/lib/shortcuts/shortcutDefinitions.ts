import type {
  ShortcutActionDefinition,
  ShortcutActionId,
  ShortcutBinding,
  ShortcutCategory
} from "@/lib/shortcuts/shortcutTypes";

function key(code: string): ShortcutBinding {
  return {
    code,
    ctrl: false,
    shift: false,
    alt: false
  };
}

export const SHORTCUT_CATEGORY_LABELS: Readonly<Record<ShortcutCategory, string>> = {
  basic: "基本操作",
  life: "ライフ",
  battle: "盤面操作"
};

export const SHORTCUT_ACTION_DEFINITIONS: readonly ShortcutActionDefinition[] = [
  {
    id: "draw_one",
    label: "1枚ドロー",
    category: "basic",
    defaultBinding: key("KeyV")
  },
  {
    id: "clear_selection",
    label: "選択解除",
    category: "basic",
    defaultBinding: key("Escape")
  },
  {
    id: "life_plus",
    label: "ライフ +1",
    category: "life",
    defaultBinding: key("ArrowUp")
  },
  {
    id: "life_minus",
    label: "ライフ -1",
    category: "life",
    defaultBinding: key("ArrowDown")
  },
  {
    id: "toggle_rest",
    label: "レスト/スタンド",
    category: "battle",
    defaultBinding: null,
    inputKind: "double_click"
  },
  {
    id: "turn_start",
    label: "ターン開始（全カードをスタンド）",
    category: "battle",
    defaultBinding: key("KeyM")
  }
];

export const SHORTCUT_ACTION_IDS = SHORTCUT_ACTION_DEFINITIONS.map(
  (definition) => definition.id
) as ShortcutActionId[];
