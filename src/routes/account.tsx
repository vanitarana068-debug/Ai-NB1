import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, LogOut, Package, Save, ShieldCheck } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatPrice } from "@/data/products";
import { useAuth } from "@/lib/auth";
import { fetchOrders, type OrderWithItems } from "@/lib/orders";

export const Route = createFileRoute("/account")({
  component: AccountPage,
  head: () => ({
    meta: [{ title: "Your account — Northbridge" }],
  }),
});

const profileFields = [
  { name: "full_name", label: "Full name", autoComplete: "name", wide: true },
  { name: "address1", label: "Address line 1", autoComplete: "address-line1", wide: true },
  { name: "address2", label: "Address line 2", autoComplete: "address-line2", wide: true },
  { name: "city", label: "Town or city", autoComplete: "address-level2", wide: false },
  { name: "postcode", label: "Postcode", autoComplete: "postal-code", wide: false },
] as const;

type ProfileField = (typeof profileFields)[number]["name"];
type ProfileForm = Record<ProfileField, string>;

const emptyProfile: ProfileForm = {
  full_name: "",
  address1: "",
  address2: "",
  city: "",
  postcode: "",
};

function AccountPage() {
  const { user, profile, isAdmin, ready, signOut, updateProfile } = useAuth();

  const [form, setForm] = React.useState<ProfileForm>(emptyProfile);
  const [saving, setSaving] = React.useState(false);
  const [orders, setOrders] = React.useState<OrderWithItems[] | null>(null);
  const [ordersError, setOrdersError] = React.useState<string | null>(null);

  // Seed the form once the profile row arrives.
  React.useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name ?? "",
      address1: profile.address1 ?? "",
      address2: profile.address2 ?? "",
      city: profile.city ?? "",
      postcode: profile.postcode ?? "",
    });
  }, [profile]);

  React.useEffect(() => {
    if (!user) {
      setOrders(null);
      return;
    }

    let active = true;
    void fetchOrders().then(({ orders: rows, error }) => {
      if (!active) return;
      setOrders(rows);
      setOrdersError(error);
    });

    return () => {
      active = false;
    };
  }, [user]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const { error } = await updateProfile({
      full_name: form.full_name.trim() === "" ? null : form.full_name.trim(),
      address1: form.address1.trim() === "" ? null : form.address1.trim(),
      address2: form.address2.trim() === "" ? null : form.address2.trim(),
      city: form.city.trim() === "" ? null : form.city.trim(),
      postcode: form.postcode.trim() === "" ? null : form.postcode.trim(),
    });
    setSaving(false);

    if (error !== null) {
      toast.error("Couldn't save", { description: error });
      return;
    }
    toast.success("Details saved");
  }

  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="h-9 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-8 h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">You're signed out</h1>
        <p className="mt-2 text-muted-foreground">
          Sign in to see your saved details and order history.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button asChild variant="outline">
              <Link to="/admin">
                <ShieldCheck />
                Admin
              </Link>
            </Button>
          )}
          <Button variant="outline" onClick={() => void signOut()}>
            <LogOut />
            Sign out
          </Button>
        </div>
      </div>

      <section className="mt-10 rounded-xl border p-6">
        <h2 className="font-semibold">Delivery details</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Saved to your account and filled in for you at checkout.
        </p>

        <form onSubmit={saveProfile} className="mt-6 grid gap-4 sm:grid-cols-2">
          {profileFields.map((field) => (
            <div key={field.name} className={field.wide ? "sm:col-span-2" : undefined}>
              <Label htmlFor={field.name}>{field.label}</Label>
              <Input
                id={field.name}
                autoComplete={field.autoComplete}
                className="mt-1.5"
                value={form[field.name]}
                onChange={(event) => {
                  const { value } = event.target;
                  setForm((current) => ({ ...current, [field.name]: value }));
                }}
              />
            </div>
          ))}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              Save details
            </Button>
          </div>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold tracking-tight">Order history</h2>

        {ordersError !== null && (
          <p
            role="alert"
            className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {ordersError}
          </p>
        )}

        {orders === null && ordersError === null && (
          <div className="mt-4 h-32 animate-pulse rounded-xl bg-muted" />
        )}

        {orders !== null && orders.length === 0 && (
          <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed p-10 text-center">
            <Package className="size-8 text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">You haven't ordered anything yet.</p>
            <Button asChild variant="outline" className="mt-6">
              <Link to="/products">Browse the shop</Link>
            </Button>
          </div>
        )}

        {orders !== null &&
          orders.map((order) => (
            <article key={order.id} className="mt-4 rounded-xl border">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
                <div>
                  <p className="font-mono text-sm font-medium">{order.reference}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    {" · "}
                    {order.delivery_speed === "express" ? "Express delivery" : "Standard delivery"}
                    {order.payment_detail !== null && ` · ${order.payment_detail}`}
                  </p>
                </div>
                <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize">
                  {order.status}
                </span>
              </header>

              <ul className="divide-y">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} × {formatPrice(item.unit_price_pence)}
                      </p>
                    </div>
                    <span className="text-sm tabular-nums">
                      {formatPrice(item.line_total_pence)}
                    </span>
                  </li>
                ))}
              </ul>

              <Separator />
              <div className="flex justify-between p-4 text-sm font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatPrice(order.total_pence)}</span>
              </div>
            </article>
          ))}
      </section>
    </div>
  );
}
