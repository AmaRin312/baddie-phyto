export const BATTLE_TEXT_COMMANDS = [
  {
    id: "frag_new",
    effectType: "instant",
    aliases: [],
    label: "frag_new",
    localizedName: "フラッグに新たに重ねる",
    description: "選んだ自分のカードをフラッグの一番上に置く"
  },
  {
    id: "frag_reverse",
    effectType: "instant",
    aliases: ["フラッグ裏向き", "ふらっぐうらむき"],
    label: "frag_reverse",
    localizedName: "フラッグを裏向きにする",
    description: "現在のフラッグカードを裏向きにする"
  },
  {
    id: "laevateinn",
    effectType: "continuous",
    aliases: ["レヴァンティン", "れゔぁんてぃん"],
    label: "Laevateinn",
    localizedName: "レヴァンティン",
    description: "アイテムの装備枚数制限を解除・再設定する"
  },
  {
    id: "hand_open",
    effectType: "continuous",
    aliases: ["手札公開", "てふだこうかい", "ハンドオープン"],
    label: "hand_open",
    localizedName: "自分の手札を公開する",
    description: "発動中、自分の手札を公開する。再入力で解除"
  },
  {
    id: "turn_start",
    effectType: "instant",
    aliases: ["ターン開始", "たーんかいし"],
    label: "turn_start",
    localizedName: "ターン開始（レスト状態のカードをスタンド）",
    description: "自分のバトルゾーンのレスト状態カードをスタンドする"
  },
  {
    id: "log",
    effectType: "setting",
    aliases: ["ログ", "ろぐ", "ログ表示"],
    label: "log",
    localizedName: "操作ログの表示設定",
    description: "ログの表示／非表示と表示件数を設定する"
  },
  {
    id: "hyakugan",
    effectType: "instant",
    aliases: ["百眼", "ヒャクガン", "ひゃくがん"],
    label: "Hyakugan",
    localizedName: "百眼（ヒャクガン）",
    description: "配置先、天の半身、地の半身を選んで複合カードとして出す"
  },
  {
    id: "quenatar",
    effectType: "instant",
    aliases: ["ビリ・キナータ", "ビリキナータ", "びりきなた"],
    label: "Quenatar",
    localizedName: "ビリ・キナータ",
    description: "選んだ自分のカードを裏向きでセンターに出す"
  }
] as const;

export type BattleTextCommandId =
  (typeof BATTLE_TEXT_COMMANDS)[number]["id"];

export type ParsedBattleTextCommand = {
  id: BattleTextCommandId;
  args: string[];
};

function normalizeCommandName(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\u30a1-\u30f6]/g, (character) =>
      String.fromCharCode(character.charCodeAt(0) - 0x60)
    )
    .replace(/[\s・･ー‐‑–—-]/g, "");
}

export function parseBattleTextCommand(
  input: string
): ParsedBattleTextCommand | null {
  const [rawName, ...args] = input.trim().split(/\s+/);
  if (!rawName) return null;

  const normalizedName = normalizeCommandName(rawName);
  const definition = BATTLE_TEXT_COMMANDS.find(
    (command) =>
      normalizeCommandName(command.id) === normalizedName ||
      command.aliases.some((alias) => normalizeCommandName(alias) === normalizedName)
  );
  if (!definition) return null;

  return {
    id: definition.id,
    args
  };
}

export function getBattleTextCommandSuggestions(input: string) {
  const firstToken = input.trim().split(/\s+/)[0] ?? "";
  const normalizedInput = normalizeCommandName(firstToken);
  if (!normalizedInput) return [];

  return BATTLE_TEXT_COMMANDS.filter((command) => {
    const searchableNames = [
      command.id,
      command.label,
      command.localizedName,
      command.description,
      ...command.aliases
    ];
    return searchableNames.some((name) =>
      normalizeCommandName(name).includes(normalizedInput)
    );
  });
}
