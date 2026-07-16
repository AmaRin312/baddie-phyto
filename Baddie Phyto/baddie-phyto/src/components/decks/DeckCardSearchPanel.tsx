"use client";

import { useMemo, useState } from "react";
import {
  DECK_CARD_ATTRIBUTE_OPTIONS,
  DECK_CARD_ERA_OPTIONS,
  EMPTY_DECK_CARD_SEARCH_FILTERS,
  type DeckCardAttributeKey,
  type DeckCardEraKey,
  type DeckCardSearchFilters,
  type DeckCardSetOption
} from "@/lib/decks/deckCardSearch";
import {
  CARD_TYPE_OPTIONS,
  getCardTypeLabel,
  type CardType
} from "@/types/baddiePhyto";

type DeckCardSearchPanelProps = {
  filters: DeckCardSearchFilters;
  worlds: string[];
  races: string[];
  sets: DeckCardSetOption[];
  onChange: (filters: DeckCardSearchFilters) => void;
};

type SectionKey = "worlds" | "cardTypes" | "races" | "eras" | "attributes";

const SECTION_LABELS: Record<SectionKey, string> = {
  worlds: "ワールド",
  cardTypes: "カードタイプ",
  races: "種族",
  eras: "年代",
  attributes: "属性"
};

function toggleValue<T>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value];
}

function SearchSection(props: {
  sectionKey: SectionKey;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="dm-deck-search-section">
      <button type="button" onClick={props.onToggle}>
        <span>{props.open ? "▼" : "▶"} {SECTION_LABELS[props.sectionKey]}</span>
      </button>
      {props.open && <div className="dm-deck-search-section-body">{props.children}</div>}
    </section>
  );
}

export function DeckCardSearchPanel({
  filters,
  worlds,
  races,
  sets,
  onChange
}: DeckCardSearchPanelProps) {
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    worlds: false,
    cardTypes: false,
    races: false,
    eras: false,
    attributes: false
  });

  const setsByEra = useMemo(() => {
    const map = new Map<DeckCardEraKey, DeckCardSetOption[]>();
    sets.forEach((set) => {
      if (!filters.eras.includes(set.eraKey)) return;
      map.set(set.eraKey, [...(map.get(set.eraKey) ?? []), set]);
    });
    return map;
  }, [filters.eras, sets]);

  function setFilters(nextFilters: DeckCardSearchFilters) {
    onChange(nextFilters);
  }

  function setArray<K extends keyof DeckCardSearchFilters>(
    key: K,
    value: DeckCardSearchFilters[K]
  ) {
    setFilters({ ...filters, [key]: value });
  }

  function toggleSection(sectionKey: SectionKey) {
    setOpenSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey]
    }));
  }

  function toggleEra(era: DeckCardEraKey) {
    const nextEras = toggleValue(filters.eras, era);
    const activeEraSet = new Set(nextEras);
    const visibleSetIds = new Set(
      sets.filter((set) => activeEraSet.has(set.eraKey)).map((set) => set.id)
    );
    setFilters({
      ...filters,
      eras: nextEras,
      setIds: filters.setIds.filter((setId) => visibleSetIds.has(setId))
    });
  }

  const chips = [
    ...(filters.name.trim()
      ? [{ key: "name", label: filters.name.trim(), onRemove: () => setFilters({ ...filters, name: "" }) }]
      : []),
    ...filters.worlds.map((world) => ({
      key: `world:${world}`,
      label: world,
      onRemove: () => setArray("worlds", filters.worlds.filter((value) => value !== world))
    })),
    ...filters.cardTypes.map((cardType) => ({
      key: `type:${cardType}`,
      label: getCardTypeLabel(cardType),
      onRemove: () => setArray("cardTypes", filters.cardTypes.filter((value) => value !== cardType))
    })),
    ...filters.races.map((race) => ({
      key: `race:${race}`,
      label: race,
      onRemove: () => setArray("races", filters.races.filter((value) => value !== race))
    })),
    ...filters.eras.map((era) => ({
      key: `era:${era}`,
      label: DECK_CARD_ERA_OPTIONS.find((option) => option.value === era)?.label ?? era,
      onRemove: () => toggleEra(era)
    })),
    ...filters.setIds.map((setId) => {
      const set = sets.find((candidate) => candidate.id === setId);
      return {
        key: `set:${setId}`,
        label: set?.setCode ?? setId,
        onRemove: () => setArray("setIds", filters.setIds.filter((value) => value !== setId))
      };
    }),
    ...filters.attributes.map((attribute) => ({
      key: `attribute:${attribute}`,
      label:
        DECK_CARD_ATTRIBUTE_OPTIONS.find((option) => option.value === attribute)?.label ??
        attribute,
      onRemove: () =>
        setArray(
          "attributes",
          filters.attributes.filter((value) => value !== attribute)
        )
    }))
  ];

  return (
    <div className="dm-deck-search-panel">
      <label className="dm-deck-search-name">
        カード名
        <input
          value={filters.name}
          placeholder="カード名を入力"
          onChange={(event) => setFilters({ ...filters, name: event.target.value })}
        />
      </label>

      <SearchSection
        sectionKey="worlds"
        open={openSections.worlds}
        onToggle={() => toggleSection("worlds")}
      >
        <div className="dm-checkbox-grid">
          {worlds.map((world) => (
            <label key={world}>
              <input
                type="checkbox"
                checked={filters.worlds.includes(world)}
                onChange={() => setArray("worlds", toggleValue(filters.worlds, world))}
              />
              {world}
            </label>
          ))}
        </div>
      </SearchSection>

      <SearchSection
        sectionKey="cardTypes"
        open={openSections.cardTypes}
        onToggle={() => toggleSection("cardTypes")}
      >
        <div className="dm-checkbox-grid">
          {CARD_TYPE_OPTIONS.map((option) => (
            <label key={option.value}>
              <input
                type="checkbox"
                checked={filters.cardTypes.includes(option.value)}
                onChange={() =>
                  setArray("cardTypes", toggleValue<CardType>(filters.cardTypes, option.value))
                }
              />
              {option.label}
            </label>
          ))}
        </div>
      </SearchSection>

      <SearchSection
        sectionKey="races"
        open={openSections.races}
        onToggle={() => toggleSection("races")}
      >
        <div className="dm-checkbox-grid">
          {races.map((race) => (
            <label key={race}>
              <input
                type="checkbox"
                checked={filters.races.includes(race)}
                onChange={() => setArray("races", toggleValue(filters.races, race))}
              />
              {race}
            </label>
          ))}
        </div>
      </SearchSection>

      <SearchSection
        sectionKey="eras"
        open={openSections.eras}
        onToggle={() => toggleSection("eras")}
      >
        <div className="dm-checkbox-grid">
          {DECK_CARD_ERA_OPTIONS.map((option) => (
            <label key={option.value}>
              <input
                type="checkbox"
                checked={filters.eras.includes(option.value)}
                onChange={() => toggleEra(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>

        {filters.eras.length > 0 && (
          <div className="dm-deck-search-sets">
            <h4>収録元</h4>
            {DECK_CARD_ERA_OPTIONS.filter((option) =>
              filters.eras.includes(option.value)
            ).map((option) => (
              <div key={option.value} className="dm-deck-search-set-group">
                <b>【{option.label}】</b>
                <div className="dm-checkbox-grid">
                  {(setsByEra.get(option.value) ?? []).map((set) => (
                    <label key={set.id}>
                      <input
                        type="checkbox"
                        checked={filters.setIds.includes(set.id)}
                        onChange={() => setArray("setIds", toggleValue(filters.setIds, set.id))}
                      />
                      {set.setCode}
                    </label>
                  ))}
                  {(setsByEra.get(option.value) ?? []).length === 0 && (
                    <span className="dm-muted-text">収録元がありません。</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SearchSection>

      <SearchSection
        sectionKey="attributes"
        open={openSections.attributes}
        onToggle={() => toggleSection("attributes")}
      >
        <div className="dm-checkbox-grid">
          {DECK_CARD_ATTRIBUTE_OPTIONS.map((option) => (
            <label key={option.value}>
              <input
                type="checkbox"
                checked={filters.attributes.includes(option.value)}
                onChange={() =>
                  setArray(
                    "attributes",
                    toggleValue<DeckCardAttributeKey>(filters.attributes, option.value)
                  )
                }
              />
              {option.label}
            </label>
          ))}
        </div>
      </SearchSection>

      <div className="dm-deck-search-chips">
        <b>検索条件</b>
        {chips.length === 0 ? (
          <span className="dm-muted-text">指定なし</span>
        ) : (
          chips.map((chip) => (
            <button key={chip.key} type="button" onClick={chip.onRemove}>
              {chip.label} ×
            </button>
          ))
        )}
        {chips.length > 0 && (
          <button
            type="button"
            className="is-clear"
            onClick={() => setFilters(EMPTY_DECK_CARD_SEARCH_FILTERS)}
          >
            すべてクリア
          </button>
        )}
      </div>
    </div>
  );
}
