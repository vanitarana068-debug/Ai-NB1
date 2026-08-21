import * as React from "react";

import { supabase } from "./supabase";

export type StockLevel = {
  stock: number;
  lowStockAt: number;
  active: boolean;
};

/**
 * Live stock for the whole catalogue, keyed by slug. Readable signed out —
 * shoppers need to see what's available before they have an account.
 */
export async function fetchStockLevels(): Promise<Map<string, StockLevel>> {
  const { data, error } = await supabase
    .from("products")
    .select("slug, stock, low_stock_at, active");

  if (error || !data) return new Map();

  return new Map(
    data.map((row) => [
      row.slug,
      { stock: row.stock, lowStockAt: row.low_stock_at, active: row.active },
    ]),
  );
}

// A grid of product cards would otherwise fire one request per card, so the
// in-flight request is shared and the answer is cached until something
// invalidates it (placing an order, or a manual refresh).
let inFlight: Promise<Map<string, StockLevel>> | null = null;
let cached: Map<string, StockLevel> | null = null;
const subscribers = new Set<() => void>();

function loadStockLevels(): Promise<Map<string, StockLevel>> {
  if (cached !== null) return Promise.resolve(cached);
  inFlight ??= fetchStockLevels().then((levels) => {
    if (levels.size > 0) cached = levels;
    inFlight = null;
    return levels;
  });
  return inFlight;
}

/** Drops the cache and re-reads — call after stock has moved. */
export function invalidateStockLevels(): void {
  cached = null;
  inFlight = null;
  for (const notify of subscribers) notify();
}

/**
 * Stock levels for the catalogue. Null while loading, and null for good if the
 * products table hasn't been created yet — callers then fall back to the
 * figures baked into src/data/products.ts.
 */
export function useStockLevels(): {
  levels: Map<string, StockLevel> | null;
  refresh: () => void;
} {
  const [levels, setLevels] = React.useState<Map<string, StockLevel> | null>(cached);

  React.useEffect(() => {
    let active = true;

    const load = () => {
      void loadStockLevels().then((next) => {
        if (active && next.size > 0) setLevels(next);
      });
    };

    load();
    subscribers.add(load);

    return () => {
      active = false;
      subscribers.delete(load);
    };
  }, []);

  return { levels, refresh: invalidateStockLevels };
}

/** Live stock for one product, or the catalogue figure until it arrives. */
export function useStock(slug: string, fallback: number): number {
  const { levels } = useStockLevels();
  const level = levels?.get(slug);
  if (level === undefined) return fallback;
  return level.active ? level.stock : 0;
}
