import type { Session, User } from "@supabase/supabase-js";
import * as React from "react";

import type { Profile } from "./database.types";
import { describeError, supabase } from "./supabase";

type Result = { error: string | null };
type SignUpResult = Result & { needsConfirmation: boolean };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** True when the signed-in user is staff. False while signed out or loading. */
  isAdmin: boolean;
  /** False until the stored session has been read back on the client. */
  ready: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<Result>;
  signOut: () => Promise<void>;
  updateProfile: (
    patch: Partial<Omit<Profile, "id" | "created_at" | "updated_at">>,
  ) => Promise<Result>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  // Profile follows the session: fetched on sign in, dropped on sign out.
  React.useEffect(() => {
    if (userId === null) {
      setProfile(null);
      return;
    }

    let active = true;
    void supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setProfile(data);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const signUp = React.useCallback(
    async (email: string, password: string, fullName: string): Promise<SignUpResult> => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          // Where the confirmation link sends them back to. Without this the
          // project's Site URL is used, which defaults to a port this app
          // does not run on, so the link would dead-end.
          ...(typeof window === "undefined"
            ? {}
            : { emailRedirectTo: `${window.location.origin}/account` }),
        },
      });

      if (error) return { error: describeError(error), needsConfirmation: false };
      // No session back means the project requires email confirmation.
      return { error: null, needsConfirmation: data.session === null };
    },
    [],
  );

  const signIn = React.useCallback(async (email: string, password: string): Promise<Result> => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return { error: error ? describeError(error) : null };
  }, []);

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const updateProfile = React.useCallback(
    async (patch: Partial<Omit<Profile, "id" | "created_at" | "updated_at">>): Promise<Result> => {
      if (userId === null) return { error: "You need to be signed in." };

      // Upsert rather than update: it also covers accounts created before the
      // signup trigger existed.
      const { data, error } = await supabase
        .from("profiles")
        .upsert({ id: userId, ...patch })
        .select()
        .single();

      if (error) return { error: describeError(error) };
      setProfile(data);
      return { error: null };
    },
    [userId],
  );

  const value = React.useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isAdmin: profile?.role === "admin",
      ready,
      signUp,
      signIn,
      signOut,
      updateProfile,
    }),
    [session, profile, ready, signUp, signIn, signOut, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside an <AuthProvider>");
  return context;
}
