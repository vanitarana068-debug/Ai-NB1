/**
 * Client side of the Razorpay flow. This asks the server to create an order
 * (priced from the database), opens the Razorpay Checkout widget, and then asks
 * the server to verify the signature Razorpay hands back. It resolves ok only
 * once that signature is verified — the caller then writes the order as usual.
 *
 * The Checkout widget itself offers cards, UPI, EMI, wallets and Apple/Google
 * Pay, according to what's enabled on the Razorpay account; none of that is
 * wired here.
 */

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

/** Whether a live Razorpay key is present. When false, checkout uses the demo path. */
export function isRazorpayConfigured(): boolean {
  return false; // Demo mode: checkout displays payment methods but does not charge
}

export type RazorpayItem = { slug: string; quantity: number };

export type RazorpayPrefill = { name?: string; email?: string; contact?: string };

export type RazorpayResult = { ok: true } | { ok: false; error: string };

type CreatedOrder = { orderId: string; amount: number; currency: string; keyId: string };

type RazorpayHandlerResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  prefill?: RazorpayPrefill | undefined;
  handler: (response: RazorpayHandlerResponse) => void;
  modal?: { ondismiss?: () => void };
};

type RazorpayInstance = {
  open: () => void;
  on: (event: "payment.failed", cb: (response: unknown) => void) => void;
};

type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let scriptPromise: Promise<boolean> | null = null;

/** Inject the Checkout script once; resolves false if it can't load. */
function loadCheckoutScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  scriptPromise ??= new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => {
      scriptPromise = null; // allow a later retry
      resolve(false);
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
}

async function createOrder(
  items: RazorpayItem[],
  deliverySpeed: "standard" | "express",
): Promise<CreatedOrder | { error: string }> {
  let response: Response;
  try {
    response = await fetch("/api/payments/razorpay/order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items, deliverySpeed }),
    });
  } catch {
    return { error: "Couldn't reach the payment service. Please try again." };
  }

  const data = (await response.json().catch(() => null)) as
    (CreatedOrder & { error?: string }) | null;

  if (!response.ok || data === null || typeof data.orderId !== "string") {
    return { error: data?.error ?? "Couldn't start the payment. Please try again." };
  }
  return data;
}

async function verifyPayment(response: RazorpayHandlerResponse): Promise<RazorpayResult> {
  let verifyResponse: Response;
  try {
    verifyResponse = await fetch("/api/payments/razorpay/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(response),
    });
  } catch {
    return {
      ok: false,
      error: "We couldn't confirm your payment. Please contact us before retrying.",
    };
  }

  const data = (await verifyResponse.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
  } | null;

  if (verifyResponse.ok && data?.ok === true) return { ok: true };
  return { ok: false, error: data?.error ?? "Your payment could not be verified." };
}

/**
 * Runs the whole Checkout round trip and resolves once the outcome is known:
 * ok on a verified payment, otherwise an error (provider unreachable, payment
 * failed, or the shopper closed the widget).
 */
export async function payWithRazorpay(input: {
  items: RazorpayItem[];
  deliverySpeed: "standard" | "express";
  prefill?: RazorpayPrefill;
}): Promise<RazorpayResult> {
  const order = await createOrder(input.items, input.deliverySpeed);
  if ("error" in order) return { ok: false, error: order.error };

  const ready = await loadCheckoutScript();
  if (!ready || !window.Razorpay) {
    return {
      ok: false,
      error: "The payment widget couldn't load. Check your connection and retry.",
    };
  }

  return new Promise<RazorpayResult>((resolve) => {
    let settled = false;
    const settle = (result: RazorpayResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const razorpay = new window.Razorpay!({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: "Northbridge",
      description: "Order payment",
      prefill: input.prefill,
      handler: (response) => {
        void verifyPayment(response).then(settle);
      },
      modal: {
        ondismiss: () => settle({ ok: false, error: "Payment cancelled." }),
      },
    });

    razorpay.on("payment.failed", () => {
      settle({ ok: false, error: "The payment failed. No money was taken — please try again." });
    });

    razorpay.open();
  });
}
