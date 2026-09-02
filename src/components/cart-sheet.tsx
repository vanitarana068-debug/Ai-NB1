import { Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatPrice } from "@/data/products";
import { FREE_DELIVERY_THRESHOLD, useCart } from "@/lib/cart";

type CartSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CartSheet({ open, onOpenChange }: CartSheetProps) {
  const { resolved, subtotal, delivery, total, count, setQuantity, remove } = useCart();
  const remaining = FREE_DELIVERY_THRESHOLD - subtotal;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-6">
          <SheetTitle>Your basket</SheetTitle>
          <SheetDescription>
            {count === 0
              ? "Nothing here yet."
              : `${count} ${count === 1 ? "item" : "items"} ready to check out.`}
          </SheetDescription>
        </SheetHeader>

        {resolved.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="rounded-full bg-muted p-4">
              <ShoppingBag className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Add something from the shop and it will appear here.
            </p>
            <Button asChild onClick={() => onOpenChange(false)}>
              <Link to="/products">Browse the shop</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6">
              <ul className="flex flex-col gap-5">
                {resolved.map((line) => (
                  <li key={line.product.slug} className="flex gap-4">
                    <Link
                      to="/products/$slug"
                      params={{ slug: line.product.slug }}
                      onClick={() => onOpenChange(false)}
                      className="size-20 shrink-0 overflow-hidden rounded-lg border bg-muted"
                    >
                      <img
                        src={line.product.image}
                        alt={line.product.name}
                        className="size-full object-cover"
                      />
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to="/products/$slug"
                          params={{ slug: line.product.slug }}
                          onClick={() => onOpenChange(false)}
                          className="truncate text-sm font-medium hover:underline"
                        >
                          {line.product.name}
                        </Link>
                        <button
                          type="button"
                          onClick={() => remove(line.product.slug)}
                          aria-label={`Remove ${line.product.name}`}
                          className="shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>

                      <p className="text-xs text-muted-foreground">{line.product.brand}</p>

                      <div className="mt-auto flex items-center justify-between gap-2">
                        <div className="flex items-center rounded-md border">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            className="cursor-pointer px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
                            onClick={() => setQuantity(line.product.slug, line.quantity - 1)}
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="min-w-8 text-center text-sm tabular-nums">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            disabled={line.quantity >= line.product.stock}
                            className="cursor-pointer px-2 py-1 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={() => setQuantity(line.product.slug, line.quantity + 1)}
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatPrice(line.lineTotal)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t bg-muted/30 p-6">
              {remaining > 0 && (
                <p className="mb-3 rounded-md bg-background p-2.5 text-center text-xs text-muted-foreground">
                  Spend {formatPrice(remaining)} more for free delivery
                </p>
              )}

              <dl className="flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Delivery</dt>
                  <dd className="tabular-nums">
                    {delivery === 0 ? "Free" : formatPrice(delivery)}
                  </dd>
                </div>
                <Separator className="my-1.5" />
                <div className="flex justify-between text-base font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatPrice(total)}</dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-col gap-2">
                <Button asChild size="lg" onClick={() => onOpenChange(false)}>
                  <Link to="/checkout">Checkout</Link>
                </Button>
                <Button asChild variant="outline" onClick={() => onOpenChange(false)}>
                  <Link to="/cart">View full basket</Link>
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
