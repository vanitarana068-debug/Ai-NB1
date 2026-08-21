import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SlidersHorizontal, X } from "lucide-react";
import * as React from "react";

import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  categories,
  formatPrice,
  getCategory,
  products,
  type CategoryId,
  type Product,
} from "@/data/products";

const sortKeys = ["featured", "price-asc", "price-desc", "rating"] as const;
type SortKey = (typeof sortKeys)[number];

const sortLabels: Record<SortKey, string> = {
  featured: "Featured",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  rating: "Customer rating",
};

type CategoryFilter = CategoryId | "all";

type ProductSearch = {
  category?: CategoryFilter;
  q?: string;
  sort?: SortKey;
};

function isCategoryFilter(value: string): value is CategoryFilter {
  return value === "all" || categories.some((category) => category.id === value);
}

function isSortKey(value: string): value is SortKey {
  return (sortKeys as readonly string[]).includes(value);
}

export const Route = createFileRoute("/products/")({
  validateSearch: (search: Record<string, unknown>): ProductSearch => {
    const result: ProductSearch = {};

    const category = search["category"];
    if (typeof category === "string" && isCategoryFilter(category) && category !== "all") {
      result.category = category;
    }

    const q = search["q"];
    if (typeof q === "string" && q.trim() !== "") result.q = q.trim();

    const sort = search["sort"];
    if (typeof sort === "string" && isSortKey(sort) && sort !== "featured") result.sort = sort;

    return result;
  },
  component: ProductsPage,
  head: () => ({
    meta: [
      { title: "All products — Northbridge" },
      {
        name: "description",
        content: "Browse every laptop, phone, component and accessory Northbridge stocks.",
      },
    ],
  }),
});

const allBrands = [...new Set(products.map((product) => product.brand))].sort();
const highestPrice = products.reduce((max, product) => Math.max(max, product.price), 0);

function matchesQuery(product: Product, query: string): boolean {
  const haystack =
    `${product.name} ${product.brand} ${product.tagline} ${product.description}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term !== "")
    .every((term) => haystack.includes(term));
}

function ProductsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  const activeCategory: CategoryFilter = search.category ?? "all";
  const query = search.q ?? "";
  const sort: SortKey = search.sort ?? "featured";

  const [brands, setBrands] = React.useState<string[]>([]);
  const [maxPrice, setMaxPrice] = React.useState(highestPrice);
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  // A different category can bring a different price range into play.
  React.useEffect(() => {
    setMaxPrice(highestPrice);
    setBrands([]);
  }, [activeCategory]);

  function updateSearch(next: Partial<ProductSearch>) {
    void navigate({
      to: "/products",
      search: (previous: ProductSearch): ProductSearch => {
        const merged: ProductSearch = { ...previous, ...next };
        if (merged.category === "all") delete merged.category;
        if (merged.sort === "featured") delete merged.sort;
        if (merged.q === "") delete merged.q;
        return merged;
      },
    });
  }

  const visible = React.useMemo(() => {
    const filtered = products.filter((product) => {
      if (activeCategory !== "all" && product.category !== activeCategory) return false;
      if (brands.length > 0 && !brands.includes(product.brand)) return false;
      if (product.price > maxPrice) return false;
      if (query !== "" && !matchesQuery(product, query)) return false;
      return true;
    });

    const sorted = [...filtered];
    switch (sort) {
      case "price-asc":
        sorted.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        sorted.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      case "featured":
        sorted.sort((a, b) => Number(b.badge !== undefined) - Number(a.badge !== undefined));
        break;
    }
    return sorted;
  }, [activeCategory, brands, maxPrice, query, sort]);

  const categoryRecord = activeCategory === "all" ? undefined : getCategory(activeCategory);
  const hasExtraFilters = brands.length > 0 || maxPrice < highestPrice;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link to="/" className="transition-colors hover:text-foreground">
          Home
        </Link>
        <span className="px-2">/</span>
        <span className="text-foreground">{categoryRecord?.name ?? "All products"}</span>
      </nav>

      <div className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          {categoryRecord?.name ?? "All products"}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {categoryRecord?.blurb ?? "Everything we stock, from desk accessories to full builds."}
        </p>
      </div>

      {query !== "" && (
        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Searching for</span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 font-medium">
            {query}
            <button
              type="button"
              aria-label="Clear search"
              className="cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={() => updateSearch({ q: "" })}
            >
              <X className="size-3.5" />
            </button>
          </span>
        </div>
      )}

      {/* Category pills */}
      <div className="mt-6 flex flex-wrap gap-2">
        <CategoryPill
          active={activeCategory === "all"}
          onClick={() => updateSearch({ category: "all" })}
        >
          All
        </CategoryPill>
        {categories.map((category) => (
          <CategoryPill
            key={category.id}
            active={activeCategory === category.id}
            onClick={() => updateSearch({ category: category.id })}
          >
            {category.name}
          </CategoryPill>
        ))}
      </div>

      <Separator className="my-6" />

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Filters */}
        <aside className="lg:w-60 lg:shrink-0">
          <div className="flex items-center justify-between lg:hidden">
            <Button variant="outline" size="sm" onClick={() => setFiltersOpen((open) => !open)}>
              <SlidersHorizontal />
              Filters
              {hasExtraFilters && <span className="ml-1 text-xs">(on)</span>}
            </Button>
          </div>

          <div className={filtersOpen ? "mt-4 block" : "mt-4 hidden lg:block"}>
            <fieldset>
              <legend className="text-sm font-semibold">Brand</legend>
              <div className="mt-3 flex flex-col gap-2.5">
                {allBrands.map((brand) => (
                  <div key={brand} className="flex items-center gap-2">
                    <Checkbox
                      id={`brand-${brand}`}
                      checked={brands.includes(brand)}
                      onCheckedChange={(checked) => {
                        setBrands((current) =>
                          checked === true
                            ? [...current, brand]
                            : current.filter((b) => b !== brand),
                        );
                      }}
                    />
                    <Label htmlFor={`brand-${brand}`} className="cursor-pointer font-normal">
                      {brand}
                    </Label>
                  </div>
                ))}
              </div>
            </fieldset>

            <Separator className="my-6" />

            <div>
              <h2 className="text-sm font-semibold">Maximum price</h2>
              <p className="mt-2 text-sm text-muted-foreground tabular-nums">
                Up to {formatPrice(maxPrice)}
              </p>
              <Slider
                className="mt-4"
                value={[maxPrice]}
                min={5000}
                max={highestPrice}
                step={1000}
                onValueChange={(value) => {
                  const next = value[0];
                  if (next !== undefined) setMaxPrice(next);
                }}
              />
            </div>

            {hasExtraFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-6 w-full"
                onClick={() => {
                  setBrands([]);
                  setMaxPrice(highestPrice);
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </aside>

        {/* Results */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {visible.length} {visible.length === 1 ? "product" : "products"}
            </p>

            <div className="flex items-center gap-2">
              <Label htmlFor="sort" className="text-sm text-muted-foreground">
                Sort by
              </Label>
              <Select
                value={sort}
                onValueChange={(value) => {
                  if (isSortKey(value)) updateSearch({ sort: value });
                }}
              >
                <SelectTrigger id="sort" className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortKeys.map((key) => (
                    <SelectItem key={key} value={key}>
                      {sortLabels[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="mt-10 rounded-xl border border-dashed p-12 text-center">
              <h2 className="font-semibold">Nothing matches those filters</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Try widening the price range or clearing the brand selection.
              </p>
              <Button
                variant="outline"
                className="mt-5"
                onClick={() => {
                  setBrands([]);
                  setMaxPrice(highestPrice);
                  updateSearch({ category: "all", q: "" });
                }}
              >
                Reset everything
              </Button>
            </div>
          ) : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((product) => (
                <ProductCard key={product.slug} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "cursor-pointer rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground"
          : "cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      }
    >
      {children}
    </button>
  );
}
