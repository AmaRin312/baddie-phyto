"use client";

import { useSearchParams } from "next/navigation";
import { BattleController } from "@/components/battle/BattleController";
import { BattleStartPanel } from "@/components/battle/BattleStartPanel";

export function BattleRoute() {
  const searchParams = useSearchParams();
  return searchParams.get("deckId") ? <BattleController /> : <BattleStartPanel />;
}
