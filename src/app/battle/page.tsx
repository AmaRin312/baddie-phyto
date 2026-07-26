import { Suspense } from "react";
import { BattleRoute } from "@/components/battle/BattleRoute";

export default function BattlePage() {
  return (
    <Suspense fallback={<main className="bf-battle-loading">Battleを準備しています。</main>}>
      <BattleRoute />
    </Suspense>
  );
}
