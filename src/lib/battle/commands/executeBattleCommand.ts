import {
  addSoulCardFaceDown,
  addSoulCardFaceUp,
  applyRuleChange,
  changeLife,
  clearDice,
  clearDeckLook,
  drawCard,
  lookTopDeck,
  moveAreaStackToSlot,
  moveCard,
  moveCards,
  moveRevealedCard,
  moveSoulToSoulFaceDown,
  moveSoulToSoulFaceUp,
  revealSoulCard,
  moveSoulCard,
  moveSoulCards,
  moveTopDeckCard,
  placeCardInAreaSlot,
  placeHyakuganComposite,
  placeAsFlag,
  placeQuenatarCard,
  placeOrStackAreaCard,
  reorderLookedCards,
  returnLookedCards,
  revealDeckCards,
  resolveBiriKinataNotification,
  rollDice,
  setHandOpenEffect,
  setLaevateinnEffect,
  setViewerCard,
  shuffleDeck,
  standAllBattleCards,
  stackCardOnAreaCard,
  swapAreaStacks,
  toggleCardOrientation,
  toggleFlagVisibility
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
    case "STAND_ALL_BATTLE_CARDS":
      return standAllBattleCards(state);
    case "CHANGE_LIFE":
      return changeLife(state, command.payload);
    case "ROLL_DICE":
      return rollDice(state, command.payload);
    case "CLEAR_DICE":
      return clearDice(state, command.payload);
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
    case "SET_LAEVATEINN_EFFECT":
      return setLaevateinnEffect(state, command.payload);
    case "SET_HAND_OPEN_EFFECT":
      return setHandOpenEffect(state, command.payload);
    case "TOGGLE_FLAG_VISIBILITY":
      return toggleFlagVisibility(state);
    case "PLACE_QUENATAR_CARD":
      return placeQuenatarCard(state, command.payload);
    case "RESOLVE_BIRI_KINATA_NOTIFICATION":
      return resolveBiriKinataNotification(state, command.payload);
    case "PLACE_HYAKUGAN_COMPOSITE":
      return placeHyakuganComposite(state, command.payload);
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
    case "REVEAL_SOUL_CARD":
      return revealSoulCard(state, command.payload);
    case "SWAP_AREA_STACKS":
      return swapAreaStacks(state, command.payload);
    case "MOVE_AREA_STACK_TO_SLOT":
      return moveAreaStackToSlot(state, command.payload);
    default:
      return state;
  }
}
