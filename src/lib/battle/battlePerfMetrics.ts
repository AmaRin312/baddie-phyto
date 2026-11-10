type BattleSaveMeasurement = {
  label: string;
  startedAt: number;
  payloadBytes: number;
};

export function startBattleSaveMeasurement(label: string, payload: unknown) {
  if (typeof window === "undefined") return null;
  if (new URLSearchParams(window.location.search).get("battlePerf") !== "1") {
    return null;
  }

  return {
    label,
    startedAt: performance.now(),
    payloadBytes: new Blob([JSON.stringify(payload) ?? ""]).size
  } satisfies BattleSaveMeasurement;
}

export function finishBattleSaveMeasurement(
  measurement: BattleSaveMeasurement | null,
  failed: boolean,
  responsePayload?: unknown
) {
  if (!measurement) return;
  const responseBytes = responsePayload == null
    ? 0
    : new Blob([JSON.stringify(responsePayload) ?? ""]).size;
  console.info("[battle-perf] save", {
    target: measurement.label,
    payloadBytes: measurement.payloadBytes,
    responseBytes,
    elapsedMs: Math.round((performance.now() - measurement.startedAt) * 10) / 10,
    failed
  });
}
