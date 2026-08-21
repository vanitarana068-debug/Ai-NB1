import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { Check, LogIn, Minus, Plus, RotateCcw, ShieldCheck, ThumbsUp, Truck } from "lucide-react";
import * as React from "react";

import { ProductCard } from "@/components/product-card";
import { StarRating } from "@/components/star-rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  discountPercent,
  formatPrice,
  getCategory,
  getProduct,
  relatedProducts,
} from "@/data/products";
import { ratingDistribution, reviewsFor } from "@/data/reviews";
import { useStock } from "@/lib/inventory";
import { useBasketActions } from "@/lib/use-basket-actions";

export const Route = createFileRoute("/products/$slug")({
  loader: ({ params }) => {
    const product = getProduct(params.slug);
    if (!product) throw notFound();
    return product;
  },
  head: ({ loaderData }) => ({
    meta:
      loaderData === undefined
        ? []
        : [
            { title: `${loaderData.name} — Northbridge` },
            { name: "description", content: loaderData.tagline },
          ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const product = Route.useLoaderData();
  const { addToBasket, signedIn, ready } = useBasketActions();
  const navigate = useNavigate();
  // Live count from Supabase, falling back to the catalogue figure until it
  // lands (or for good, if the products table has not been created yet).
  const stock = useStock(product.slug, product.stock);
  const [quantity, setQuantity] = React.useState(1);

  const category = getCategory(product.category);
  const discount = discountPercent(product);
  const reviews = reviewsFor(product.slug);
  const distribution = ratingDistribution(product.rating, product.reviewCount);
  const related = relatedProducts(product);

  // Reset the quantity when navigating between products on the same route.
  React.useEffect(() => {
    setQuantity(1);
  }, [product.slug]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link to="/" className="transition-colors hover:text-foreground">
          Home
        </Link>
        <span className="px-2">/</span>
        <Link to="/products" className="transition-colors hover:text-foreground">
          Products
        </Link>
        {category !== undefined && (
          <>
            <span className="px-2">/</span>
            <Link
              to="/products"
              search={{ category: category.id }}
              className="transition-colors hover:text-foreground"
            >
              {category.name}
            </Link>
          </>
        )}
        <span className="px-2">/</span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border bg-muted">
          <img
            src={product.image}
            alt={product.name}
            className="aspect-square size-full object-cover"
          />
        </div>

        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {product.brand}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{product.name}</h1>
          <p className="mt-3 text-lg text-muted-foreground">{product.tagline}</p>

          <div className="mt-4 flex items-center gap-2 text-sm">
            <StarRating rating={product.rating} size="md" />
            <span className="font-medium">{product.rating.toFixed(1)}</span>
            <span className="text-muted-foreground">({product.reviewCount} reviews)</span>
          </div>

          <div className="mt-6 flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-semibold">{formatPrice(product.price)}</span>
            {product.wasPrice !== undefined && (
              <span className="text-lg text-muted-foreground line-through">
                {formatPrice(product.wasPrice)}
              </span>
            )}
            {discount !== null && <Badge variant="secondary">Save {discount}%</Badge>}
          </div>

          <p className="mt-2 text-sm text-muted-foreground">
            Includes VAT. Free delivery on orders over £50.
          </p>

          <div className="mt-4 flex items-center gap-2 text-sm">
            <span
              className={
                stock > 0
                  ? "inline-block size-2 rounded-full bg-emerald-500"
                  : "inline-block size-2 rounded-full bg-destructive"
              }
            />
            {stock > 0 ? (
              <span>
                In stock
                {stock <= 8 && <span className="text-muted-foreground"> — only {stock} left</span>}
              </span>
            ) : (
              <span>Out of stock</span>
            )}
          </div>

          <Separator className="my-6" />

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-md border">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={quantity <= 1}
                className="cursor-pointer px-3 py-2 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Minus className="size-4" />
              </button>
              <span className="min-w-10 text-center text-sm tabular-nums">{quantity}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={quantity >= stock}
                className="cursor-pointer px-3 py-2 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
              >
                <Plus className="size-4" />
              </button>
            </div>

            {/* Both actions require an account; the buttons stay disabled
                until the stored session has been read. */}
            <Button
              size="lg"
              className="flex-1 sm:flex-none"
              disabled={stock === 0 || !ready}
              onClick={() => addToBasket(product.slug, quantity, `${quantity} x ${product.name}`)}
            >
              {!signedIn && <LogIn />}
              {signedIn ? "Add to basket" : "Sign in to buy"}
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="flex-1 sm:flex-none"
              disabled={stock === 0 || !ready}
              onClick={() => {
                if (addToBasket(product.slug, quantity)) void navigate({ to: "/cart" });
              }}
            >
              Buy now
            </Button>
          </div>

          <ul className="mt-8 flex flex-col gap-3">
            {product.highlights.map((highlight) => (
              <li key={highlight} className="flex gap-2.5 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                {highlight}
              </li>
            ))}
          </ul>

          <div className="mt-8 grid gap-4 rounded-xl border bg-muted/30 p-4 sm:grid-cols-3">
            <div className="flex gap-2.5">
              <Truck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-xs">Next-day delivery before 4pm</p>
            </div>
            <div className="flex gap-2.5">
              <RotateCcw className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-xs">30-day free returns</p>
            </div>
            <div className="flex gap-2.5">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-xs">Two-year warranty</p>
            </div>
          </div>
        </div>
      </div>

      {/* Detail tabs */}
      <Tabs defaultValue="overview" className="mt-16">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="specs">Specification</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({product.reviewCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 max-w-3xl">
          <p className="text-muted-foreground">{product.description}</p>
        </TabsContent>

        <TabsContent value="specs" className="mt-6 max-w-3xl">
          <dl className="divide-y rounded-xl border">
            {product.specs.map((spec) => (
              <div key={spec.label} className="grid gap-1 p-4 sm:grid-cols-3">
                <dt className="text-sm font-medium">{spec.label}</dt>
                <dd className="text-sm text-muted-foreground sm:col-span-2">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </TabsContent>

        <TabsContent value="reviews" className="mt-6">
          <div className="grid gap-10 lg:grid-cols-3">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold">{product.rating.toFixed(1)}</span>
                <span className="text-muted-foreground">out of 5</span>
              </div>
              <StarRating rating={product.rating} size="md" className="mt-2" />
              <p className="mt-2 text-sm text-muted-foreground">
                Based on {product.reviewCount} verified reviews
              </p>

              <div className="mt-6 flex flex-col gap-2">
                {distribution.map((row) => (
                  <div key={row.stars} className="flex items-center gap-3 text-sm">
                    <span className="w-12 shrink-0 text-muted-foreground tabular-nums">
                      {row.stars} star
                    </span>
                    <Progress
                      value={
                        product.reviewCount === 0 ? 0 : (row.count / product.reviewCount) * 100
                      }
                      className="h-2"
                    />
                    <span className="w-10 shrink-0 text-right text-muted-foreground tabular-nums">
                      {row.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <ul className="flex flex-col gap-6 lg:col-span-2">
              {reviews.map((review) => (
                <li key={review.id} className="rounded-xl border p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StarRating rating={review.rating} />
                    <h3 className="font-semibold">{review.title}</h3>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {review.author} · {review.date}
                    {review.verified && (
                      <span className="ml-2 inline-flex items-center gap-1 text-emerald-600">
                        <Check className="size-3" />
                        Verified purchase
                      </span>
                    )}
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">{review.body}</p>
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ThumbsUp className="size-3.5" />
                    {review.helpful} found this helpful
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>
      </Tabs>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight">You might also like</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.slug} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
