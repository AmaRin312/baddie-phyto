import {
  addSoulCardFaceDown,
  addSoulCardFaceUp,
  activateBiriKinata,
  applyRuleChange,
  changeLife,
  clearDeckLook,
  drawCard,
  lookTopDeck,
  moveAreaStackToSlot,
  moveCard,
  moveCards,
  moveRevealedCard,
  moveSoulToSoulFaceDown,
  moveSoulToSoulFaceUp,
  moveSoulCard,
  moveSoulCards,
  moveTopDeckCard,
  placeCardInAreaSlot,
  placeAsFlag,
  placeOrStackAreaCard,
  reorderLookedCards,
  returnLookedCards,
  revealDeckCards,
  setViewerCard,
  shuffleDeck,
  stackCardOnAreaCard,
  swapAreaStacks,
  toggleCardOrientation
} from "@/lib/battle/battleActions";
import type { BattleState } from "@/types/battle";
import type { BattleCommand } from "@/lib/battle/commands/battleCommandTypes";

export function executeBattleCommand(
  state: BattleState,
  command: BattleCommand
): BattleState {
  switch (command.type) {
    case "MOVE_CARD":
      return moveCard(state, command.payload);
    case "MOVE_CARDS":
      return moveCards(state, command.payload);
    case "MOVE_TOP_DECK_CARD":
      return moveTopDeckCard(state, command.payload);
    case "DRAW_CARD":
      return drawCard(state, command.payload);
    case "SHUFFLE_DECK":
      return shuffleDeck(state, command.payload);
    case "SET_VIEWER_CARD":
      return setViewerCard(state, command.payload.instanceId);
    case "TOGGLE_CARD_ORIENTATION":
      return toggleCardOrientation(state, command.payload);
    case "CHANGE_LIFE":
      return changeLife(state, command.payload);
    case "LOOK_TOP_DECK":
      return lookTopDeck(state, command.payload);
    case "REVEAL_DECK_CARD":
      return revealDeckCards(state, command.payload);
    case "MOVE_REVEALED_CARD":
      return moveRevealedCard(state, command.payload);
    case "RETURN_LOOKED_CARDS":
      return returnLookedCards(state, command.payload);
    case "REORDER_LOOKED_CARDS":
      return reorderLookedCards(state, command.payload);
    case "CLEAR_DECK_LOOK":
      return clearDeckLook(state, command.payload);
    case "PLACE_AS_FLAG":
      return placeAsFlag(state, command.payload);
    case "APPLY_RULE_CHANGE":
      return applyRuleChange(state, command.payload);
    case "ACTIVATE_BIRI_KINATA":
      return activateBiriKinata(state, command.payload);
    case "MOVE_SOUL_CARD":
      return moveSoulCard(state, command.payload);
    case "MOVE_SOUL_CARDS":
      return moveSoulCards(state, command.payload);
    case "STACK_CARD":
      return stackCardOnAreaCard(state, command.payload);
    case "PLACE_AREA_SLOT":
      return placeCardInAreaSlot(state, command.payload);
    case "PLACE_OR_STACK_AREA_CARD":
      return placeOrStackAreaCard(state, command.payload);
    case "ADD_SOUL_FACE_UP":
      return addSoulCardFaceUp(state, command.payload);
    case "ADD_SOUL_FACE_DOWN":
      return addSoulCardFaceDown(state, command.payload);
    case "MOVE_SOUL_TO_SOUL_FACE_UP":
      return moveSoulToSoulFaceUp(state, command.payload);
    case "MOVE_SOUL_TO_SOUL_FACE_DOWN":
      return moveSoulToSoulFaceDown(state, command.payload);
    case "SWAP_AREA_STACKS":
      return swapAreaStacks(state, command.payload);
    case "MOVE_AREA_STACK_TO_SLOT":
      return moveAreaStackToSlot(state, command.payload);
    default:
      return state;
  }
}
