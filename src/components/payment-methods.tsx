import { Apple, ArrowUpRight, CreditCard, ShieldCheck, Smartphone, Wallet } from "lucide-react";
import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatPrice } from "@/data/products";
import {
  cardBrandLabel,
  cardSecurityCodeLength,
  detectCardBrand,
  digitsOnly,
  formatCardNumber,
  formatExpiry,
  isMethodAvailable,
  paymentMethods,
  unavailableReason,
  type PaymentDraft,
  type PaymentErrors,
  type PaymentMethodId,
} from "@/lib/payments";
import { cn } from "@/lib/utils";

const icons: Record<PaymentMethodId, React.ComponentType<{ className?: string }>> = {
  card: CreditCard,
  upi: Smartphone,
  apple_pay: Apple,
  google_pay: Wallet,
  paypal: Wallet,
};

type Props = {
  value: PaymentDraft;
  errors: PaymentErrors;
  total: number;
  disabled?: boolean;
  onChange: (next: PaymentDraft) => void;
};

export function PaymentMethods({ value, errors, total, disabled = false, onChange }: Props) {
  // Wallet support is a browser fact, so it can only be read after mount —
  // deciding on the server would render a button that may not work.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  function set<K extends keyof PaymentDraft>(key: K, next: PaymentDraft[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div>
      <RadioGroup
        value={value.method}
        onValueChange={(next) => set("method", next as PaymentMethodId)}
        className="mt-4 flex flex-col gap-3"
        disabled={disabled}
      >
        {paymentMethods.map((method) => {
          const Icon = icons[method.id];
          const selected = value.method === method.id;
          // Until mount everything reads as available, which keeps the server
          // and client markup identical and avoids a hydration mismatch.
          const available = !mounted || isMethodAvailable(method.id);
          const reason = mounted ? unavailableReason(method.id) : null;

          return (
            <div
              key={method.id}
              className={cn(
                "rounded-lg border transition-colors",
                selected && "border-foreground/30 bg-muted/40",
                !available && "opacity-60",
              )}
            >
              <Label
                htmlFor={`pay-${method.id}`}
                className={cn(
                  "flex items-start gap-3 p-4 font-normal",
                  available ? "cursor-pointer" : "cursor-not-allowed",
                )}
              >
                <RadioGroupItem
                  value={method.id}
                  id={`pay-${method.id}`}
                  disabled={!available}
                  className="mt-0.5"
                />
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">
                  <span className="block text-sm font-medium">{method.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {reason ?? method.blurb}
                  </span>
                  {method.accepts !== undefined && (
                    <span className="mt-1 block text-[11px] text-muted-foreground/80">
                      {method.accepts}
                    </span>
                  )}
                </span>
              </Label>

              {selected && available && (
                <div className="border-t px-4 py-4">
                  {method.id === "card" && (
                    <CardPanel value={value} errors={errors} disabled={disabled} set={set} />
                  )}
                  {method.id === "upi" && (
                    <UpiPanel value={value} errors={errors} disabled={disabled} set={set} />
                  )}
                  {method.kind !== "form" && <HandoffPanel id={method.id} total={total} />}
                </div>
              )}
            </div>
          );
        })}
      </RadioGroup>

      {errors.method !== undefined && (
        <p className="mt-3 text-xs text-destructive">{errors.method}</p>
      )}

      <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-px size-3.5 shrink-0" />
        Card details are checked in your browser and never stored — only the brand and last four
        digits are kept with the order.
      </p>
    </div>
  );
}

type PanelProps = {
  value: PaymentDraft;
  errors: PaymentErrors;
  disabled: boolean;
  set: <K extends keyof PaymentDraft>(key: K, next: PaymentDraft[K]) => void;
};

function FieldError({ message }: { message: string | undefined }) {
  if (message === undefined) return null;
  return <p className="mt-1.5 text-xs text-destructive">{message}</p>;
}

function CardPanel({ value, errors, disabled, set }: PanelProps) {
  const brand = detectCardBrand(value.cardNumber);
  const cvcLength = cardSecurityCodeLength(brand);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="cardNumber">Card number</Label>
        <div className="relative mt-1.5">
          <Input
            id="cardNumber"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="4242 4242 4242 4242"
            disabled={disabled}
            value={value.cardNumber}
            aria-invalid={errors.cardNumber !== undefined}
            onChange={(event) => set("cardNumber", formatCardNumber(event.target.value))}
            className="pr-24"
          />
          {brand !== "unknown" && (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
              {cardBrandLabel(brand)}
            </span>
          )}
        </div>
        <FieldError message={errors.cardNumber} />
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor="cardName">Name on card</Label>
        <Input
          id="cardName"
          autoComplete="cc-name"
          className="mt-1.5"
          disabled={disabled}
          value={value.cardName}
          aria-invalid={errors.cardName !== undefined}
          onChange={(event) => set("cardName", event.target.value)}
        />
        <FieldError message={errors.cardName} />
      </div>

      <div>
        <Label htmlFor="cardExpiry">Expiry</Label>
        <Input
          id="cardExpiry"
          inputMode="numeric"
          autoComplete="cc-exp"
          placeholder="MM / YY"
          className="mt-1.5"
          disabled={disabled}
          value={value.cardExpiry}
          aria-invalid={errors.cardExpiry !== undefined}
          onChange={(event) => set("cardExpiry", formatExpiry(event.target.value))}
        />
        <FieldError message={errors.cardExpiry} />
      </div>

      <div>
        <Label htmlFor="cardCvc">
          Security code
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {cvcLength} digits{brand === "amex" ? ", on the front" : ""}
          </span>
        </Label>
        <Input
          id="cardCvc"
          inputMode="numeric"
          autoComplete="cc-csc"
          maxLength={cvcLength}
          className="mt-1.5"
          disabled={disabled}
          value={value.cardCvc}
          aria-invalid={errors.cardCvc !== undefined}
          onChange={(event) => set("cardCvc", digitsOnly(event.target.value).slice(0, cvcLength))}
        />
        <FieldError message={errors.cardCvc} />
      </div>
    </div>
  );
}

function UpiPanel({ value, errors, disabled, set }: PanelProps) {
  return (
    <div>
      <Label htmlFor="upiId">UPI ID</Label>
      <Input
        id="upiId"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="yourname@okhdfcbank"
        className="mt-1.5"
        disabled={disabled}
        value={value.upiId}
        aria-invalid={errors.upiId !== undefined}
        onChange={(event) => set("upiId", event.target.value)}
      />
      <FieldError message={errors.upiId} />
      <p className="mt-2 text-xs text-muted-foreground">
        We send a collect request to this ID. Open your UPI app and approve it within five minutes.
      </p>
    </div>
  );
}

function HandoffPanel({ id, total }: { id: PaymentMethodId; total: number }) {
  const copy: Record<string, string> = {
    apple_pay: `Place the order and the Apple Pay sheet opens for ${formatPrice(total)}.`,
    google_pay: `Place the order and Google Pay opens for ${formatPrice(total)}.`,
    paypal: `Place the order and you go to PayPal to approve ${formatPrice(total)}.`,
  };

  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <ArrowUpRight className="size-3.5 shrink-0" />
      {copy[id]}
    </p>
  );
}
