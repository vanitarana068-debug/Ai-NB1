import { Link, useNavigate } from "@tanstack/react-router";
import { CircuitBoard, Menu, Phone, Search, ShoppingCart, User, X } from "lucide-react";
import * as React from "react";

import { CartSheet } from "@/components/cart-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { categories } from "@/data/products";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const { count, hydrated } = useCart();
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [cartOpen, setCartOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    setMenuOpen(false);
    void navigate({
      to: "/products",
      search: trimmed === "" ? {} : { q: trimmed },
    });
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X /> : <Menu />}
        </Button>

        <Link to="/" className="flex shrink-0 items-center gap-2">
          <CircuitBoard className="size-6" />
          <span className="text-lg font-semibold tracking-tight">Northbridge</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          <Link
            to="/products"
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
            activeOptions={{ exact: true, includeSearch: false }}
          >
            All products
          </Link>
          {categories.slice(0, 4).map((category) => (
            <Link
              key={category.id}
              to="/products"
              search={{ category: category.id }}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {category.name}
            </Link>
          ))}
        </nav>

        <form onSubmit={submitSearch} className="ml-auto hidden max-w-xs flex-1 md:block">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products"
              aria-label="Search products"
              className="pl-9"
            />
          </div>
        </form>

        <a
          href="tel:+12722282233"
          className="ml-auto hidden shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:ml-0 md:flex"
          aria-label="Call our specialists on +1 (272) 228 2233"
        >
          <Phone className="size-4" />
          <span className="hidden lg:inline tabular-nums">+1 (272) 228 2233</span>
        </a>

        <Button
          asChild
          variant="ghost"
          size="icon"
          className="ml-auto shrink-0 md:ml-0"
          aria-label={ready && user ? "Your account" : "Sign in"}
        >
          {/* Signed-out visitors land on the sign-in form; the account page
              handles the case where the session is still being restored. */}
          <Link to={ready && user ? "/account" : "/login"}>
            <User />
          </Link>
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="relative shrink-0"
          aria-label={`Basket, ${count} ${count === 1 ? "item" : "items"}`}
          onClick={() => setCartOpen(true)}
        >
          <ShoppingCart />
          {/* Held back until hydration so the server and client markup match. */}
          {hydrated && count > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground tabular-nums">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </div>

      <div className={cn("border-t lg:hidden", menuOpen ? "block" : "hidden")}>
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <form onSubmit={submitSearch} className="mb-3 md:hidden">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products"
                aria-label="Search products"
                className="pl-9"
              />
            </div>
          </form>

          <nav className="flex flex-col">
            <Link
              to="/products"
              onClick={() => setMenuOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              All products
            </Link>
            {categories.map((category) => (
              <Link
                key={category.id}
                to="/products"
                search={{ category: category.id }}
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {category.name}
              </Link>
            ))}
            <Link
              to={ready && user ? "/account" : "/login"}
              onClick={() => setMenuOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {ready && user ? "Your account" : "Sign in"}
            </Link>
          </nav>
        </div>
      </div>

      <CartSheet open={cartOpen} onOpenChange={setCartOpen} />
    </header>
  );
}
