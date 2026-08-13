"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SHORTCUT_ACTION_DEFINITIONS,
  SHORTCUT_CATEGORY_LABELS
} from "@/lib/shortcuts/shortcutDefinitions";
import {
  loadShortcutSettings,
  resetAllShortcutSettings,
  resetShortcutSetting,
  saveShortcutSettings
} from "@/lib/shortcuts/shortcutSettings";
import type {
  ShortcutActionDefinition,
  ShortcutActionId,
  ShortcutBinding,
  ShortcutSettings
} from "@/lib/shortcuts/shortcutTypes";
import {
  applyShortcutBindingSwap,
  bindingFromKeyboardEvent,
  findActionByBinding,
  formatShortcutBinding,
  mergeWithDefaultShortcuts
} from "@/lib/shortcuts/shortcutUtils";

type PendingBinding = {
  actionId: ShortcutActionId;
};

type DuplicateConfirmation = {
  actionId: ShortcutActionId;
  binding: ShortcutBinding;
  existingActionId: ShortcutActionId;
};

export function ShortcutSettingsPanel() {
  const [settings, setSettings] = useState<Required<ShortcutSettings>>(
    mergeWithDefaultShortcuts(null)
  );
  const [pendingBinding, setPendingBinding] = useState<PendingBinding | null>(null);
  const [duplicateConfirmation, setDuplicateConfirmation] =
    useState<DuplicateConfirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const definitionsByCategory = useMemo(
    () =>
      SHORTCUT_ACTION_DEFINITIONS.reduce(
        (groups, definition) => {
          groups[definition.category] = [
            ...(groups[definition.category] ?? []),
            definition
          ];
          return groups;
        },
        {} as Partial<Record<string, ShortcutActionDefinition[]>>
      ),
    []
  );

  useEffect(() => {
    async function load() {
      const result = await loadShortcutSettings();
      setSettings(result.data);
      setLoading(false);
      if (result.error) {
        setMessage("ショートカット設定の読み込みに失敗したため、デフォルトを使用しています。");
      }
    }

    void load();
  }, []);

  useEffect(() => {
    if (!pendingBinding) return;
    const targetActionId = pendingBinding.actionId;

    function handleKeyDown(event: KeyboardEvent) {
      event.preventDefault();
      event.stopPropagation();

      if (event.code === "Escape") {
        setPendingBinding(null);
        return;
      }

      if (
        [
          "ControlLeft",
          "ControlRight",
          "ShiftLeft",
          "ShiftRight",
          "AltLeft",
          "AltRight",
          "MetaLeft",
          "MetaRight"
        ].includes(event.code)
      ) {
        return;
      }

      const binding = bindingFromKeyboardEvent(event);
      const duplicate = findActionByBinding(
        settings,
        binding,
        targetActionId
      );

      if (duplicate) {
        setDuplicateConfirmation({
          actionId: targetActionId,
          binding,
          existingActionId: duplicate.id
        });
        setPendingBinding(null);
        return;
      }

      setSettings((current) => ({
        ...current,
        [targetActionId]: binding
      }));
      setPendingBinding(null);
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [pendingBinding, settings]);

  async function persist(nextSettings: Required<ShortcutSettings>) {
    setSaving(true);
    setMessage("");
    const result = await saveShortcutSettings(nextSettings);
    setSaving(false);
    setMessage(
      result.error
        ? "ショートカット設定の保存に失敗しました。"
        : "ショートカット設定を保存しました。"
    );
  }

  function replaceDuplicate() {
    if (!duplicateConfirmation) return;

    setSettings((current) => ({
      ...applyShortcutBindingSwap(current, {
        actionId: duplicateConfirmation.actionId,
        binding: duplicateConfirmation.binding,
        existingActionId: duplicateConfirmation.existingActionId
      })
    }));
    setDuplicateConfirmation(null);
  }

  if (loading) {
    return <p className="dm-muted-text">ショートカット設定を読み込み中...</p>;
  }

  return (
    <section className="bf-shortcut-settings">
      <div className="bf-shortcut-settings-header">
        <p className="dm-muted-text">
          キー入力はKeyboardEvent.codeで保存します。重複した割り当ては確認して入れ替えます。
        </p>
        <div className="bf-shortcut-settings-actions">
          <button
            className="dm-button"
            type="button"
            onClick={() => setSettings(resetAllShortcutSettings())}
          >
            全てデフォルトへ戻す
          </button>
          <button
            className="dm-button primary"
            type="button"
            disabled={saving}
            onClick={() => void persist(settings)}
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>

      {Object.entries(SHORTCUT_CATEGORY_LABELS).map(([category, label]) => (
        <section className="bf-shortcut-category" key={category}>
          <h3>{label}</h3>
          <div className="bf-shortcut-grid">
            {(definitionsByCategory[category] ?? []).map((definition) => (
              <article className="bf-shortcut-row" key={definition.id}>
                <div>
                  <strong>{definition.label}</strong>
                  {definition.description && <p>{definition.description}</p>}
                </div>
                <span className="bf-shortcut-binding">
                  {definition.inputKind === "double_click"
                    ? "ダブルクリック"
                    : formatShortcutBinding(settings[definition.id])}
                </span>
                {definition.inputKind === "double_click" ? (
                  <span className="dm-muted-text">固定</span>
                ) : (
                  <div className="bf-shortcut-row-actions">
                    <button
                      type="button"
                      className="dm-button"
                      onClick={() => setPendingBinding({ actionId: definition.id })}
                    >
                      変更
                    </button>
                    <button
                      type="button"
                      className="dm-button"
                      onClick={() =>
                        setSettings((current) => ({
                          ...current,
                          [definition.id]: null
                        }))
                      }
                    >
                      解除
                    </button>
                    <button
                      type="button"
                      className="dm-button"
                      onClick={() =>
                        setSettings((current) =>
                          resetShortcutSetting(current, definition.id)
                        )
                      }
                    >
                      デフォルト
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}

      {message && <p className="dm-form-message">{message}</p>}

      {pendingBinding && (
        <div className="bf-shortcut-capture" role="dialog" aria-modal="true">
          <div>
            <h3>新しいキーを押してください</h3>
            <p>Escでキャンセルします。Ctrl / Shift / Alt との組み合わせも登録できます。</p>
          </div>
        </div>
      )}

      {duplicateConfirmation && (
        <div className="bf-shortcut-capture" role="dialog" aria-modal="true">
          <div>
            <h3>キーが重複しています</h3>
            <p>
              {formatShortcutBinding(duplicateConfirmation.binding)} は
              「
              {
                SHORTCUT_ACTION_DEFINITIONS.find(
                  (definition) =>
                    definition.id === duplicateConfirmation.existingActionId
                )?.label
              }
              」に割り当てられています。入れ替えますか？
            </p>
            <div className="bf-shortcut-settings-actions">
              <button className="dm-button primary" type="button" onClick={replaceDuplicate}>
                入れ替える
              </button>
              <button
                className="dm-button"
                type="button"
                onClick={() => setDuplicateConfirmation(null)}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
