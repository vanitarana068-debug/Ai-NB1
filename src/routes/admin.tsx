import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Lock, Package, ShieldCheck } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPrice } from "@/data/products";
import {
  fetchAdminProducts,
  fetchAllOrders,
  fetchPriceHistory,
  fetchStockMovements,
  setOrderStatus,
  setStock,
  updateProduct,
} from "@/lib/admin";
import { useAuth } from "@/lib/auth";
import type {
  OrderStatus,
  ProductPriceHistory,
  ProductRow,
  StockMovement,
} from "@/lib/database.types";
import { invalidateStockLevels } from "@/lib/inventory";
import type { OrderWithItems } from "@/lib/orders";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [{ title: "Admin — Northbridge" }],
  }),
});

const orderStatuses: readonly OrderStatus[] = [
  "confirmed",
  "packing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

const statusVariant: Record<OrderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  confirmed: "secondary",
  packing: "secondary",
  shipped: "default",
  delivered: "default",
  cancelled: "destructive",
};

function AdminPage() {
  const { ready, isAdmin, user } = useAuth();

  if (!ready) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="h-9 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-8 h-96 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center sm:px-6">
        <Lock className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Staff only</h1>
        <p className="mt-2 text-muted-foreground">
          {user
            ? "Your account doesn't have admin access."
            : "Sign in with an admin account to manage the shop."}
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link to={user ? "/" : "/login"}>{user ? "Back to the shop" : "Sign in"}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-6" />
        <h1 className="text-3xl font-semibold tracking-tight">Shop admin</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage orders and inventory. Changes are recorded server-side.
      </p>

      <Tabs defaultValue="orders" className="mt-8">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          <OrdersTab />
        </TabsContent>
        <TabsContent value="inventory">
          <InventoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

function OrdersTab() {
  const [orders, setOrders] = React.useState<OrderWithItems[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<OrderWithItems | null>(null);

  React.useEffect(() => {
    let active = true;
    void fetchAllOrders().then(({ orders: rows, error: err }) => {
      if (!active) return;
      setOrders(rows);
      setError(err);
    });
    return () => {
      active = false;
    };
  }, []);

  async function changeStatus(order: OrderWithItems, status: OrderStatus) {
    setPending(order.id);
    const { error: err } = await setOrderStatus(order.id, status);
    setPending(null);

    if (err !== null) {
      toast.error("Couldn't update status", { description: err });
      return;
    }
    setOrders((current) =>
      current === null ? current : current.map((o) => (o.id === order.id ? { ...o, status } : o)),
    );
    toast.success(`${order.reference} → ${status}`);
  }

  if (error !== null) {
    return (
      <p
        role="alert"
        className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {error}
      </p>
    );
  }

  if (orders === null) {
    return <div className="mt-4 h-64 animate-pulse rounded-xl bg-muted" />;
  }

  if (orders.length === 0) {
    return (
      <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed p-10 text-center">
        <Package className="size-8 text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">No orders yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-xs font-medium">{order.reference}</TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {new Date(order.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </TableCell>
                <TableCell className="text-sm">
                  <span className="block font-medium">{order.full_name}</span>
                  <span className="block text-xs text-muted-foreground">{order.email}</span>
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {formatPrice(order.total_pence)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant[order.status]} className="capitalize">
                      {order.status}
                    </Badge>
                    <Select
                      value={order.status}
                      onValueChange={(value) => void changeStatus(order, value as OrderStatus)}
                    >
                      <SelectTrigger
                        className="h-8 w-36"
                        aria-label={`Status for ${order.reference}`}
                      >
                        {pending === order.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <SelectValue />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {orderStatuses.map((status) => (
                          <SelectItem key={status} value={status} className="capitalize">
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => setDetail(order)}>
                    Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <OrderDetailDialog order={detail} onClose={() => setDetail(null)} />
    </>
  );
}

function OrderDetailDialog({
  order,
  onClose,
}: {
  order: OrderWithItems | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={order !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {order !== null && (
          <>
            <DialogHeader>
              <DialogTitle className="font-mono">{order.reference}</DialogTitle>
              <DialogDescription>
                {order.full_name} · {order.email}
              </DialogDescription>
            </DialogHeader>

            <div className="text-sm">
              <p className="font-medium">Deliver to</p>
              <address className="mt-1 not-italic text-muted-foreground">
                {order.address1}
                {order.address2 ? `, ${order.address2}` : ""}
                <br />
                {order.city}, {order.postcode}
                <br />
                {order.delivery_speed === "express" ? "Express delivery" : "Standard delivery"}
                {order.payment_detail ? ` · ${order.payment_detail}` : ""}
              </address>
            </div>

            <Separator />

            <ul className="flex flex-col gap-2 text-sm">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {item.quantity} × {item.product_name}
                  </span>
                  <span className="tabular-nums">{formatPrice(item.line_total_pence)}</span>
                </li>
              ))}
            </ul>

            <Separator />

            <div className="flex justify-between text-sm font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatPrice(order.total_pence)}</span>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

function InventoryTab() {
  const [products, setProducts] = React.useState<ProductRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<ProductRow | null>(null);
  const [historyFor, setHistoryFor] = React.useState<ProductRow | null>(null);

  const load = React.useCallback(() => {
    void fetchAdminProducts().then(({ products: rows, error: err }) => {
      setProducts(rows);
      setError(err);
    });
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  if (error !== null) {
    return (
      <p
        role="alert"
        className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {error}
      </p>
    );
  }

  if (products === null) {
    return <div className="mt-4 h-64 animate-pulse rounded-xl bg-muted" />;
  }

  return (
    <>
      <div className="mt-4 overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Listed</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => {
              const low = product.stock <= product.low_stock_at;
              return (
                <TableRow key={product.slug}>
                  <TableCell className="text-sm">
                    <span className="block font-medium">{product.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {product.brand} · {product.category}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatPrice(product.price_pence)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    <span className={low ? "font-semibold text-destructive" : undefined}>
                      {product.stock}
                    </span>
                    {low && <span className="ml-1 text-xs text-muted-foreground">low</span>}
                  </TableCell>
                  <TableCell>
                    {product.active ? (
                      <Badge variant="secondary">Active</Badge>
                    ) : (
                      <Badge variant="outline">Hidden</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setHistoryFor(product)}>
                        History
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditing(product)}>
                        Edit
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <EditProductDialog
        product={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
          invalidateStockLevels();
        }}
      />

      <ProductHistoryDialog product={historyFor} onClose={() => setHistoryFor(null)} />
    </>
  );
}

/** Human label for a stock-movement reason. */
const movementReason: Record<StockMovement["reason"], string> = {
  sale: "Sale",
  restock: "Restock",
  adjustment: "Adjustment",
  cancellation: "Cancellation",
};

function ProductHistoryDialog({
  product,
  onClose,
}: {
  product: ProductRow | null;
  onClose: () => void;
}) {
  const [movements, setMovements] = React.useState<StockMovement[] | null>(null);
  const [prices, setPrices] = React.useState<ProductPriceHistory[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!product) return;
    let active = true;
    setMovements(null);
    setPrices(null);
    setError(null);

    void Promise.all([fetchStockMovements(product.slug), fetchPriceHistory(product.slug)]).then(
      ([stock, price]) => {
        if (!active) return;
        setMovements(stock.movements);
        setPrices(price.history);
        setError(stock.error ?? price.error);
      },
    );

    return () => {
      active = false;
    };
  }, [product]);

  const loading = movements === null || prices === null;

  return (
    <Dialog open={product !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {product !== null && (
          <>
            <DialogHeader>
              <DialogTitle>{product.name}</DialogTitle>
              <DialogDescription>Stock movements and price changes.</DialogDescription>
            </DialogHeader>

            {error !== null && (
              <p
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}

            {loading && error === null && (
              <div className="h-40 animate-pulse rounded-lg bg-muted" />
            )}

            {!loading && (
              <>
                <section>
                  <h3 className="text-sm font-semibold">Stock movements</h3>
                  {movements.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">No movements recorded.</p>
                  ) : (
                    <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                      {movements.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">
                            {new Date(m.created_at).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                            {" · "}
                            {movementReason[m.reason]}
                            {m.note ? ` · ${m.note}` : ""}
                          </span>
                          <span
                            className={
                              m.delta > 0
                                ? "font-medium tabular-nums text-emerald-600"
                                : "font-medium tabular-nums text-destructive"
                            }
                          >
                            {m.delta > 0 ? `+${m.delta}` : m.delta}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <Separator />

                <section>
                  <h3 className="text-sm font-semibold">Price changes</h3>
                  {prices.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">No price changes recorded.</p>
                  ) : (
                    <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                      {prices.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">
                            {new Date(p.changed_at).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                          <span className="tabular-nums">
                            {p.old_price_pence === null
                              ? formatPrice(p.new_price_pence)
                              : `${formatPrice(p.old_price_pence)} → ${formatPrice(p.new_price_pence)}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Pence (integer) shown and edited as pounds. */
function penceToPounds(pence: number | null): string {
  return pence === null ? "" : (pence / 100).toFixed(2);
}

function poundsToPence(pounds: string): number | null {
  const trimmed = pounds.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (Number.isNaN(value)) return null;
  return Math.round(value * 100);
}

function EditProductDialog({
  product,
  onClose,
  onSaved,
}: {
  product: ProductRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [price, setPrice] = React.useState("");
  const [wasPrice, setWasPrice] = React.useState("");
  const [lowStockAt, setLowStockAt] = React.useState("");
  const [stock, setStockValue] = React.useState("");
  const [active, setActive] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Seed the form whenever a different product opens.
  React.useEffect(() => {
    if (!product) return;
    setPrice(penceToPounds(product.price_pence));
    setWasPrice(penceToPounds(product.was_price_pence));
    setLowStockAt(String(product.low_stock_at));
    setStockValue(String(product.stock));
    setActive(product.active);
  }, [product]);

  async function save() {
    if (!product) return;

    const pricePence = poundsToPence(price);
    if (pricePence === null || pricePence < 0) {
      toast.error("Enter a valid price");
      return;
    }
    const lowAt = Number(lowStockAt);
    const nextStock = Number(stock);
    if (!Number.isInteger(lowAt) || lowAt < 0) {
      toast.error("Low-stock threshold must be a whole number");
      return;
    }
    if (!Number.isInteger(nextStock) || nextStock < 0) {
      toast.error("Stock must be a whole number");
      return;
    }

    setSaving(true);

    const { error: updateError } = await updateProduct(product.slug, {
      pricePence,
      wasPricePence: poundsToPence(wasPrice),
      lowStockAt: lowAt,
      active,
    });
    if (updateError !== null) {
      setSaving(false);
      toast.error("Couldn't save product", { description: updateError });
      return;
    }

    if (nextStock !== product.stock) {
      const { error: stockError } = await setStock(product.slug, nextStock);
      if (stockError !== null) {
        setSaving(false);
        toast.error("Saved price, but couldn't set stock", { description: stockError });
        onSaved();
        return;
      }
    }

    setSaving(false);
    toast.success(`${product.name} saved`);
    onSaved();
  }

  return (
    <Dialog open={product !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {product !== null && (
          <>
            <DialogHeader>
              <DialogTitle>{product.name}</DialogTitle>
              <DialogDescription>
                Price, stock and listing. Copy and images are set in code.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="price">Price (₹)</Label>
                <Input
                  id="price"
                  inputMode="decimal"
                  className="mt-1.5"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="wasPrice">Was price (₹, optional)</Label>
                <Input
                  id="wasPrice"
                  inputMode="decimal"
                  className="mt-1.5"
                  value={wasPrice}
                  onChange={(event) => setWasPrice(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="stock">Stock</Label>
                <Input
                  id="stock"
                  inputMode="numeric"
                  className="mt-1.5"
                  value={stock}
                  onChange={(event) => setStockValue(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="lowStockAt">Low-stock at</Label>
                <Input
                  id="lowStockAt"
                  inputMode="numeric"
                  className="mt-1.5"
                  value={lowStockAt}
                  onChange={(event) => setLowStockAt(event.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="active-select">Listing</Label>
              <Select
                value={active ? "active" : "hidden"}
                onValueChange={(value) => setActive(value === "active")}
              >
                <SelectTrigger id="active-select" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active — shown in the shop</SelectItem>
                  <SelectItem value="hidden">Hidden — not for sale</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={() => void save()} disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
