import {
  SHORTCUT_ACTION_DEFINITIONS,
  SHORTCUT_ACTION_IDS
} from "@/lib/shortcuts/shortcutDefinitions";
import type {
  ShortcutActionId,
  ShortcutBinding,
  ShortcutSettings
} from "@/lib/shortcuts/shortcutTypes";

export function isShortcutActionId(value: string): value is ShortcutActionId {
  return (SHORTCUT_ACTION_IDS as string[]).includes(value);
}

export function bindingEquals(
  left: ShortcutBinding | null | undefined,
  right: ShortcutBinding | null | undefined
) {
  if (!left || !right) return false;
  return (
    left.code === right.code &&
    left.ctrl === right.ctrl &&
    left.shift === right.shift &&
    left.alt === right.alt
  );
}

export function getDefaultShortcutSettings(): Required<ShortcutSettings> {
  return Object.fromEntries(
    SHORTCUT_ACTION_DEFINITIONS.map((definition) => [
      definition.id,
      definition.defaultBinding
    ])
  ) as Required<ShortcutSettings>;
}

export function mergeWithDefaultShortcuts(
  settings: ShortcutSettings | null | undefined
): Required<ShortcutSettings> {
  return {
    ...getDefaultShortcutSettings(),
    ...(settings ?? {})
  };
}

export function findActionByBinding(
  settings: ShortcutSettings,
  binding: ShortcutBinding,
  excludeActionId?: ShortcutActionId
) {
  const mergedSettings = mergeWithDefaultShortcuts(settings);

  return SHORTCUT_ACTION_DEFINITIONS.find((definition) => {
    if (definition.id === excludeActionId) return false;
    return bindingEquals(mergedSettings[definition.id], binding);
  });
}

export function applyShortcutBindingSwap(
  settings: ShortcutSettings,
  input: {
    actionId: ShortcutActionId;
    binding: ShortcutBinding;
    existingActionId: ShortcutActionId;
  }
): Required<ShortcutSettings> {
  const mergedSettings = mergeWithDefaultShortcuts(settings);
  const previousBinding = mergedSettings[input.actionId];

  return {
    ...mergedSettings,
    [input.actionId]: input.binding,
    [input.existingActionId]: previousBinding
  };
}

export function bindingFromKeyboardEvent(event: KeyboardEvent): ShortcutBinding {
  return {
    code: event.code,
    ctrl: event.ctrlKey,
    shift: event.shiftKey,
    alt: event.altKey
  };
}

export function formatShortcutBinding(binding: ShortcutBinding | null | undefined) {
  if (!binding) return "未割り当て";

  const parts = [];
  if (binding.ctrl) parts.push("Ctrl");
  if (binding.shift) parts.push("Shift");
  if (binding.alt) parts.push("Alt");
  parts.push(formatShortcutCode(binding.code));
  return parts.join(" + ");
}

export function formatShortcutCode(code: string) {
  if (code.startsWith("Key")) return code.replace("Key", "");
  if (code.startsWith("Digit")) return code.replace("Digit", "");
  if (code === "Escape") return "Esc";
  if (code === "ArrowUp") return "↑";
  if (code === "ArrowDown") return "↓";
  if (code === "ArrowLeft") return "←";
  if (code === "ArrowRight") return "→";
  if (code === "Space") return "Space";
  return code;
}

export function shouldIgnoreShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}
