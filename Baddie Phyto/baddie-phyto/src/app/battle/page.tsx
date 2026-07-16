import { Suspense } from "react";
import { BattleController } from "@/components/battle/BattleController";

export default function BattlePage() {
  return (
    <Suspense fallback={<main className="bf-battle-loading">Battleを準備しています。</main>}>
      <BattleController />
    </Suspense>
  );
}
