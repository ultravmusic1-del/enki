"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";

/* =========================================================================
   Saved tools — bookmarks that follow the user.

   • Signed out: persisted to localStorage (works with no account).
   • Signed in:  persisted to Supabase (`saved_tools`, RLS owner-only), so the
     shortlist syncs across devices.
   • On login:   any local bookmarks are migrated into the account once, then
     the local copy is cleared (the account becomes the source of truth).

   `ready` stays false until the initial load resolves, so consumers can hold a
   skeleton instead of flashing an empty state, and SSR/first paint agree.
   ========================================================================= */

const STORAGE_KEY = "enki:saved-tools";

function readLocal(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === "string")
      : [];
  } catch {
    return [];
  }
}
function writeLocal(slugs: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
  } catch {
    /* storage unavailable — in-memory only */
  }
}
function clearLocal() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

type SavedContextValue = {
  saved: string[];
  count: number;
  ready: boolean;
  isSaved: (slug: string) => boolean;
  toggle: (slug: string) => void;
  remove: (slug: string) => void;
  clear: () => void;
};

const SavedContext = createContext<SavedContextValue | null>(null);

export function SavedToolsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const [supabase] = useState(() => createClient());
  const [saved, setSaved] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  // Load (and, on first login, migrate) whenever the auth state settles.
  useEffect(() => {
    if (authLoading) return;
    let active = true;

    const load = async () => {
      if (!user) {
        if (active) {
          setSaved(readLocal());
          setReady(true);
        }
        return;
      }

      const local = readLocal();
      const { data } = await supabase
        .from("saved_tools")
        .select("tool_slug")
        .eq("user_id", user.id);
      const dbSlugs = (data ?? []).map((r) => r.tool_slug);

      // Migrate any local-only bookmarks into the account, once.
      const toMigrate = local.filter((s) => !dbSlugs.includes(s));
      if (toMigrate.length > 0) {
        await supabase.from("saved_tools").upsert(
          toMigrate.map((tool_slug) => ({ user_id: user.id, tool_slug })),
          { onConflict: "user_id,tool_slug" },
        );
      }
      clearLocal();

      if (active) {
        setSaved([...new Set([...dbSlugs, ...toMigrate])]);
        setReady(true);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [user, authLoading, supabase]);

  // Supabase query builders are lazy thenables — they only run when awaited /
  // .then()'d. This fire-and-forgets the query while surfacing any error.
  const runSync = useCallback((query: PromiseLike<{ error: unknown }>) => {
    Promise.resolve(query).then((res) => {
      if (res?.error) console.error("[saved] sync failed", res.error);
    });
  }, []);

  const dbSaveOff = useCallback(
    (uid: string, slug: string) =>
      supabase
        .from("saved_tools")
        .delete()
        .eq("user_id", uid)
        .eq("tool_slug", slug),
    [supabase],
  );
  const dbSaveOn = useCallback(
    (uid: string, slug: string) =>
      supabase
        .from("saved_tools")
        .upsert(
          { user_id: uid, tool_slug: slug },
          { onConflict: "user_id,tool_slug" },
        ),
    [supabase],
  );

  const toggle = useCallback(
    (slug: string) => {
      const has = saved.includes(slug);
      const next = has ? saved.filter((s) => s !== slug) : [slug, ...saved];
      setSaved(next);
      if (user) runSync(has ? dbSaveOff(user.id, slug) : dbSaveOn(user.id, slug));
      else writeLocal(next);
    },
    [saved, user, dbSaveOff, dbSaveOn, runSync],
  );

  const remove = useCallback(
    (slug: string) => {
      if (!saved.includes(slug)) return;
      const next = saved.filter((s) => s !== slug);
      setSaved(next);
      if (user) runSync(dbSaveOff(user.id, slug));
      else writeLocal(next);
    },
    [saved, user, dbSaveOff, runSync],
  );

  const clear = useCallback(() => {
    setSaved([]);
    if (user) runSync(supabase.from("saved_tools").delete().eq("user_id", user.id));
    else clearLocal();
  }, [user, supabase, runSync]);

  const value = useMemo<SavedContextValue>(
    () => ({
      saved,
      count: saved.length,
      ready,
      isSaved: (slug) => saved.includes(slug),
      toggle,
      remove,
      clear,
    }),
    [saved, ready, toggle, remove, clear],
  );

  return (
    <SavedContext.Provider value={value}>{children}</SavedContext.Provider>
  );
}

export function useSavedTools(): SavedContextValue {
  const ctx = useContext(SavedContext);
  if (!ctx) {
    throw new Error("useSavedTools must be used within a SavedToolsProvider");
  }
  return ctx;
}
