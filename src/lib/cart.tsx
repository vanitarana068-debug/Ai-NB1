import * as React from "react";

import { getProduct, type Product } from "@/data/products";

const STORAGE_KEY = "northbridge.cart.v1";
const FREE_DELIVERY_THRESHOLD = 5000; // pence
const DELIVERY_FEE = 499; // pence

export type CartLine = {
  slug: string;
  quantity: number;
};

/** A cart line joined to its product record, ready to render. */
export type ResolvedLine = {
  product: Product;
  quantity: number;
  lineTotal: number;
};

type CartContextValue = {
  lines: CartLine[];
  resolved: ResolvedLine[];
  count: number;
  subtotal: number;
  delivery: number;
  total: number;
  /** False until the browser has restored the persisted cart. */
  hydrated: boolean;
  add: (slug: string, quantity?: number) => void;
  setQuantity: (slug: string, quantity: number) => void;
  remove: (slug: string) => void;
  clear: () => void;
};

const CartContext = React.createContext<CartContextValue | null>(null);

function readStoredCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((entry): CartLine[] => {
      if (typeof entry !== "object" || entry === null) return [];
      const slug: unknown = (entry as Record<string, unknown>)["slug"];
      const quantity: unknown = (entry as Record<string, unknown>)["quantity"];
      if (typeof slug !== "string" || typeof quantity !== "number") return [];
      // Drop anything that no longer exists in the catalogue.
      if (!getProduct(slug)) return [];
      return [{ slug, quantity: Math.max(1, Math.floor(quantity)) }];
    });
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  // Always start empty so the server and the first client render agree; the
  // stored cart is folded in after mount.
  const [lines, setLines] = React.useState<CartLine[]>([]);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setLines(readStoredCart());
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // A full or blocked storage quota shouldn't break the page.
    }
  }, [lines, hydrated]);

  const add = React.useCallback((slug: string, quantity = 1) => {
    const product = getProduct(slug);
    if (!product) return;

    setLines((current) => {
      const existing = current.find((line) => line.slug === slug);
      if (!existing) {
        return [...current, { slug, quantity: Math.min(quantity, product.stock) }];
      }
      return current.map((line) =>
        line.slug === slug
          ? { ...line, quantity: Math.min(line.quantity + quantity, product.stock) }
          : line,
      );
    });
  }, []);

  const setQuantity = React.useCallback((slug: string, quantity: number) => {
    const product = getProduct(slug);
    if (!product) return;

    setLines((current) => {
      if (quantity <= 0) return current.filter((line) => line.slug !== slug);
      return current.map((line) =>
        line.slug === slug ? { ...line, quantity: Math.min(quantity, product.stock) } : line,
      );
    });
  }, []);

  const remove = React.useCallback((slug: string) => {
    setLines((current) => current.filter((line) => line.slug !== slug));
  }, []);

  const clear = React.useCallback(() => {
    setLines([]);
  }, []);

  const value = React.useMemo<CartContextValue>(() => {
    const resolved = lines.flatMap((line): ResolvedLine[] => {
      const product = getProduct(line.slug);
      if (!product) return [];
      return [{ product, quantity: line.quantity, lineTotal: product.price * line.quantity }];
    });

    const count = resolved.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = resolved.reduce((sum, line) => sum + line.lineTotal, 0);
    const delivery = subtotal === 0 || subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;

    return {
      lines,
      resolved,
      count,
      subtotal,
      delivery,
      total: subtotal + delivery,
      hydrated,
      add,
      setQuantity,
      remove,
      clear,
    };
  }, [lines, hydrated, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = React.useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside a <CartProvider>");
  return context;
}

export { FREE_DELIVERY_THRESHOLD, DELIVERY_FEE };
