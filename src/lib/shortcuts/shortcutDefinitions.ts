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
  card_move: "カード移動",
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
    id: "hand_to_gauge",
    label: "手札 → ゲージ",
    category: "card_move",
    defaultBinding: key("KeyC")
  },
  {
    id: "hand_to_resolution",
    label: "手札 → どこでもないゾーン",
    category: "card_move",
    defaultBinding: key("KeyG")
  },
  {
    id: "selected_to_drop",
    label: "選択カード → ドロップ",
    category: "card_move",
    defaultBinding: key("KeyD")
  },
  {
    id: "gauge_to_drop",
    label: "ゲージ → ドロップ",
    category: "card_move",
    defaultBinding: key("Digit1")
  },
  {
    id: "toggle_rest",
    label: "レスト/スタンド",
    category: "battle",
    defaultBinding: null,
    inputKind: "double_click"
  }
];

export const SHORTCUT_ACTION_IDS = SHORTCUT_ACTION_DEFINITIONS.map(
  (definition) => definition.id
) as ShortcutActionId[];
