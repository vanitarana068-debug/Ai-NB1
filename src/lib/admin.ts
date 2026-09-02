import type { OrderStatus, ProductPriceHistory, ProductRow, StockMovement } from "./database.types";
import type { OrderWithItems } from "./orders";
import { describeError, supabase } from "./supabase";

/**
 * Merchant-side data access. Every read here leans on the admin SELECT policies
 * from supabase/migrations/0006_admin.sql, and every write goes through a
 * definer RPC that re-checks is_admin() server-side — so a non-admin who reached
 * these calls would get an empty list or a permission error, never a change.
 */

/** Every order in the shop, newest first, with its line items. */
export async function fetchAllOrders(): Promise<{
  orders: OrderWithItems[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });

  if (error) return { orders: [], error: describeError(error) };

  const orders = (data ?? []).map((row) => {
    const { order_items: items, ...order } = row as OrderWithItems & {
      order_items: OrderWithItems["items"];
    };
    return { ...order, items: items ?? [] };
  });

  return { orders, error: null };
}

/** Advance one order to a new fulfilment status. */
export async function setOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("set_order_status", {
    p_order_id: orderId,
    p_status: status,
  });
  return { error: error ? describeError(error) : null };
}

/** The full catalogue as the database holds it, including inactive products. */
export async function fetchAdminProducts(): Promise<{
  products: ProductRow[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name", { ascending: true });

  if (error) return { products: [], error: describeError(error) };
  return { products: data ?? [], error: null };
}

/** Set a product's stock to an absolute figure; the difference is ledgered. */
export async function setStock(
  slug: string,
  stock: number,
  note?: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("admin_set_stock", {
    p_slug: slug,
    p_stock: stock,
    p_note: note ?? null,
  });
  return { error: error ? describeError(error) : null };
}

export type ProductEdit = {
  pricePence: number;
  wasPricePence: number | null;
  lowStockAt: number;
  active: boolean;
};

/** Edit the catalogue numbers the database owns (price, was-price, threshold, listed). */
export async function updateProduct(
  slug: string,
  edit: ProductEdit,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("admin_update_product", {
    p_slug: slug,
    p_price_pence: edit.pricePence,
    p_was_price_pence: edit.wasPricePence,
    p_low_stock_at: edit.lowStockAt,
    p_active: edit.active,
  });
  return { error: error ? describeError(error) : null };
}

/** A product's stock ledger — sales, restocks and adjustments, newest first. */
export async function fetchStockMovements(
  slug: string,
): Promise<{ movements: StockMovement[]; error: string | null }> {
  const { data, error } = await supabase
    .from("stock_movements")
    .select("*")
    .eq("product_slug", slug)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return { movements: [], error: describeError(error) };
  return { movements: data ?? [], error: null };
}

/** A product's price-change history, newest first. */
export async function fetchPriceHistory(
  slug: string,
): Promise<{ history: ProductPriceHistory[]; error: string | null }> {
  const { data, error } = await supabase
    .from("product_price_history")
    .select("*")
    .eq("product_slug", slug)
    .order("changed_at", { ascending: false })
    .limit(50);

  if (error) return { history: [], error: describeError(error) };
  return { history: data ?? [], error: null };
}
