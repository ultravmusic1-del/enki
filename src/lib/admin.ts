import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminCheck =
  | { ok: true; userId: string }
  | {
      ok: false;
      reason: "unauthenticated" | "forbidden" | "unavailable";
      error: string;
    };

/**
 * Resolve whether the caller is an admin, without redirecting.
 *
 * Server actions are publicly invokable POST endpoints, so every admin action
 * must call this itself — RLS stops an unauthorized *write*, but it cannot stop
 * an unauthorized caller from reaching the action and triggering its side
 * effects (cache invalidation, revalidation of every route).
 *
 * Fails closed: an unreachable database is "not an admin".
 */
export async function assertAdmin(): Promise<AdminCheck> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      reason: "unauthenticated",
      error: "You need to be signed in to do that.",
    };
  }

  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error) {
    console.error("[enki] is_admin check failed", error);
    return {
      ok: false,
      reason: "unavailable",
      error: "Could not verify your access. Try again in a moment.",
    };
  }
  if (!isAdmin) {
    return {
      ok: false,
      reason: "forbidden",
      error: "Admin access is required for that.",
    };
  }

  return { ok: true, userId: user.id };
}

/**
 * Page-level admin gate. Defence in depth: RLS is the real authority over the
 * data, this keeps non-admins out of the UI and gives them a destination.
 *
 * Returns the admin's user id; never returns for anyone else.
 */
export async function requireAdmin(): Promise<string> {
  const check = await assertAdmin();
  if (!check.ok) {
    redirect(check.reason === "unauthenticated" ? "/login?redirect=/admin" : "/");
  }
  return check.userId;
}
