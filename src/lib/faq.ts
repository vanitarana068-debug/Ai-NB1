import { categories, formatPrice, products } from "@/data/products";
import { DELIVERY_FEE, FREE_DELIVERY_THRESHOLD } from "./cart";

export type FaqEntry = {
  id: string;
  question: string;
  answer: string;
  /** Extra words that should match this entry in the offline fallback. */
  keywords: string[];
};

const EXPRESS_FEE = 699;

/**
 * The shop's own policies. This is the only place they're written down for the
 * assistant, so it can't invent a returns window or a delivery price.
 */
export const faqs: FaqEntry[] = [
  {
    id: "delivery-cost",
    question: "How much is delivery?",
    answer: `Standard delivery is ${formatPrice(DELIVERY_FEE)} and takes 2 to 3 working days. It's free on orders over ${formatPrice(FREE_DELIVERY_THRESHOLD)}. Express delivery is ${formatPrice(EXPRESS_FEE)} and arrives the next working day if you order before 4pm.`,
    keywords: ["delivery", "shipping", "postage", "how long", "dispatch", "next day", "express"],
  },
  {
    id: "delivery-area",
    question: "Where do you ship from and to?",
    answer:
      "Everything ships from our warehouse in Manchester to addresses in the UK mainland. We don't currently ship outside the UK.",
    keywords: ["ship to", "international", "abroad", "uk", "manchester", "warehouse", "overseas"],
  },
  {
    id: "returns",
    question: "What's your returns policy?",
    answer:
      "You have 30 days from delivery to return anything for a full refund, and returns are free. The item needs to be in a resaleable condition with its accessories. Refunds land back on the original payment method within 5 working days of us receiving the parcel.",
    keywords: ["return", "refund", "send back", "money back", "exchange", "change my mind"],
  },
  {
    id: "warranty",
    question: "Is there a warranty?",
    answer:
      "Every product carries a two-year warranty covering manufacturing faults. It's on top of your statutory rights, and it doesn't cover accidental damage or wear and tear.",
    keywords: ["warranty", "guarantee", "broken", "faulty", "repair", "cover"],
  },
  {
    id: "track-order",
    question: "How do I track my order?",
    answer:
      "Sign in and open your account page — every order you've placed is listed there with its reference and current status. You'll also get an email when the parcel is dispatched.",
    keywords: ["track", "where is my order", "order status", "dispatched", "reference"],
  },
  {
    id: "account",
    question: "Do I need an account to buy something?",
    answer:
      "Yes. Adding to your basket and checking out both need an account, so your orders and delivery details stay with you. Creating one takes an email address and a password, and you'll need to confirm the email before your first sign-in.",
    keywords: ["account", "sign up", "register", "log in", "sign in", "password", "guest"],
  },
  {
    id: "payment",
    question: "What payment methods do you take?",
    answer:
      "This storefront is a demonstration, so no payment is taken and nothing is dispatched. Placing an order generates a reference and saves it to your account. A real deployment would wire this step up to a payment provider such as Stripe.",
    keywords: ["pay", "payment", "card", "visa", "mastercard", "paypal", "checkout", "stripe"],
  },
  {
    id: "stock",
    question: "Is an item in stock?",
    answer:
      "Stock counts on each product page are live. Anything showing 'Out of stock' can't be added to a basket, and low stock shows as 'Only N left'.",
    keywords: ["stock", "available", "in stock", "sold out", "back in", "availability"],
  },
  {
    id: "price-match",
    question: "Do you price match?",
    answer:
      "We don't run a price match. Reduced items show the previous price struck through so you can see the saving.",
    keywords: ["price match", "cheaper", "discount", "voucher", "promo", "sale", "deal"],
  },
  {
    id: "contact",
    question: "How do I get in touch?",
    answer:
      "The footer has our contact details. For anything about an order you've already placed, quote the reference from your account page and we can pick it up faster.",
    keywords: ["contact", "phone", "email", "speak to", "human", "support", "help"],
  },
];

/** The catalogue, priced and stock-checked, as plain text for the model. */
function catalogueSummary(): string {
  const byCategory = categories.map((category) => {
    const lines = products
      .filter((product) => product.category === category.id)
      .map((product) => {
        const was = product.wasPrice === undefined ? "" : ` (was ${formatPrice(product.wasPrice)})`;
        return `  - ${product.name} by ${product.brand} — ${formatPrice(product.price)}${was}, ${product.stock} in stock. ${product.tagline}`;
      });

    return `${category.name}: ${category.blurb}\n${lines.join("\n")}`;
  });

  return byCategory.join("\n\n");
}

/**
 * The full grounding text handed to the model as its system prompt. Kept
 * deterministic — no timestamps or random ordering — so it caches cleanly.
 */
export function buildKnowledgeBase(): string {
  const faqText = faqs.map((entry) => `Q: ${entry.question}\nA: ${entry.answer}`).join("\n\n");

  return `# Northbridge shop policies

${faqText}

# Catalogue

Prices include VAT. Stock figures below are from the catalogue; the product page is the live source.

${catalogueSummary()}`;
}

/**
 * Offline answer matching, used when no API key is configured. Scores each FAQ
 * against the question's words and returns the best entry above a threshold.
 */
export function matchFaq(question: string): FaqEntry | null {
  const asked = question.toLowerCase();
  const words = asked.split(/[^a-z0-9£]+/).filter((word) => word.length > 2);
  if (words.length === 0) return null;

  let best: { entry: FaqEntry; score: number } | null = null;

  for (const entry of faqs) {
    const haystack = `${entry.question} ${entry.keywords.join(" ")}`.toLowerCase();

    let score = 0;
    for (const keyword of entry.keywords) {
      if (asked.includes(keyword)) score += keyword.includes(" ") ? 3 : 2;
    }
    for (const word of words) {
      if (haystack.includes(word)) score += 1;
    }

    if (best === null || score > best.score) best = { entry, score };
  }

  return best !== null && best.score >= 2 ? best.entry : null;
}

/** Products whose name or brand appears in the question, for offline answers. */
export function matchProducts(question: string) {
  const asked = question.toLowerCase();
  return products.filter(
    (product) =>
      asked.includes(product.name.toLowerCase()) ||
      asked.includes(product.brand.toLowerCase()) ||
      product.name
        .toLowerCase()
        .split(" ")
        .some((part) => part.length > 3 && asked.includes(part)),
  );
}
