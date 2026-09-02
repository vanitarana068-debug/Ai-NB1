import type { ResolvedLine } from "./cart";
import type {
  DeliverySpeed,
  Order,
  OrderItem,
  PaymentMethodName,
  PlaceOrderResult,
} from "./database.types";
import { describeError, supabase } from "./supabase";

export type OrderWithItems = Order & { items: OrderItem[] };

export type PlaceOrderInput = {
  fullName: string;
  email: string;
  address1: string;
  address2: string;
  city: string;
  postcode: string;
  deliverySpeed: DeliverySpeed;
  paymentMethod: PaymentMethodName;
  /** A display string only — "Visa ending 4242", a UPI ID, or a wallet name. */
  paymentDetail: string;
  lines: ResolvedLine[];
};

/**
 * Hands the basket to the place_order() function, which checks stock,
 * decrements it, writes the order and its lines, and records the ledger — all
 * in one transaction. Prices and totals come back from the database rather
 * than the browser, so the client cannot name its own price.
 */
export async function placeOrder(
  input: PlaceOrderInput,
): Promise<{ order: PlaceOrderResult; error: null } | { order: null; error: string }> {
  const { data, error } = await supabase.rpc("place_order", {
    p_full_name: input.fullName,
    p_email: input.email,
    p_address1: input.address1,
    p_address2: input.address2 === "" ? null : input.address2,
    p_city: input.city,
    p_postcode: input.postcode,
    p_delivery_speed: input.deliverySpeed,
    p_payment_method: input.paymentMethod,
    p_payment_detail: input.paymentDetail === "" ? null : input.paymentDetail,
    p_items: input.lines.map((line) => ({
      slug: line.product.slug,
      quantity: line.quantity,
    })),
  });

  if (error) return { order: null, error: describeError(error) };

  const order = data?.[0];
  if (!order) return { order: null, error: "The order didn't go through. Please try again." };

  return { order, error: null };
}

/** Every order belonging to the signed-in user, newest first. */
export async function fetchOrders(): Promise<{ orders: OrderWithItems[]; error: string | null }> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });

  if (error) return { orders: [], error: describeError(error) };

  const orders = (data ?? []).map((row) => {
    const { order_items: items, ...order } = row as Order & { order_items: OrderItem[] };
    return { ...order, items: items ?? [] };
  });

  return { orders, error: null };
}
