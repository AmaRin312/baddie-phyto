import { BATTLE_ABILITY_DEFINITIONS } from "@/lib/battle/abilities/battleAbilityDefinitions";
import {
  BATTLE_ABILITY_IDS,
  type AbilityActionId,
  type AbilityId,
  type ExecutorId,
  type TargetDefinitionId
} from "@/lib/battle/abilities/abilityTypes";

export type AbilityRegistryIssueSeverity = "error" | "warning";

export type AbilityRegistryIssue = {
  severity: AbilityRegistryIssueSeverity;
  abilityId: AbilityId;
  message: string;
};

const SUPPORTED_ABILITY_ACTION_IDS = {
  use_face_down_soul: true,
  use_biri_kinata_face_down: true,
  use_hyakugan_yamigedo_composite: true
} satisfies Readonly<Record<AbilityActionId, true>>;

const SUPPORTED_TARGET_DEFINITION_IDS = {
  one_own_card_from_face_down_soul_sources: true,
  one_opponent_drop_card: true,
  matching_hyakugan_half_same_container: true
} satisfies Readonly<Record<TargetDefinitionId, true>>;

const SUPPORTED_EXECUTOR_IDS = {
  add_selected_card_to_source_soul_face_down: true,
  place_opponent_drop_card_to_opponent_center_face_down: true,
  place_hyakugan_composite: true
} satisfies Readonly<Record<ExecutorId, true>>;

export function validateBattleAbilityRegistry(): AbilityRegistryIssue[] {
  const definitionIssues = Object.entries(BATTLE_ABILITY_DEFINITIONS).flatMap(
    ([abilityId, definition]) => {
      const issues: AbilityRegistryIssue[] = [];

      if (abilityId !== definition.id) {
        issues.push({
          severity: "error",
          abilityId: definition.id,
          message: `Ability definition key "${abilityId}" does not match id "${definition.id}".`
        });
      }

      if (
        definition.actionId &&
        !SUPPORTED_ABILITY_ACTION_IDS[definition.actionId]
      ) {
        issues.push({
          severity: "error",
          abilityId: definition.id,
          message: `Ability action "${definition.actionId}" is not registered.`
        });
      }

      if (
        definition.targetDefinitionId &&
        !SUPPORTED_TARGET_DEFINITION_IDS[definition.targetDefinitionId]
      ) {
        issues.push({
          severity: "error",
          abilityId: definition.id,
          message: `Target definition "${definition.targetDefinitionId}" is not registered.`
        });
      }

      if (definition.executorId && !SUPPORTED_EXECUTOR_IDS[definition.executorId]) {
        issues.push({
          severity: "error",
          abilityId: definition.id,
          message: `Executor "${definition.executorId}" is not registered.`
        });
      }

      if (definition.executorId && !definition.actionId) {
        issues.push({
          severity: "warning",
          abilityId: definition.id,
          message: "Executor is set without an actionId. Confirm this is intentional."
        });
      }

      if (definition.targetDefinitionId && !definition.executorId) {
        issues.push({
          severity: "warning",
          abilityId: definition.id,
          message:
            "Target definition is set without an executor. Confirm this is intentional."
        });
      }

      if (definition.databaseDescription.trim().length === 0) {
        issues.push({
          severity: "warning",
          abilityId: definition.id,
          message: "Database description is empty."
        });
      }

      return issues;
    }
  );

  const missingDefinitionIssues = BATTLE_ABILITY_IDS.flatMap((abilityId) =>
    BATTLE_ABILITY_DEFINITIONS[abilityId]
      ? []
      : [
          {
            severity: "error" as const,
            abilityId,
            message: `Ability "${abilityId}" is listed in AbilityId but has no definition.`
          }
        ]
  );

  return [...definitionIssues, ...missingDefinitionIssues];
}
