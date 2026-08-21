import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Info, Loader2, Lock } from "lucide-react";
import * as React from "react";

import { PaymentMethods } from "@/components/payment-methods";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { formatPrice } from "@/data/products";
import { useAuth } from "@/lib/auth";
import { useCart, type ResolvedLine } from "@/lib/cart";
import { invalidateStockLevels } from "@/lib/inventory";
import { placeOrder } from "@/lib/orders";
import {
  authorisePayment,
  describePayment,
  emptyPaymentDraft,
  getPaymentMethod,
  validatePayment,
  type PaymentDraft,
  type PaymentErrors,
} from "@/lib/payments";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
  head: () => ({
    meta: [{ title: "Checkout — Northbridge" }],
  }),
});

const fields = [
  { name: "fullName", label: "Full name", type: "text", autoComplete: "name" },
  { name: "email", label: "Email address", type: "email", autoComplete: "email" },
  { name: "address1", label: "Address line 1", type: "text", autoComplete: "address-line1" },
  {
    name: "address2",
    label: "Address line 2 (optional)",
    type: "text",
    autoComplete: "address-line2",
  },
  { name: "city", label: "Town or city", type: "text", autoComplete: "address-level2" },
  { name: "postcode", label: "Postcode", type: "text", autoComplete: "postal-code" },
] as const;

type FieldName = (typeof fields)[number]["name"];
type FormValues = Record<FieldName, string>;

const emptyForm: FormValues = {
  fullName: "",
  email: "",
  address1: "",
  address2: "",
  city: "",
  postcode: "",
};

const optionalFields: ReadonlySet<FieldName> = new Set<FieldName>(["address2"]);

const EXPRESS_FEE = 699;

/** What the button says while the payment is in flight, per method. */
const pendingLabels: Record<PaymentDraft["method"], string> = {
  card: "Authorising…",
  upi: "Waiting for approval…",
  apple_pay: "Opening Apple Pay…",
  google_pay: "Opening Google Pay…",
  paypal: "Redirecting to PayPal…",
};

function CheckoutPage() {
  const { resolved, subtotal, delivery, hydrated, clear } = useCart();
  const { user, profile, ready } = useAuth();

  const [values, setValues] = React.useState<FormValues>(emptyForm);
  const [errors, setErrors] = React.useState<Partial<Record<FieldName, string>>>({});
  const [speed, setSpeed] = React.useState<"standard" | "express">("standard");
  const [payment, setPayment] = React.useState<PaymentDraft>(emptyPaymentDraft);
  const [paymentErrors, setPaymentErrors] = React.useState<PaymentErrors>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [placed, setPlaced] = React.useState<{
    reference: string;
    lines: ResolvedLine[];
    total: number;
    paidWith: string;
  } | null>(null);

  const shipping = speed === "express" ? EXPRESS_FEE : delivery;
  const total = subtotal + shipping;
  const submittingLabel = pendingLabels[payment.method];

  // Fill the form from the signed-in shopper's saved details, without
  // clobbering anything they have already typed.
  React.useEffect(() => {
    if (!user) return;
    setValues((current) => ({
      fullName: current.fullName || (profile?.full_name ?? ""),
      email: current.email || (user.email ?? ""),
      address1: current.address1 || (profile?.address1 ?? ""),
      address2: current.address2 || (profile?.address2 ?? ""),
      city: current.city || (profile?.city ?? ""),
      postcode: current.postcode || (profile?.postcode ?? ""),
    }));
  }, [user, profile]);

  function validate(): boolean {
    const next: Partial<Record<FieldName, string>> = {};

    for (const field of fields) {
      if (optionalFields.has(field.name)) continue;
      if (values[field.name].trim() === "") {
        next[field.name] = "This field is required";
      }
    }

    if (next.email === undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      next.email = "Enter a valid email address";
    }

    const paymentIssues = validatePayment(payment);

    setErrors(next);
    setPaymentErrors(paymentIssues);
    return Object.keys(next).length === 0 && Object.keys(paymentIssues).length === 0;
  }

  async function submitOrder(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    setSubmitError(null);
    // The page is gated below, so there is always a session by this point.
    if (user === null) return;

    setSubmitting(true);

    // Take the money first: a declined card, a UPI request that times out or a
    // wallet sheet the shopper dismisses must not decrement stock.
    const authorisation = await authorisePayment(payment);
    if (!authorisation.ok) {
      setSubmitting(false);
      setSubmitError(authorisation.error);
      return;
    }

    // Only the masked description travels — never the card number itself.
    const paidWith = describePayment(payment);

    const { order, error } = await placeOrder({
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      address1: values.address1.trim(),
      address2: values.address2.trim(),
      city: values.city.trim(),
      postcode: values.postcode.trim(),
      deliverySpeed: speed,
      paymentMethod: payment.method,
      paymentDetail: paidWith,
      lines: resolved,
    });
    setSubmitting(false);

    if (error !== null) {
      setSubmitError(error);
      return;
    }

    // Totals come back from the database, which priced the order itself.
    setPlaced({ reference: order.reference, lines: resolved, total: order.total_pence, paidWith });
    // Don't leave card digits sitting in component state once we're done.
    setPayment({ ...emptyPaymentDraft, method: payment.method });
    // Stock just moved, so the cached levels are stale.
    invalidateStockLevels();
    clear();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (placed !== null) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <CheckCircle2 className="size-12 text-emerald-600" />
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Order confirmed</h1>
          <p className="mt-2 text-muted-foreground">
            Thanks {values.fullName.split(" ")[0] ?? ""} — a confirmation is on its way to{" "}
            {values.email}.
          </p>
          <p className="mt-4 rounded-md bg-muted px-3 py-1.5 font-mono text-sm">
            {placed.reference}
          </p>
        </div>

        <div className="mt-10 rounded-xl border">
          <ul className="divide-y">
            {placed.lines.map((line) => (
              <li key={line.product.slug} className="flex items-center gap-4 p-4">
                <div className="size-14 shrink-0 overflow-hidden rounded-md border bg-muted">
                  <img
                    src={line.product.image}
                    alt={line.product.name}
                    className="size-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{line.product.name}</p>
                  <p className="text-xs text-muted-foreground">Quantity {line.quantity}</p>
                </div>
                <span className="text-sm tabular-nums">{formatPrice(line.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t p-4 font-semibold">
            <span>Total paid</span>
            <span className="tabular-nums">{formatPrice(placed.total)}</span>
          </div>
          <div className="flex justify-between border-t p-4 text-sm text-muted-foreground">
            <span>Paid with</span>
            <span>{placed.paidWith}</span>
          </div>
        </div>

        <p className="mt-6 flex items-start gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          This is a demonstration storefront. No payment was taken and nothing will be dispatched.
          The order is saved to your account.
        </p>

        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/products">Continue shopping</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/account">View your orders</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Checking out is account-only, and a basket can outlive a session in
  // localStorage, so the gate lives here rather than only on the buy buttons.
  if (ready && user === null) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center sm:px-6">
        <Lock className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Sign in to check out</h1>
        <p className="mt-2 text-muted-foreground">
          Orders are kept with your account, so you'll need to be signed in to place one.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link to="/login" search={{ redirect: "/checkout" }}>
            Sign in
          </Link>
        </Button>
      </div>
    );
  }

  // The basket comes out of localStorage after mount, so hold the form back
  // rather than flashing an empty £0.00 summary.
  if (!hydrated || !ready) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-9 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-8 flex flex-col gap-8 lg:flex-row">
          <div className="h-96 flex-1 animate-pulse rounded-xl bg-muted" />
          <div className="h-72 animate-pulse rounded-xl bg-muted lg:w-80" />
        </div>
      </div>
    );
  }

  if (resolved.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Nothing to check out</h1>
        <p className="mt-2 text-muted-foreground">Your basket is empty.</p>
        <Button asChild size="lg" className="mt-8">
          <Link to="/products">
            Browse the shop
            <ArrowRight />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>

      <form onSubmit={submitOrder} className="mt-8 flex flex-col gap-8 lg:flex-row">
        <div className="min-w-0 flex-1">
          <section className="rounded-xl border p-6">
            <h2 className="font-semibold">Delivery details</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <div
                  key={field.name}
                  className={
                    field.name === "fullName" || field.name.startsWith("address")
                      ? "sm:col-span-2"
                      : undefined
                  }
                >
                  <Label htmlFor={field.name}>{field.label}</Label>
                  <Input
                    id={field.name}
                    type={field.type}
                    autoComplete={field.autoComplete}
                    className="mt-1.5"
                    value={values[field.name]}
                    aria-invalid={errors[field.name] !== undefined}
                    onChange={(event) => {
                      const { value } = event.target;
                      setValues((current) => ({ ...current, [field.name]: value }));
                    }}
                  />
                  {errors[field.name] !== undefined && (
                    <p className="mt-1.5 text-xs text-destructive">{errors[field.name]}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-xl border p-6">
            <h2 className="font-semibold">Delivery speed</h2>
            <RadioGroup
              value={speed}
              onValueChange={(value) => {
                if (value === "standard" || value === "express") setSpeed(value);
              }}
              className="mt-4 flex flex-col gap-3"
            >
              <Label
                htmlFor="standard"
                className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 font-normal"
              >
                <RadioGroupItem value="standard" id="standard" />
                <span className="flex-1">
                  <span className="block text-sm font-medium">Standard — 2 to 3 working days</span>
                  <span className="block text-xs text-muted-foreground">
                    {delivery === 0 ? "Free on this order" : formatPrice(delivery)}
                  </span>
                </span>
              </Label>

              <Label
                htmlFor="express"
                className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 font-normal"
              >
                <RadioGroupItem value="express" id="express" />
                <span className="flex-1">
                  <span className="block text-sm font-medium">Express — next working day</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatPrice(EXPRESS_FEE)}, order before 4pm
                  </span>
                </span>
              </Label>
            </RadioGroup>
          </section>

          <section className="mt-6 rounded-xl border p-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <Lock className="size-4" />
              Payment
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose how you'd like to pay. This storefront is a demonstration with no payment
              provider behind it, so nothing is ever charged.
            </p>

            <PaymentMethods
              value={payment}
              errors={paymentErrors}
              total={total}
              disabled={submitting}
              onChange={setPayment}
            />
          </section>
        </div>

        {/* Summary */}
        <aside className="lg:w-80 lg:shrink-0">
          <div className="rounded-xl border p-6 lg:sticky lg:top-24">
            <h2 className="font-semibold">Your order</h2>

            <ul className="mt-4 flex flex-col gap-3">
              {resolved.map((line) => (
                <li key={line.product.slug} className="flex items-center gap-3">
                  <div className="size-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                    <img
                      src={line.product.image}
                      alt={line.product.name}
                      className="size-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{line.product.name}</p>
                    <p className="text-xs text-muted-foreground">Quantity {line.quantity}</p>
                  </div>
                  <span className="text-sm tabular-nums">{formatPrice(line.lineTotal)}</span>
                </li>
              ))}
            </ul>

            <Separator className="my-4" />

            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivery</dt>
                <dd className="tabular-nums">{shipping === 0 ? "Free" : formatPrice(shipping)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Paying with</dt>
                <dd>{getPaymentMethod(payment.method).label}</dd>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatPrice(total)}</dd>
              </div>
            </dl>

            {submitError !== null && (
              <p
                role="alert"
                className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {submitError}
              </p>
            )}

            <Button type="submit" size="lg" className="mt-6 w-full" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />}
              {submitting ? submittingLabel : `Pay ${formatPrice(total)}`}
            </Button>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Demo only — no payment is taken.
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
}
