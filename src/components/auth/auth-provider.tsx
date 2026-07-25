"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type AuthState = {
  user: User | null;
  /** Best-effort display name (from user metadata / email). */
  displayName: string | null;
  /** False once the initial session check resolves. */
  loading: boolean;
  /**
   * True when the signed-in user is in the `admins` table.
   *
   * This is a **cosmetic** flag — it decides whether admin affordances are
   * shown, nothing more. Forging it in the browser gets you a link that
   * redirects straight back out: the real gates are `requireAdmin()` on the
   * admin pages, `assertAdmin()` in every admin server action, and RLS on the
   * data itself.
   */
  isAdmin: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // A single browser client for the app's lifetime.
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Which user id the `is_admin` RPC last confirmed. Storing the id rather than
  // a boolean means a session change invalidates the answer automatically: the
  // derived flag below only trusts it while it matches the current user, so a
  // sign-out or account switch can never leave a stale `true` behind.
  const [confirmedAdminId, setConfirmedAdminId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // Resolve admin membership once per signed-in session. Deliberately no
  // synchronous setState here (the signed-out case is handled by the derived
  // value below), so the react-hooks lint rule stays satisfied.
  useEffect(() => {
    if (!user) return;
    let active = true;

    supabase
      .rpc("is_admin")
      .then(({ data, error }) => {
        if (!active) return;
        // Fail closed: if the check errors, show no admin affordances.
        setConfirmedAdminId(!error && data ? user.id : null);
      });

    return () => {
      active = false;
    };
  }, [user, supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase]);

  const displayName = useMemo(() => {
    if (!user) return null;
    const meta = user.user_metadata as { display_name?: string } | undefined;
    return (
      meta?.display_name?.trim() ||
      user.email?.split("@")[0] ||
      "there"
    );
  }, [user]);

  // Only trust the confirmation while it belongs to the current user, so the
  // flag is false during a session switch until the RPC re-confirms.
  const isAdmin = Boolean(user && confirmedAdminId === user.id);

  const value = useMemo<AuthState>(
    () => ({ user, displayName, loading, isAdmin, signOut }),
    [user, displayName, loading, isAdmin, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
