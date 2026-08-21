import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatPrice } from "@/data/products";
import { FREE_DELIVERY_THRESHOLD, useCart } from "@/lib/cart";

export const Route = createFileRoute("/cart")({
  component: CartPage,
  head: () => ({
    meta: [{ title: "Your basket — Northbridge" }],
  }),
});

function CartPage() {
  const { resolved, subtotal, delivery, total, count, hydrated, setQuantity, remove, clear } =
    useCart();
  const remaining = FREE_DELIVERY_THRESHOLD - subtotal;

  // The basket lives in localStorage, so there is nothing meaningful to render
  // until the browser has restored it.
  if (!hydrated) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-8 h-40 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (resolved.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <div className="rounded-full bg-muted p-5">
            <ShoppingBag className="size-8 text-muted-foreground" />
          </div>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Your basket is empty</h1>
          <p className="mt-2 text-muted-foreground">
            Once you add something it will show up here, and stay put if you close the tab.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link to="/products">
              Start shopping
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Your basket</h1>
      <p className="mt-2 text-muted-foreground">
        {count} {count === 1 ? "item" : "items"}
      </p>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row">
        <div className="min-w-0 flex-1">
          <ul className="divide-y rounded-xl border">
            {resolved.map((line) => (
              <li key={line.product.slug} className="flex flex-col gap-4 p-5 sm:flex-row">
                <Link
                  to="/products/$slug"
                  params={{ slug: line.product.slug }}
                  className="size-28 shrink-0 overflow-hidden rounded-lg border bg-muted"
                >
                  <img
                    src={line.product.image}
                    alt={line.product.name}
                    className="size-full object-cover"
                  />
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {line.product.brand}
                      </p>
                      <h2 className="mt-1 font-medium">
                        <Link
                          to="/products/$slug"
                          params={{ slug: line.product.slug }}
                          className="hover:underline"
                        >
                          {line.product.name}
                        </Link>
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatPrice(line.product.price)} each
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatPrice(line.lineTotal)}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-4">
                    <div className="flex items-center rounded-md border">
                      <button
                        type="button"
                        aria-label={`Decrease quantity of ${line.product.name}`}
                        className="cursor-pointer px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => setQuantity(line.product.slug, line.quantity - 1)}
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="min-w-9 text-center text-sm tabular-nums">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label={`Increase quantity of ${line.product.name}`}
                        disabled={line.quantity >= line.product.stock}
                        className="cursor-pointer px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => setQuantity(line.product.slug, line.quantity + 1)}
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => remove(line.product.slug)}
                      className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex justify-between">
            <Button asChild variant="ghost">
              <Link to="/products">Continue shopping</Link>
            </Button>
            <Button variant="ghost" onClick={clear} className="text-muted-foreground">
              Empty basket
            </Button>
          </div>
        </div>

        {/* Summary */}
        <aside className="lg:w-80 lg:shrink-0">
          <div className="rounded-xl border p-6">
            <h2 className="font-semibold">Order summary</h2>

            {remaining > 0 && (
              <p className="mt-4 rounded-md bg-muted p-3 text-xs text-muted-foreground">
                Add {formatPrice(remaining)} more to qualify for free delivery.
              </p>
            )}

            <dl className="mt-4 flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivery</dt>
                <dd className="tabular-nums">{delivery === 0 ? "Free" : formatPrice(delivery)}</dd>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatPrice(total)}</dd>
              </div>
            </dl>

            <Button asChild size="lg" className="mt-6 w-full">
              <Link to="/checkout">
                Checkout
                <ArrowRight />
              </Link>
            </Button>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              VAT included. No payment is actually taken.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
