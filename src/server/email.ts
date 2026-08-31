import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database, Order, OrderItem } from "@/lib/database.types";

/**
 * Order-confirmation email via Brevo's transactional API.
 *
 * Server-side and authoritative: given only an order reference, it re-reads the
 * order (and its items) with the service-role key and emails the address stored
 * ON THE ORDER. The client never supplies the recipient or the body, so a
 * tampered request can't send mail to an arbitrary address.
 *
 * Best-effort, exactly like the Claude billing recorder: if Brevo or the
 * service key isn't configured it quietly no-ops, and it never throws into the
 * caller — the shopper already has their confirmation screen.
 */

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

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

/** Orders are charged in INR, so format the stored minor units as rupees. */
function formatInr(pence: number): string {
  return `₹${(pence / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(order: Order, items: OrderItem[]): string {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;color:#111827;">${escapeHtml(item.product_name)}
            <span style="color:#6b7280;"> × ${item.quantity}</span></td>
          <td style="padding:8px 0;text-align:right;color:#111827;white-space:nowrap;">
            ${formatInr(item.line_total_pence)}</td>
        </tr>`,
    )
    .join("");

  const firstName = escapeHtml(order.full_name.split(" ")[0] ?? "");

  return `<!doctype html>
<html><body style="margin:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <h1 style="font-size:20px;color:#111827;margin:0 0 4px;">Order confirmed</h1>
    <p style="color:#374151;">Thanks ${firstName} — we've received your order.</p>
    <p style="display:inline-block;background:#f3f4f6;border-radius:6px;padding:6px 10px;
       font-family:monospace;color:#111827;">${escapeHtml(order.reference)}</p>
    <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px;">
      ${rows}
      <tr><td colspan="2" style="border-top:1px solid #e5e7eb;padding-top:8px;"></td></tr>
      <tr>
        <td style="color:#6b7280;">Delivery
          (${order.delivery_speed === "express" ? "Express" : "Standard"})</td>
        <td style="text-align:right;color:#111827;">${formatInr(order.shipping_pence)}</td>
      </tr>
      <tr>
        <td style="padding-top:6px;font-weight:bold;color:#111827;">Total</td>
        <td style="padding-top:6px;text-align:right;font-weight:bold;color:#111827;">
          ${formatInr(order.total_pence)}</td>
      </tr>
    </table>
    <p style="color:#374151;margin-top:16px;">
      Delivering to: ${escapeHtml(order.address1)}${
        order.address2 ? `, ${escapeHtml(order.address2)}` : ""
      }, ${escapeHtml(order.city)} ${escapeHtml(order.postcode)}.
    </p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Northbridge</p>
  </div>
</body></html>`;
}

/** Look the order up authoritatively and email the address recorded on it. */
export async function sendOrderConfirmation(env: unknown, reference: string): Promise<void> {
  const apiKey = readEnv(env, "BREVO_API_KEY");
  const senderEmail = readEnv(env, "BREVO_SENDER_EMAIL");
  if (apiKey === undefined || senderEmail === undefined) return; // not configured → no-op

  const client = serviceClient(env);
  if (client === null) return;

  try {
    const { data, error } = await client
      .from("orders")
      .select("*, order_items(*)")
      .eq("reference", reference)
      .maybeSingle();

    if (error) {
      console.error("order email lookup failed", error);
      return;
    }
    if (data === null) return; // unknown reference — nothing to send

    const { order_items: items, ...order } = data as Order & { order_items: OrderItem[] };
    const senderName = readEnv(env, "BREVO_SENDER_NAME") ?? "Northbridge";

    const response = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: order.email, name: order.full_name }],
        subject: `Your Northbridge order ${order.reference}`,
        htmlContent: buildHtml(order, items ?? []),
      }),
    });

    if (!response.ok) {
      console.error("brevo send failed", response.status, await response.text());
    }
  } catch (error) {
    console.error("sendOrderConfirmation threw", error);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/** POST /api/orders/email — { reference }. Fire-and-forget from the client. */
export async function handleOrderEmail(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Expected a JSON body." }, 400);
  }

  const reference = (payload as Record<string, unknown>)?.["reference"];
  if (typeof reference !== "string" || reference === "") {
    return json({ error: "A reference is required." }, 400);
  }

  await sendOrderConfirmation(env, reference);
  return json({ ok: true });
}
