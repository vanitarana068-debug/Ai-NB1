import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Headphones, RotateCcw, ShieldCheck, Truck } from "lucide-react";

import { ProductCard } from "@/components/product-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { categories, heroTech, products, productsInCategory } from "@/data/products";

// No head() here: the home route inherits title/description/og/twitter from
// __root.tsx, and ships no og:image so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  component: Index,
});

const promises = [
  {
    icon: Truck,
    title: "Free delivery over £50",
    body: "Next working day on anything ordered before 4pm.",
  },
  {
    icon: RotateCcw,
    title: "30-day returns",
    body: "Changed your mind? Send it back, we cover the postage.",
  },
  {
    icon: ShieldCheck,
    title: "Two-year warranty",
    body: "On every product, on top of your statutory rights.",
  },
  {
    icon: Headphones,
    title: "Specialists on the phone",
    body: "People who build machines, not a script.",
  },
];

function Index() {
  const featured = products.filter((product) => product.badge !== undefined).slice(0, 4);
  const laptops = productsInCategory("laptops");

  return (
    <>
      {/* Hero */}
      <section className="border-b bg-muted/30">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-24">
          <div>
            <Badge variant="secondary" className="mb-4">
              Summer clearance — up to 20% off
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Tech that is specified honestly.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground">
              No inflated headline figures, no vague marketing copy. Every listing tells you what
              the hardware actually does under load, so you can buy once.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/products">
                  Shop everything
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/products" search={{ category: "laptops" }}>
                  Browse laptops
                </Link>
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
            <img
              src={heroTech}
              alt="A laptop, over-ear headphones and a phone arranged on a light grey surface"
              className="aspect-[4/3] size-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Promises */}
      <section className="border-b">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          {promises.map((promise) => (
            <div key={promise.title} className="flex gap-3">
              <promise.icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <h2 className="text-sm font-semibold">{promise.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{promise.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-semibold tracking-tight">Shop by category</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const inCategory = productsInCategory(category.id);
            const cover = inCategory[0];

            return (
              <Link
                key={category.id}
                to="/products"
                search={{ category: category.id }}
                className="group flex items-center gap-4 rounded-xl border bg-card p-4 transition-shadow hover:shadow-md"
              >
                {cover !== undefined && (
                  <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                    <img
                      src={cover.image}
                      alt=""
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="flex items-center gap-1.5 font-medium">
                    {category.name}
                    <ArrowRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{category.blurb}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {inCategory.length} {inCategory.length === 1 ? "product" : "products"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Featured */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">This week's picks</h2>
              <p className="mt-1 text-muted-foreground">
                Reduced or newly in stock, and worth a look.
              </p>
            </div>
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link to="/products">
                View all
                <ArrowRight />
              </Link>
            </Button>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* Laptops strip */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Laptops</h2>
            <p className="mt-1 text-muted-foreground">Two machines, two very different jobs.</p>
          </div>
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link to="/products" search={{ category: "laptops" }}>
              View all
              <ArrowRight />
            </Link>
          </Button>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {laptops.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      </section>
    </>
  );
}
