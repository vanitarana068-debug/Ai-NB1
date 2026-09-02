import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Loader2, LogIn, MailCheck } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  // Where to go after signing in. Only same-site paths are accepted, so the
  // parameter cannot be used to bounce anyone off to another host.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const target = search["redirect"];
    if (typeof target !== "string") return {};
    if (!target.startsWith("/") || target.startsWith("//")) return {};
    return { redirect: target };
  },
  component: LoginPage,
  head: () => ({
    meta: [{ title: "Sign in — Northbridge" }],
  }),
});

function LoginPage() {
  const { session, ready, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const { redirect } = Route.useSearch();

  const goOnwards = React.useCallback(() => {
    if (redirect !== undefined) {
      router.history.replace(redirect);
      return;
    }
    void navigate({ to: "/account", replace: true });
  }, [redirect, router, navigate]);

  const [mode, setMode] = React.useState<"signin" | "signup">("signin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmSent, setConfirmSent] = React.useState<string | null>(null);

  // Nobody needs the sign-in form once they have a session.
  React.useEffect(() => {
    if (ready && session !== null) goOnwards();
  }, [ready, session, goOnwards]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    if (mode === "signin") {
      const { error: signInError } = await signIn(email, password);
      setBusy(false);
      if (signInError !== null) {
        setError(signInError);
        return;
      }
      toast.success("Signed in");
      goOnwards();
      return;
    }

    const { error: signUpError, needsConfirmation } = await signUp(email, password, fullName);
    setBusy(false);
    if (signUpError !== null) {
      setError(signUpError);
      return;
    }

    if (needsConfirmation) {
      setConfirmSent(email.trim());
      return;
    }

    toast.success("Account created");
    goOnwards();
  }

  if (confirmSent !== null) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center sm:px-6">
        <MailCheck className="mx-auto size-12 text-emerald-600" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Confirm your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We've sent a link to <span className="font-medium text-foreground">{confirmSent}</span>.
          Open it to activate the account, then come back and sign in.
        </p>
        <Button
          variant="outline"
          className="mt-8"
          onClick={() => {
            setConfirmSent(null);
            setMode("signin");
            setPassword("");
          }}
        >
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Your account</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign in to keep your delivery details and see everything you've ordered.
      </p>

      <Tabs
        value={mode}
        onValueChange={(value) => {
          if (value === "signin" || value === "signup") {
            setMode(value);
            setError(null);
          }
        }}
        className="mt-8"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="signin">Sign in</TabsTrigger>
          <TabsTrigger value="signup">Create account</TabsTrigger>
        </TabsList>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          <TabsContent value="signup" className="m-0">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              autoComplete="name"
              className="mt-1.5"
              required={mode === "signup"}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </TabsContent>

          <div>
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1.5"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
              className="mt-1.5"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {mode === "signup" && (
              <p className="mt-1.5 text-xs text-muted-foreground">At least 6 characters.</p>
            )}
          </div>

          {error !== null && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <LogIn />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>
      </Tabs>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Browsing and checkout work without an account —{" "}
        <Link to="/products" className="underline underline-offset-4">
          keep shopping
        </Link>
        .
      </p>
    </div>
  );
}
