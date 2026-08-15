import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

type SupabaseRetryOptions = {
  retries?: number;
  delayMs?: number;
};

function createSupabaseBrowserClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

export function getSupabaseClient(): SupabaseClient {
  if (!cachedClient) {
    cachedClient = createSupabaseBrowserClient();
  }

  return cachedClient;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function isSupabaseSchemaCacheError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return "code" in error && (error as { code?: string }).code === "PGRST002";
}

export function getSupabaseLoadErrorMessage(error: unknown, fallbackMessage: string): string {
  if (!isSupabaseSchemaCacheError(error)) {
    return fallbackMessage;
  }

  return "Supabase Data API の schema cache が応答していません。少し待って再読み込みするか、SQL で NOTIFY pgrst, 'reload schema'; を実行してください。";
}

export async function withSupabaseRetry<T>(
  operation: () => PromiseLike<T>,
  options?: SupabaseRetryOptions
): Promise<T> {
  const retries = options?.retries ?? 2;
  const delayMs = options?.delayMs ?? 350;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const result = await operation();
      const responseError =
        result &&
        typeof result === "object" &&
        "error" in result
          ? (result as { error?: unknown }).error
          : null;

      if (!isSupabaseSchemaCacheError(responseError)) {
        return result;
      }

      lastError = responseError;
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !isSupabaseSchemaCacheError(error)) {
        throw error;
      }
      await wait(delayMs * (attempt + 1));
      continue;
    }

    if (attempt >= retries) {
      return await operation();
    }

    await wait(delayMs * (attempt + 1));
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Supabase request failed.");
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property, receiver) {
    const client = getSupabaseClient();
    const value = Reflect.get(client, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
