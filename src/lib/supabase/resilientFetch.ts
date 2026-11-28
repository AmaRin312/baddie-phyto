// Pause REST reads briefly after a service failure so parallel screens do not
// keep querying an unavailable PostgREST service. Writes are never retried.
export function createResilientFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  let unavailableUntil = 0;
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (!url.pathname.startsWith("/rest/v1/")) return baseFetch(input, init);

    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const isRead = method === "GET" || method === "HEAD";
    if (isRead && Date.now() < unavailableUntil) {
      throw new Error("データサービスが一時的に応答できません。少し待って再試行してください。");
    }
    // A client timeout on a write cannot establish whether it committed.
    if (!isRead) return baseFetch(input, init);

    const controller = new AbortController();
    const originalSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const abort = () => controller.abort(originalSignal?.reason);
    if (originalSignal?.aborted) abort();
    else originalSignal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(new Error("データ取得がタイムアウトしました。")), 15_000);
    try {
      const response = await baseFetch(input, { ...init, signal: controller.signal });
      if (response.status === 503 || response.status === 520 || response.status === 504) {
        unavailableUntil = Date.now() + 15_000;
      }
      return response;
    } finally {
      clearTimeout(timer);
      originalSignal?.removeEventListener("abort", abort);
    }
  };
}
