/**
 * Payment method catalogue, validation and wallet detection.
 *
 * This storefront has no payment provider behind it, so nothing here charges
 * anybody. What it does do is model the choice properly: each method knows
 * what it needs from the shopper, how to check it, and what to record against
 * the order. Wiring in a real provider means replacing authorisePayment() and
 * very little else.
 *
 * Card numbers never leave this module. Only the brand and last four digits
 * are handed back for storage — there is no PCI scope here and there should
 * not be one.
 */

export type PaymentMethodId = "card" | "upi" | "apple_pay" | "google_pay" | "paypal";

export type PaymentMethodKind = "form" | "wallet" | "redirect";

export type PaymentMethod = {
  id: PaymentMethodId;
  label: string;
  /** One line under the label in the picker. */
  blurb: string;
  kind: PaymentMethodKind;
  /** Card schemes or app names to list as small print. */
  accepts?: string;
};

export const paymentMethods: readonly PaymentMethod[] = [
  {
    id: "card",
    label: "Card",
    blurb: "Debit or credit, with 3-D Secure where your bank asks for it.",
    kind: "form",
    accepts: "Visa · Mastercard · American Express · RuPay",
  },
  {
    id: "upi",
    label: "UPI",
    blurb: "Pay from your UPI ID, or approve the request in your bank app.",
    kind: "form",
    accepts: "Google Pay · PhonePe · Paytm · BHIM",
  },
  {
    id: "apple_pay",
    label: "Apple Pay",
    blurb: "Confirm with Face ID or Touch ID. Nothing to type.",
    kind: "wallet",
  },
  {
    id: "google_pay",
    label: "Google Pay",
    blurb: "Pay with a card saved to your Google account.",
    kind: "wallet",
  },
  {
    id: "paypal",
    label: "PayPal",
    blurb: "You finish the payment on PayPal, then come back here.",
    kind: "redirect",
  },
] as const;

export function getPaymentMethod(id: PaymentMethodId): PaymentMethod {
  const method = paymentMethods.find((candidate) => candidate.id === id);
  // The id type makes this unreachable; the throw is here so a bad cast is loud.
  if (method === undefined) throw new Error(`Unknown payment method: ${id}`);
  return method;
}

// ---------------------------------------------------------------------------
// Card numbers
// ---------------------------------------------------------------------------

export type CardBrand = "visa" | "mastercard" | "amex" | "rupay" | "discover" | "unknown";

const brandLabels: Record<CardBrand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  rupay: "RuPay",
  discover: "Discover",
  unknown: "Card",
};

export function cardBrandLabel(brand: CardBrand): string {
  return brandLabels[brand];
}

/** Digits only, so grouping and pasted spaces do not matter. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function detectCardBrand(number: string): CardBrand {
  const digits = digitsOnly(number);
  if (/^4/.test(digits)) return "visa";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return "mastercard";
  // RuPay and Discover overlap in the 6 range, so the narrower prefixes have
  // to be tested first: 6521/6522 are RuPay inside Discover's 65, and 6011 is
  // Discover inside RuPay's 60.
  if (/^65(21|22)/.test(digits)) return "rupay";
  if (/^(6011|65|64[4-9])/.test(digits)) return "discover";
  if (/^(60|81|82)/.test(digits)) return "rupay";
  return "unknown";
}

/** Amex is 15 digits grouped 4-6-5; everything else here is 16 as 4-4-4-4. */
export function cardNumberLength(brand: CardBrand): number {
  return brand === "amex" ? 15 : 16;
}

export function cardSecurityCodeLength(brand: CardBrand): number {
  return brand === "amex" ? 4 : 3;
}

/** Groups the digits as the shopper types, so a long number stays readable. */
export function formatCardNumber(value: string): string {
  const brand = detectCardBrand(value);
  const digits = digitsOnly(value).slice(0, cardNumberLength(brand));
  const groups = brand === "amex" ? [4, 6, 5] : [4, 4, 4, 4];

  const parts: string[] = [];
  let cursor = 0;
  for (const size of groups) {
    if (cursor >= digits.length) break;
    parts.push(digits.slice(cursor, cursor + size));
    cursor += size;
  }
  return parts.join(" ");
}

/** The check digit every card scheme uses. Catches typos, not bad cards. */
export function passesLuhn(number: string): boolean {
  const digits = digitsOnly(number);
  if (digits.length === 0) return false;

  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits.charCodeAt(i) - 48;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

export function formatExpiry(value: string): string {
  const digits = digitsOnly(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
}

/** True when MM/YY parses and the card has not expired as of `now`. */
export function isExpiryValid(value: string, now: Date = new Date()): boolean {
  const digits = digitsOnly(value);
  if (digits.length !== 4) return false;

  const month = Number(digits.slice(0, 2));
  if (month < 1 || month > 12) return false;

  const year = 2000 + Number(digits.slice(2));
  // A card is good through the last day of its stated month.
  return new Date(year, month, 1) > now;
}

// ---------------------------------------------------------------------------
// UPI
// ---------------------------------------------------------------------------

/**
 * A UPI ID is handle@psp — NPCI allows letters, digits, dot, hyphen and
 * underscore in the handle, and letters only in the bank suffix.
 */
const UPI_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}@[a-zA-Z]{2,64}$/;

export function isUpiIdValid(value: string): boolean {
  return UPI_ID.test(value.trim());
}

// ---------------------------------------------------------------------------
// Wallet availability
//
// Apple Pay only exists in Safari on Apple hardware, and Google Pay needs the
// Payment Request API. Offering a button that cannot open a sheet is worse
// than not offering it, so both are detected rather than assumed.
// ---------------------------------------------------------------------------

type ApplePayWindow = Window & {
  ApplePaySession?: { canMakePayments?: () => boolean };
};

export function isApplePayAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (window as ApplePayWindow).ApplePaySession?.canMakePayments?.() === true;
  } catch {
    // canMakePayments() throws outside a secure context.
    return false;
  }
}

export function isGooglePayAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return typeof window.PaymentRequest === "function";
}

export function isMethodAvailable(id: PaymentMethodId): boolean {
  if (id === "apple_pay") return isApplePayAvailable();
  if (id === "google_pay") return isGooglePayAvailable();
  return true;
}

export function unavailableReason(id: PaymentMethodId): string | null {
  if (id === "apple_pay" && !isApplePayAvailable()) {
    return "Needs Safari on an iPhone, iPad or Mac with a card in Wallet.";
  }
  if (id === "google_pay" && !isGooglePayAvailable()) {
    return "This browser does not support Google Pay.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Validating and authorising a selection
// ---------------------------------------------------------------------------

/** Everything the shopper can type into a payment panel. */
export type PaymentDraft = {
  method: PaymentMethodId;
  cardNumber: string;
  cardName: string;
  cardExpiry: string;
  cardCvc: string;
  upiId: string;
};

export const emptyPaymentDraft: PaymentDraft = {
  method: "card",
  cardNumber: "",
  cardName: "",
  cardExpiry: "",
  cardCvc: "",
  upiId: "",
};

export type PaymentField =
  "method" | "cardNumber" | "cardName" | "cardExpiry" | "cardCvc" | "upiId";
export type PaymentErrors = Partial<Record<PaymentField, string>>;

export function validatePayment(draft: PaymentDraft): PaymentErrors {
  const errors: PaymentErrors = {};

  if (!isMethodAvailable(draft.method)) {
    errors.method = unavailableReason(draft.method) ?? "That method is not available here.";
    return errors;
  }

  if (draft.method === "card") {
    const brand = detectCardBrand(draft.cardNumber);
    const expected = cardNumberLength(brand);
    const digits = digitsOnly(draft.cardNumber);

    if (digits.length === 0) {
      errors.cardNumber = "Enter your card number";
    } else if (digits.length !== expected) {
      errors.cardNumber = `That is ${digits.length} digits, expected ${expected}`;
    } else if (!passesLuhn(digits)) {
      errors.cardNumber = "Check the number — a digit looks wrong";
    }

    if (draft.cardName.trim().length < 2) {
      errors.cardName = "Enter the name printed on the card";
    }

    if (!isExpiryValid(draft.cardExpiry)) {
      errors.cardExpiry =
        digitsOnly(draft.cardExpiry).length === 4 ? "That card has expired" : "MM / YY";
    }

    if (digitsOnly(draft.cardCvc).length !== cardSecurityCodeLength(brand)) {
      errors.cardCvc = `${cardSecurityCodeLength(brand)} digits`;
    }
  }

  if (draft.method === "upi" && !isUpiIdValid(draft.upiId)) {
    errors.upiId =
      draft.upiId.trim() === "" ? "Enter your UPI ID" : "That does not look like name@bank";
  }

  return errors;
}

/**
 * A short, safe description of how the order was paid for — this is what gets
 * stored and shown back. For a card that is the brand and last four digits;
 * the full number is deliberately dropped on the floor.
 */
export function describePayment(draft: PaymentDraft): string {
  if (draft.method === "card") {
    const digits = digitsOnly(draft.cardNumber);
    return `${cardBrandLabel(detectCardBrand(digits))} ending ${digits.slice(-4)}`;
  }
  if (draft.method === "upi") return draft.upiId.trim().toLowerCase();
  return getPaymentMethod(draft.method).label;
}

export type AuthorisationResult = { ok: true } | { ok: false; error: string };

/**
 * Stands in for the provider round trip: the wallet sheet, the UPI collect
 * request, the PayPal redirect. It resolves after a beat so the button's
 * pending state is real rather than decorative. Replace the body with a
 * provider SDK call and the rest of checkout keeps working unchanged.
 */
export async function authorisePayment(draft: PaymentDraft): Promise<AuthorisationResult> {
  const method = getPaymentMethod(draft.method);
  await new Promise((resolve) => setTimeout(resolve, method.kind === "form" ? 400 : 900));
  return { ok: true };
}
