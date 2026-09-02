import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill both in.",
  );
}

// The same module is evaluated during SSR, where there is no localStorage to
// persist a session into and no URL fragment to read one out of.
const isBrowser = typeof window !== "undefined";

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
    detectSessionInUrl: isBrowser,
    storageKey: "northbridge.auth",
  },
});

/** Turns a Supabase/Postgres error into something worth showing a shopper. */
export function describeError(error: unknown): string {
  if (error === null || error === undefined) return "Something went wrong. Please try again.";

  const message =
    typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);

  if (/Invalid login credentials/i.test(message)) return "That email and password don't match.";
  if (/Email not confirmed/i.test(message)) {
    return "Confirm your email address first — check your inbox for the link.";
  }
  if (/User already registered/i.test(message)) return "An account with that email already exists.";
  if (/Password should be at least/i.test(message)) {
    return "Password is too short — use at least 6 characters.";
  }
  if (/schema cache|does not exist/i.test(message)) {
    return "The database isn't set up yet. Run the files in supabase/migrations, in order, in the Supabase SQL editor.";
  }
  return message;
}
