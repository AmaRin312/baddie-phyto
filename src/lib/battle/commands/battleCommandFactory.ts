import { isAreaStackZone } from "@/lib/battle/battleActions";
import type { BattleCommand } from "@/lib/battle/commands/battleCommandTypes";
import type { DeckBrowserRequest } from "@/lib/battle/deckBrowser/deckBrowserTypes";
import { getBattleDestinationDefinition } from "@/lib/battle/destinations/battleDestinationDefinitions";

type CreateDeckBrowserCommandInput = {
  requests: ReadonlyArray<DeckBrowserRequest>;
  playerId: "self" | "opponent";
  clearDeckLook?: boolean;
  source?: BattleCommand["source"];
};

export function createCommandsFromDeckBrowserRequests({
  requests,
  playerId,
  clearDeckLook = true,
  source = "popup"
}: CreateDeckBrowserCommandInput): BattleCommand[] {
  const commands: BattleCommand[] = [];

  requests.forEach((request) => {
    const definition = getBattleDestinationDefinition(request.destination);
    if (!definition || request.destination === "none") return;

    if (request.destination === "reveal") {
      commands.push({
        type: "REVEAL_DECK_CARD",
        payload: {
          playerId,
          instanceId: request.cardInstanceId
        },
        source
      });
      return;
    }

    if (request.destination === "soul") {
      if (!request.soulTargetInstanceId) return;

      commands.push({
        type:
          request.visibility === "face_down"
            ? "ADD_SOUL_FACE_DOWN"
            : "ADD_SOUL_FACE_UP",
        payload: {
          instanceId: request.cardInstanceId,
          fromZone: "deck",
          targetInstanceId: request.soulTargetInstanceId
        },
        source
      });
      return;
    }

    if (!definition.zoneId) return;

    commands.push({
      type: "MOVE_REVEALED_CARD",
      payload: {
        instanceId: request.cardInstanceId,
        toZone: definition.zoneId,
        placeAsNewStack: isAreaStackZone(definition.zoneId)
      },
      source
    });
  });

  if (clearDeckLook) {
    commands.push({
      type: "CLEAR_DECK_LOOK",
      payload: {
        playerId
      },
      source
    });
  }

  return commands;
}
