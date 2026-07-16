"use client";

import { useMemo, useState } from "react";
import { BattlePopup } from "@/components/battle/BattlePopup";
import { BoardCard } from "@/components/cards/BoardCard";
import {
  DEFAULT_DECK_BROWSER_DESTINATIONS,
  getBattleDestinationDefinitions
} from "@/lib/battle/destinations/battleDestinationDefinitions";
import type { BattleDestination } from "@/lib/battle/destinations/battleDestinationTypes";
import type {
  DeckBrowserMode,
  DeckBrowserRequest
} from "@/lib/battle/deckBrowser/deckBrowserTypes";
import type { BattleCard } from "@/types/battle";
import type { CardImageRecord, CardRecord } from "@/types/baddiePhyto";

type DeckBrowserDraftAction = {
  instanceId: string;
  destination: BattleDestination;
  soulTargetInstanceId?: string;
  soulVisibility?: "public" | "face_down";
};

type DeckBrowserPopupProps = {
  cards: BattleCard[];
  cardMap: Map<string, CardRecord>;
  imagesByCard: Map<string, CardImageRecord[]>;
  soulCandidates: BattleCard[];
  title?: string;
  description?: string;
  mode?: DeckBrowserMode;
  allowedDestinations?: ReadonlyArray<BattleDestination>;
  onExecute: (requests: DeckBrowserRequest[]) => void;
  onClose: () => void;
};

export const DECK_BROWSER_PAGE_SIZE = 12;

function getCardName(cardMap: Map<string, CardRecord>, battleCard: BattleCard) {
  return cardMap.get(battleCard.cardId)?.name ?? "Unknown";
}

export function DeckBrowserPopup({
  cards,
  cardMap,
  imagesByCard,
  soulCandidates,
  title = "Deck Browser",
  description = "山札上から下の順に表示しています。カードを選び、下側で移動先を設定します。",
  mode = "move",
  allowedDestinations = DEFAULT_DECK_BROWSER_DESTINATIONS,
  onExecute,
  onClose
}: DeckBrowserPopupProps) {
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDestination, setBulkDestination] =
    useState<BattleDestination>("none");
  const [actionsById, setActionsById] = useState<
    Record<string, DeckBrowserDraftAction>
  >({});

  const canSelectCards = mode !== "browse";
  const canEditDestinations = mode === "move" || mode === "look" || mode === "ability";
  const canExecute = canEditDestinations;
  const normalizedAllowedDestinations = allowedDestinations.includes("none")
    ? allowedDestinations
    : (["none", ...allowedDestinations] as const);
  const availableDestinations = getBattleDestinationDefinitions(
    normalizedAllowedDestinations
  );
  const pageCount = Math.max(1, Math.ceil(cards.length / DECK_BROWSER_PAGE_SIZE));
  const pageCards = useMemo(
    () =>
      cards.slice(
        page * DECK_BROWSER_PAGE_SIZE,
        page * DECK_BROWSER_PAGE_SIZE + DECK_BROWSER_PAGE_SIZE
      ),
    [cards, page]
  );
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedCards = cards.filter((card) => selectedIdSet.has(card.instanceId));
  const actions = selectedCards.map(
    (card) =>
      actionsById[card.instanceId] ?? {
        instanceId: card.instanceId,
        destination: "none" as const
      }
  );
  const unspecifiedCount = actions.filter(
    (action) => action.destination === "none"
  ).length;
  const hasInvalidSoulAction = actions.some(
    (action) => action.destination === "soul" && !action.soulTargetInstanceId
  );

  function toggleCard(instanceId: string) {
    if (!canSelectCards) return;

    if (selectedIds.includes(instanceId)) {
      setSelectedIds((currentIds) =>
        currentIds.filter((id) => id !== instanceId)
      );
      setActionsById((currentActions) => {
        const nextActions = { ...currentActions };
        delete nextActions[instanceId];
        return nextActions;
      });
      return;
    }

    setSelectedIds((currentIds) => [...currentIds, instanceId]);
    setActionsById((currentActions) => {
      if (currentActions[instanceId]) return currentActions;

      return {
        ...currentActions,
        [instanceId]: {
          instanceId,
          destination: "none"
        }
      };
    });
  }

  function updateAction(
    instanceId: string,
    updater: (current: DeckBrowserDraftAction) => DeckBrowserDraftAction
  ) {
    setActionsById((currentActions) => {
      const current = currentActions[instanceId] ?? {
        instanceId,
        destination: "none" as const
      };

      return {
        ...currentActions,
        [instanceId]: updater(current)
      };
    });
  }

  function applyBulkDestination() {
    if (!canEditDestinations) return;

    setActionsById((currentActions) => {
      const nextActions = { ...currentActions };
      selectedCards.forEach((battleCard) => {
        nextActions[battleCard.instanceId] = {
          ...(nextActions[battleCard.instanceId] ?? {
            instanceId: battleCard.instanceId
          }),
          destination: bulkDestination
        };
      });
      return nextActions;
    });
  }

  function createRequests(): DeckBrowserRequest[] {
    return actions
      .filter((action) => action.destination !== "none")
      .map((action) => ({
        cardInstanceId: action.instanceId,
        destination: action.destination,
        soulTargetInstanceId: action.soulTargetInstanceId,
        visibility: action.soulVisibility
      }));
  }

  return (
    <BattlePopup
      title={title}
      description={description}
      size="fullscreen"
      onClose={onClose}
      lightBackdrop
      className="bf-deck-browser-popup"
      contentClassName="bf-deck-browser-content"
      footer={
        <>
          <button type="button" onClick={onClose}>
            キャンセル
          </button>
          {canExecute && (
            <button
              type="button"
              disabled={selectedCards.length === 0 || hasInvalidSoulAction}
              onClick={() => onExecute(createRequests())}
            >
              実行
            </button>
          )}
        </>
      }
    >
        <div className="bf-deck-browser-pager">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            前へ
          </button>
          <span>
            {page + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount - 1}
            onClick={() =>
              setPage((current) => Math.min(pageCount - 1, current + 1))
            }
          >
            次へ
          </button>
        </div>

        <div className="bf-deck-browser-summary" aria-live="polite">
          <span>山札：{cards.length}枚</span>
          <span>
            ページ：{page + 1} / {pageCount}
          </span>
          <span>選択中：{selectedCards.length}枚</span>
          <span>未指定：{unspecifiedCount}枚</span>
        </div>

        <div className="bf-deck-browser-grid">
          {pageCards.map((battleCard, index) => {
            const card = cardMap.get(battleCard.cardId);
            const isSelected = selectedIds.includes(battleCard.instanceId);
            if (!card) return null;

            return (
              <button
                type="button"
                className={`bf-deck-browser-card${isSelected ? " is-selected" : ""}${!canSelectCards ? " is-readonly" : ""}`}
                key={battleCard.instanceId}
                onClick={() => toggleCard(battleCard.instanceId)}
              >
                <span className="bf-deck-browser-order">
                  {page * DECK_BROWSER_PAGE_SIZE + index + 1}
                </span>
                <BoardCard
                  card={card}
                  images={imagesByCard.get(card.id) ?? []}
                  selectedImageId={battleCard.selectedImageId}
                  isPublic
                  variant="board"
                />
                <strong>{card.name}</strong>
              </button>
            );
          })}
          {cards.length === 0 && (
            <p className="bf-deck-browser-empty">表示できるカードはありません。</p>
          )}
        </div>

        {canEditDestinations && (
          <section className="bf-deck-browser-selected" aria-label="選択済みカード">
            <header className="bf-deck-browser-selected-header">
              <div>
                <h3>選択済みカード</h3>
                <p>
                  選択中：{selectedCards.length}枚 / 未指定：{unspecifiedCount}枚
                </p>
              </div>
              <div className="bf-deck-browser-bulk">
                <label>
                  一括移動先
                  <select
                    value={bulkDestination}
                    onChange={(event) =>
                      setBulkDestination(
                        event.target.value as BattleDestination
                      )
                    }
                  >
                    {availableDestinations.map((destination) => (
                      <option key={destination.id} value={destination.id}>
                        {destination.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={selectedCards.length === 0}
                  onClick={applyBulkDestination}
                >
                  選択中カードへ適用
                </button>
              </div>
            </header>
            {selectedCards.length === 0 ? (
              <p>カードを選択してください。</p>
            ) : (
              selectedCards.map((battleCard) => {
                const action =
                  actionsById[battleCard.instanceId] ?? {
                    instanceId: battleCard.instanceId,
                    destination: "none" as const
                  };

                return (
                  <article
                    className="bf-deck-browser-selected-row"
                    key={battleCard.instanceId}
                  >
                    <strong>{getCardName(cardMap, battleCard)}</strong>
                    <label>
                      移動先
                      <select
                        value={action.destination}
                        onChange={(event) =>
                          updateAction(battleCard.instanceId, (current) => ({
                            ...current,
                            destination: event.target
                              .value as BattleDestination
                          }))
                        }
                      >
                        {availableDestinations.map((destination) => (
                          <option key={destination.id} value={destination.id}>
                            {destination.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {action.destination === "soul" && (
                      <>
                        <label>
                          ソウル先
                          <select
                            value={action.soulTargetInstanceId ?? ""}
                            onChange={(event) =>
                              updateAction(battleCard.instanceId, (current) => ({
                                ...current,
                                soulTargetInstanceId:
                                  event.target.value || undefined
                              }))
                            }
                          >
                            <option value="">選択してください</option>
                            {soulCandidates.map((candidate) => (
                              <option
                                key={candidate.instanceId}
                                value={candidate.instanceId}
                              >
                                {getCardName(cardMap, candidate)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          向き
                          <select
                            value={action.soulVisibility ?? "public"}
                            onChange={(event) =>
                              updateAction(battleCard.instanceId, (current) => ({
                                ...current,
                                soulVisibility: event.target.value as
                                  | "public"
                                  | "face_down"
                              }))
                            }
                          >
                            <option value="public">表向き</option>
                            <option value="face_down">裏向き</option>
                          </select>
                        </label>
                      </>
                    )}
                  </article>
                );
              })
            )}
          </section>
        )}
    </BattlePopup>
  );
}
