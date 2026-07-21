import type { BattleZoneId } from "@/types/battle";
import type {
  DeckPosition,
  ApplyRuleChangeInput,
  ClearDeckLookInput,
  LookTopDeckInput,
  MoveRevealedCardInput,
  MoveAreaStackToSlotInput,
  PlaceHyakuganCompositeInput,
  ResolveBiriKinataNotificationInput,
  PlaceAsFlagInput,
  ReorderLookedCardsInput,
  ReturnLookedCardsInput,
  RevealDeckCardsInput,
  SwapAreaStacksInput
} from "@/lib/battle/battleActions";

export type BattleCommandSource =
  | "shortcut"
  | "context_menu"
  | "drag_drop"
  | "popup"
  | "ability"
  | "system";

export type MoveCardCommand = {
  type: "MOVE_CARD";
  payload: {
    instanceId: string;
    fromZone?: BattleZoneId;
    toZone: BattleZoneId;
    index?: number;
    deckPosition?: DeckPosition;
  };
};

export type MoveCardsCommand = {
  type: "MOVE_CARDS";
  payload: {
    instanceIds: string[];
    toZone: BattleZoneId;
    index?: number;
    deckPosition?: DeckPosition;
  };
};

export type MoveTopDeckCardCommand = {
  type: "MOVE_TOP_DECK_CARD";
  payload: {
    playerId: "self" | "opponent";
    toZone: BattleZoneId;
  };
};

export type DrawCardCommand = {
  type: "DRAW_CARD";
  payload: {
    playerId: "self" | "opponent";
    count?: number;
  };
};

export type ShuffleDeckCommand = {
  type: "SHUFFLE_DECK";
  payload: {
    playerId: "self" | "opponent";
  };
};

export type SetViewerCardCommand = {
  type: "SET_VIEWER_CARD";
  payload: {
    instanceId: string | null;
  };
};

export type ToggleCardOrientationCommand = {
  type: "TOGGLE_CARD_ORIENTATION";
  payload: {
    instanceId: string;
  };
};

export type ChangeLifeCommand = {
  type: "CHANGE_LIFE";
  payload: {
    playerId: "self" | "opponent";
    amount: number;
  };
};

export type LookTopDeckCommand = {
  type: "LOOK_TOP_DECK";
  payload: LookTopDeckInput;
};

export type RevealDeckCardCommand = {
  type: "REVEAL_DECK_CARD";
  payload: RevealDeckCardsInput;
};

export type MoveRevealedCardCommand = {
  type: "MOVE_REVEALED_CARD";
  payload: MoveRevealedCardInput;
};

export type ReturnLookedCardsCommand = {
  type: "RETURN_LOOKED_CARDS";
  payload: ReturnLookedCardsInput;
};

export type ReorderLookedCardsCommand = {
  type: "REORDER_LOOKED_CARDS";
  payload: ReorderLookedCardsInput;
};

export type ClearDeckLookCommand = {
  type: "CLEAR_DECK_LOOK";
  payload: ClearDeckLookInput;
};

export type PlaceAsFlagCommand = {
  type: "PLACE_AS_FLAG";
  payload: PlaceAsFlagInput;
};

export type ApplyRuleChangeCommand = {
  type: "APPLY_RULE_CHANGE";
  payload: ApplyRuleChangeInput;
};

export type ResolveBiriKinataNotificationCommand = {
  type: "RESOLVE_BIRI_KINATA_NOTIFICATION";
  payload: ResolveBiriKinataNotificationInput;
};

export type PlaceHyakuganCompositeCommand = {
  type: "PLACE_HYAKUGAN_COMPOSITE";
  payload: PlaceHyakuganCompositeInput;
};

export type MoveSoulCardCommand = {
  type: "MOVE_SOUL_CARD";
  payload: {
    parentInstanceId: string;
    soulInstanceId: string;
    toZone: BattleZoneId;
    deckPosition?: DeckPosition;
    targetInstanceId?: string;
    placeAsNewStack?: boolean;
  };
};

export type MoveSoulCardsCommand = {
  type: "MOVE_SOUL_CARDS";
  payload: {
    parentInstanceId: string;
    soulInstanceIds: string[];
    toZone: BattleZoneId;
    deckPosition?: DeckPosition;
  };
};

export type StackCardCommand = {
  type: "STACK_CARD";
  payload: {
    instanceId: string;
    fromZone?: BattleZoneId;
    toZone: BattleZoneId;
    targetInstanceId: string;
  };
};

export type PlaceAreaSlotCommand = {
  type: "PLACE_AREA_SLOT";
  payload: {
    instanceId: string;
    fromZone?: BattleZoneId;
    toZone: BattleZoneId;
  };
};

export type PlaceOrStackAreaCardCommand = {
  type: "PLACE_OR_STACK_AREA_CARD";
  payload: {
    instanceId: string;
    fromZone: BattleZoneId;
    toZone: BattleZoneId;
    targetInstanceId?: string;
  };
};

export type AddSoulFaceUpCommand = {
  type: "ADD_SOUL_FACE_UP";
  payload: {
    instanceId: string;
    fromZone?: BattleZoneId;
    targetInstanceId: string;
  };
};

export type AddSoulFaceDownCommand = {
  type: "ADD_SOUL_FACE_DOWN";
  payload: {
    instanceId: string;
    fromZone?: BattleZoneId;
    targetInstanceId: string;
  };
};

export type MoveSoulToSoulFaceUpCommand = {
  type: "MOVE_SOUL_TO_SOUL_FACE_UP";
  payload: {
    parentInstanceId: string;
    soulInstanceId: string;
    targetInstanceId: string;
  };
};

export type MoveSoulToSoulFaceDownCommand = {
  type: "MOVE_SOUL_TO_SOUL_FACE_DOWN";
  payload: {
    parentInstanceId: string;
    soulInstanceId: string;
    targetInstanceId: string;
  };
};

export type SwapAreaStacksCommand = {
  type: "SWAP_AREA_STACKS";
  payload: SwapAreaStacksInput;
};

export type MoveAreaStackToSlotCommand = {
  type: "MOVE_AREA_STACK_TO_SLOT";
  payload: MoveAreaStackToSlotInput;
};

export type BattleCommand =
  (
    | MoveCardCommand
    | MoveCardsCommand
    | MoveTopDeckCardCommand
    | DrawCardCommand
    | ShuffleDeckCommand
    | SetViewerCardCommand
    | ToggleCardOrientationCommand
    | ChangeLifeCommand
    | LookTopDeckCommand
    | RevealDeckCardCommand
    | MoveRevealedCardCommand
    | ReturnLookedCardsCommand
    | ReorderLookedCardsCommand
    | ClearDeckLookCommand
    | PlaceAsFlagCommand
    | ApplyRuleChangeCommand
    | ResolveBiriKinataNotificationCommand
    | PlaceHyakuganCompositeCommand
    | MoveSoulCardCommand
    | MoveSoulCardsCommand
    | StackCardCommand
    | PlaceAreaSlotCommand
    | PlaceOrStackAreaCardCommand
    | AddSoulFaceUpCommand
    | AddSoulFaceDownCommand
    | MoveSoulToSoulFaceUpCommand
    | MoveSoulToSoulFaceDownCommand
    | SwapAreaStacksCommand
    | MoveAreaStackToSlotCommand
  ) & {
    source?: BattleCommandSource;
  };
