import { Link } from "@tanstack/react-router";
import { LogIn, ShoppingCart } from "lucide-react";

import { StarRating } from "@/components/star-rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { discountPercent, formatPrice, type Product } from "@/data/products";
import { useStock } from "@/lib/inventory";
import { useBasketActions } from "@/lib/use-basket-actions";

export function ProductCard({ product }: { product: Product }) {
  const { addToBasket, signedIn, ready } = useBasketActions();
  const stock = useStock(product.slug, product.stock);
  const discount = discountPercent(product);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
      <Link
        to="/products/$slug"
        params={{ slug: product.slug }}
        className="relative block aspect-square overflow-hidden bg-muted"
      >
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {product.badge !== undefined && (
          <Badge className="absolute left-3 top-3 shadow-sm">{product.badge}</Badge>
        )}
        {stock === 0 ? (
          <Badge variant="destructive" className="absolute right-3 top-3 shadow-sm">
            Out of stock
          </Badge>
        ) : (
          stock <= 8 && (
            <Badge variant="secondary" className="absolute right-3 top-3 shadow-sm">
              Only {stock} left
            </Badge>
          )
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {product.brand}
        </p>

        <h3 className="text-sm font-semibold leading-snug">
          <Link
            to="/products/$slug"
            params={{ slug: product.slug }}
            className="after:absolute after:inset-0 after:content-[''] hover:underline"
          >
            {product.name}
          </Link>
        </h3>

        <p className="line-clamp-2 text-sm text-muted-foreground">{product.tagline}</p>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <StarRating rating={product.rating} />
          <span>{product.rating.toFixed(1)}</span>
          <span aria-hidden="true">·</span>
          <span>{product.reviewCount} reviews</span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold">{formatPrice(product.price)}</span>
              {product.wasPrice !== undefined && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatPrice(product.wasPrice)}
                </span>
              )}
            </div>
            {discount !== null && (
              <p className="text-xs font-medium text-emerald-600">{discount}% off</p>
            )}
          </div>

          {/* Sits above the stretched link overlay so the card stays clickable. */}
          <Button
            size="icon"
            variant="secondary"
            className="relative z-10"
            // Held disabled until the session is known, so a shopper who is
            // already signed in is never bounced to the login page.
            disabled={!ready || stock === 0}
            aria-label={
              stock === 0
                ? `${product.name} is out of stock`
                : signedIn
                  ? `Add ${product.name} to basket`
                  : `Sign in to buy ${product.name}`
            }
            onClick={() => addToBasket(product.slug, 1, product.name)}
          >
            {signedIn ? <ShoppingCart /> : <LogIn />}
          </Button>
        </div>
      </div>
    </article>
  );
}
