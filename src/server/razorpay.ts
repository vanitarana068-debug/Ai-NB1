import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

/**
 * Razorpay payment endpoints. Server-side only: the Key Secret never reaches the
 * browser. The Key ID is publishable and is handed back to the client so it can
 * open the Checkout widget.
 *
 * Flow:
 *   1. POST /api/payments/razorpay/order  — we price the basket from the database
 *      (never from the client) and create a Razorpay order for that amount.
 *   2. Razorpay Checkout collects the payment in the browser.
 *   3. POST /api/payments/razorpay/verify — we verify the signature Razorpay
 *      returned, proving the payment is real, before the order is written.
 *   4. (optional) POST /api/payments/razorpay/webhook — Razorpay's own callback,
 *      the authoritative confirmation, verified against the webhook secret.
 *
 * If the keys aren't configured every endpoint returns 503, and checkout falls
 * back to the demo path — exactly like the chat endpoint degrading to the FAQ.
 */

// Keep in step with place_order() / cart.tsx: free over ₹50, else ₹4.99 standard
// or ₹6.99 express. Amounts are integer minor units (paise, since we charge INR).
const FREE_DELIVERY_THRESHOLD = 5000;
const DELIVERY_FEE = 499;
const EXPRESS_FEE = 699;
const CURRENCY = "INR";

const RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders";

/** Cloudflare passes bindings on `env`; the node dev server uses `process.env`. */
function readEnv(env: unknown, key: string): string | undefined {
  if (env !== null && typeof env === "object") {
    const bound = (env as Record<string, unknown>)[key];
    if (typeof bound === "string" && bound !== "") return bound;
  }
  const fromProcess = typeof process === "undefined" ? undefined : process.env[key];
  return fromProcess === "" ? undefined : fromProcess;
}

type RazorpayCreds = { keyId: string; keySecret: string };

function readCreds(env: unknown): RazorpayCreds | null {
  const keyId = readEnv(env, "RAZORPAY_KEY_ID") ?? readEnv(env, "VITE_RAZORPAY_KEY_ID");
  const keySecret = readEnv(env, "RAZORPAY_KEY_SECRET");
  if (keyId === undefined || keySecret === undefined) return null;
  return { keyId, keySecret };
}

let cachedSupabase: SupabaseClient<Database> | null = null;

/** Anon client for reading public product prices. Null if URL/key are missing. */
function anonClient(env: unknown): SupabaseClient<Database> | null {
  if (cachedSupabase !== null) return cachedSupabase;
  const url = readEnv(env, "SUPABASE_URL") ?? readEnv(env, "VITE_SUPABASE_URL");
  const anonKey = readEnv(env, "VITE_SUPABASE_ANON_KEY");
  if (url === undefined || anonKey === undefined) return null;
  cachedSupabase = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedSupabase;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// ---------------------------------------------------------------------------
// Crypto helpers (Web Crypto, so this runs on Node and Cloudflare alike)
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Length-safe, non-short-circuiting comparison for signature checks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

// ---------------------------------------------------------------------------
// Pricing — the amount always comes from the database, never the client.
// ---------------------------------------------------------------------------

type BasketItem = { slug: string; quantity: number };

function parseItems(value: unknown): BasketItem[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const items: BasketItem[] = [];
  for (const entry of value) {
    if (entry === null || typeof entry !== "object") return null;
    const slug = (entry as Record<string, unknown>)["slug"];
    const quantity = (entry as Record<string, unknown>)["quantity"];
    if (typeof slug !== "string" || slug === "") return null;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0) return null;
    items.push({ slug, quantity });
  }
  return items;
}

async function priceBasket(
  env: unknown,
  items: BasketItem[],
  deliverySpeed: "standard" | "express",
): Promise<{ amount: number } | { error: string }> {
  const supabase = anonClient(env);
  if (supabase === null) return { error: "Store database is not configured." };

  const slugs = items.map((item) => item.slug);
  const { data, error } = await supabase
    .from("products")
    .select("slug, price_pence, active")
    .in("slug", slugs);

  if (error) return { error: "Couldn't price your basket. Please try again." };

  const priceBySlug = new Map(
    (data ?? []).filter((row) => row.active).map((row) => [row.slug, row.price_pence]),
  );

  let subtotal = 0;
  for (const item of items) {
    const price = priceBySlug.get(item.slug);
    if (price === undefined) return { error: "A product in your basket is no longer available." };
    subtotal += price * item.quantity;
  }

  const shipping =
    deliverySpeed === "express"
      ? EXPRESS_FEE
      : subtotal >= FREE_DELIVERY_THRESHOLD
        ? 0
        : DELIVERY_FEE;

  return { amount: subtotal + shipping };
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/** POST /api/payments/razorpay/order — create a Razorpay order, priced server-side. */
export async function handleCreateOrder(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const creds = readCreds(env);
  if (creds === null) return json({ error: "Payments are not configured." }, 503);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }

  const items = parseItems((payload as Record<string, unknown>)?.["items"]);
  if (items === null) return json({ error: "Send { items: [{ slug, quantity }] }." }, 400);

  const speedRaw = (payload as Record<string, unknown>)?.["deliverySpeed"];
  const deliverySpeed = speedRaw === "express" ? "express" : "standard";

  const priced = await priceBasket(env, items, deliverySpeed);
  if ("error" in priced) return json({ error: priced.error }, 400);

  const auth =
    typeof btoa === "function"
      ? btoa(`${creds.keyId}:${creds.keySecret}`)
      : Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64");

  let razorpayResponse: Response;
  try {
    razorpayResponse = await fetch(RAZORPAY_ORDERS_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: priced.amount,
        currency: CURRENCY,
        receipt: `nb-${Date.now()}`,
        notes: { source: "northbridge-checkout" },
      }),
    });
  } catch (error) {
    console.error("razorpay order request failed", error);
    return json({ error: "Couldn't reach the payment provider. Please try again." }, 502);
  }

  if (!razorpayResponse.ok) {
    const detail = await razorpayResponse.text();
    console.error("razorpay order rejected", razorpayResponse.status, detail);
    return json({ error: "The payment provider rejected the order." }, 502);
  }

  const order = (await razorpayResponse.json()) as { id?: string; amount?: number };
  if (typeof order.id !== "string") {
    return json({ error: "The payment provider returned an unexpected response." }, 502);
  }

  return json({
    orderId: order.id,
    amount: order.amount ?? priced.amount,
    currency: CURRENCY,
    keyId: creds.keyId,
  });
}

/** POST /api/payments/razorpay/verify — confirm the Checkout signature is genuine. */
export async function handleVerifyPayment(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const creds = readCreds(env);
  if (creds === null) return json({ error: "Payments are not configured." }, 503);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }

  const record = (payload ?? {}) as Record<string, unknown>;
  const orderId = record["razorpay_order_id"];
  const paymentId = record["razorpay_payment_id"];
  const signature = record["razorpay_signature"];

  if (
    typeof orderId !== "string" ||
    typeof paymentId !== "string" ||
    typeof signature !== "string"
  ) {
    return json({ ok: false, error: "Missing payment confirmation fields." }, 400);
  }

  const expected = await hmacSha256Hex(creds.keySecret, `${orderId}|${paymentId}`);
  if (!timingSafeEqual(expected, signature)) {
    return json({ ok: false, error: "Payment could not be verified." }, 400);
  }

  return json({ ok: true });
}

/**
 * POST /api/payments/razorpay/webhook — Razorpay's authoritative callback. The
 * signature is an HMAC of the raw request body with the webhook secret (a
 * different secret from the Key Secret). We acknowledge verified events with
 * 200; anything unverified gets 400 so Razorpay retries.
 */
export async function handleWebhook(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const webhookSecret = readEnv(env, "RAZORPAY_WEBHOOK_SECRET");
  if (webhookSecret === undefined) return json({ error: "Webhook is not configured." }, 503);

  const signature = request.headers.get("x-razorpay-signature");
  if (signature === null) return json({ error: "Missing signature." }, 400);

  // Verify over the exact bytes Razorpay signed, before parsing.
  const rawBody = await request.text();
  const expected = await hmacSha256Hex(webhookSecret, rawBody);
  if (!timingSafeEqual(expected, signature)) {
    return json({ error: "Webhook signature mismatch." }, 400);
  }

  // Verified. Fulfilment (marking the order paid) can hang off this later; for
  // now acknowledge so Razorpay stops retrying.
  return json({ ok: true });
}
