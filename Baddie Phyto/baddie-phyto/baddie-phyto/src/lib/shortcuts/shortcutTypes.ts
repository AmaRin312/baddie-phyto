export type ShortcutCategory = "basic" | "life" | "card_move" | "battle";

export type ShortcutActionId =
  | "draw_one"
  | "clear_selection"
  | "life_plus"
  | "life_minus"
  | "hand_to_gauge"
  | "hand_to_resolution"
  | "selected_to_drop"
  | "gauge_to_drop"
  | "toggle_rest";

export type ShortcutBinding = {
  code: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
};

export type ShortcutActionDefinition = {
  id: ShortcutActionId;
  label: string;
  description?: string;
  category: ShortcutCategory;
  defaultBinding: ShortcutBinding | null;
  inputKind?: "keyboard" | "double_click";
};

export type ShortcutSettings = Partial<
  Record<ShortcutActionId, ShortcutBinding | null>
>;
