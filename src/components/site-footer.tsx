import { Link } from "@tanstack/react-router";
import { CircuitBoard } from "lucide-react";

import { categories } from "@/data/products";

const help = ["Delivery & returns", "Track an order", "Warranty claims", "Contact us"];
const about = ["About Northbridge", "Careers", "Press", "Sustainability"];

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Link to="/" className="flex items-center gap-2">
              <CircuitBoard className="size-5" />
              <span className="font-semibold tracking-tight">Northbridge</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Computing and consumer tech, specified honestly and shipped from our Manchester
              warehouse.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold">Shop</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    to="/products"
                    search={{ category: category.id }}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold">Help</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {help.map((item) => (
                <li key={item} className="text-sm text-muted-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold">Company</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {about.map((item) => (
                <li key={item} className="text-sm text-muted-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} Northbridge Ltd. A demo storefront — no real orders are
            taken.
          </p>
          <p>Prices include VAT.</p>
        </div>
      </div>
    </footer>
  );
}
