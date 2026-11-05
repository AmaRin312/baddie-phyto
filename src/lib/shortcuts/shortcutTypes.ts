export type ShortcutCategory = "basic" | "life" | "battle";

export type ShortcutActionId =
  | "draw_one"
  | "clear_selection"
  | "life_plus"
  | "life_minus"
  | "toggle_rest"
  | "turn_start";

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
