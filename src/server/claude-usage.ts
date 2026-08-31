import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

/**
 * Records what a Claude API call cost into public.claude_usage, through the
 * record_claude_usage() prepared endpoint.
 *
 * Server-side only. The table is locked down (RLS on, no policies), so writes
 * need the service-role key — never the anon key, and never the browser. If the
 * key isn't configured this quietly no-ops, exactly like the chat endpoint
 * falling back to the offline FAQ: the shop keeps working, it just doesn't bill.
 */

export type ClaudeUsageRecord = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  /** Where the call came from, e.g. "chat". Defaults to "chat" in the RPC. */
  source?: string;
  /** The signed-in shopper, when the server knows who it is. */
  userId?: string | null;
  meta?: Record<string, unknown> | null;
};

/** Cloudflare passes bindings on `env`; the node dev server uses `process.env`. */
function readEnv(env: unknown, key: string): string | undefined {
  if (env !== null && typeof env === "object") {
    const bound = (env as Record<string, unknown>)[key];
    if (typeof bound === "string" && bound !== "") return bound;
  }
  const fromProcess = typeof process === "undefined" ? undefined : process.env[key];
  return fromProcess === "" ? undefined : fromProcess;
}

let cached: SupabaseClient<Database> | null = null;

/** A service-role client, or null when the server isn't configured to bill. */
function serviceClient(env: unknown): SupabaseClient<Database> | null {
  if (cached !== null) return cached;

  const url = readEnv(env, "SUPABASE_URL") ?? readEnv(env, "VITE_SUPABASE_URL");
  const serviceKey = readEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  if (url === undefined || serviceKey === undefined) return null;

  cached = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/**
 * Best-effort: this must never throw into the request that produced the usage.
 * A failed write is logged and swallowed — the shopper already has their answer.
 */
export async function recordClaudeUsage(env: unknown, usage: ClaudeUsageRecord): Promise<void> {
  const client = serviceClient(env);
  if (client === null) return;

  try {
    const { error } = await client.rpc("record_claude_usage", {
      p_model: usage.model,
      p_input_tokens: usage.inputTokens,
      p_output_tokens: usage.outputTokens,
      p_cache_read_tokens: usage.cacheReadTokens ?? 0,
      p_cache_write_tokens: usage.cacheWriteTokens ?? 0,
      p_source: usage.source ?? "chat",
      p_user_id: usage.userId ?? null,
      p_meta: (usage.meta ?? null) as never,
    });
    if (error) console.error("record_claude_usage failed", error);
  } catch (error) {
    console.error("record_claude_usage threw", error);
  }
}
