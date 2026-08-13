import { BATTLE_ABILITY_DEFINITIONS } from "@/lib/battle/abilities/battleAbilityDefinitions";
import { BATTLE_ABILITY_IDS } from "@/lib/battle/abilities/abilityTypes";

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function generateBattleAbilityRegistrySeedSql() {
  const values = BATTLE_ABILITY_IDS.map((abilityId) => {
    const definition = BATTLE_ABILITY_DEFINITIONS[abilityId];
    return `  (
    ${sqlString(definition.label)},
    ${sqlString(definition.id)},
    ${sqlString(definition.databaseDescription)},
    '{}'::jsonb,
    true
  )`;
  }).join(",\n");

  return `begin;

insert into public.abilities (
  name,
  behavior_key,
  description,
  params,
  is_active
)
values
${values}
on conflict (behavior_key) do update set
  name = excluded.name,
  description = excluded.description,
  params = excluded.params,
  is_active = excluded.is_active,
  updated_at = now();

commit;`;
}

export function generateBattleAbilityRegistryPostcheckSql() {
  const behaviorKeys = BATTLE_ABILITY_IDS.map((abilityId) => `  ${sqlString(abilityId)}`).join(",\n");

  return `select
  behavior_key,
  name,
  is_active
from public.abilities
where behavior_key in (
${behaviorKeys}
)
order by behavior_key;`;
}
