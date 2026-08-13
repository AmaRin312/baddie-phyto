import { supabase } from "@/lib/supabase/client";
import type { ShortcutSettings } from "@/lib/shortcuts/shortcutTypes";
import {
  getDefaultShortcutSettings,
  mergeWithDefaultShortcuts
} from "@/lib/shortcuts/shortcutUtils";
import type { ShortcutActionId } from "@/lib/shortcuts/shortcutTypes";

type UserSettingsRow = {
  user_id: string;
  shortcut_settings: ShortcutSettings | null;
  created_at: string;
  updated_at: string;
};

export async function loadShortcutSettings() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return {
      data: getDefaultShortcutSettings(),
      error: userError ?? new Error("User is not signed in.")
    };
  }

  const { data, error } = await supabase
    .from("baddie_phyto_user_settings")
    .select("*")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    return {
      data: getDefaultShortcutSettings(),
      error
    };
  }

  return {
    data: mergeWithDefaultShortcuts((data as UserSettingsRow | null)?.shortcut_settings),
    error: null
  };
}

export async function saveShortcutSettings(settings: ShortcutSettings) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return {
      error: userError ?? new Error("User is not signed in.")
    };
  }

  const { error } = await supabase
    .from("baddie_phyto_user_settings")
    .upsert({
      user_id: userData.user.id,
      shortcut_settings: settings,
      updated_at: new Date().toISOString()
    });

  if (error) console.error(error);
  return { error };
}

export function resetShortcutSetting(
  settings: ShortcutSettings,
  actionId: ShortcutActionId
) {
  const defaultSettings = getDefaultShortcutSettings();
  return {
    ...mergeWithDefaultShortcuts(settings),
    [actionId]: defaultSettings[actionId]
  } satisfies Required<ShortcutSettings>;
}

export function resetAllShortcutSettings(): Required<ShortcutSettings> {
  return getDefaultShortcutSettings();
}
