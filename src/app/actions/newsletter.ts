"use server";

import { createAnonClient } from "@/lib/supabase/anon";
import { newsletterSchema } from "@/lib/schemas";

/**
 * Record a newsletter subscription. Validated server-side; written with the
 * anonymous client (RLS allows insert only — the list is admin-read). Duplicate
 * emails are ignored so re-subscribing is a friendly no-op rather than an error.
 */
export async function subscribe(email: string, hp?: string) {
  // A filled honeypot means a bot. Report success so it learns nothing.
  if (hp) return { ok: true as const };

  const parsed = newsletterSchema.safeParse({ email });
  if (!parsed.success) {
    return { ok: false as const, error: "Enter a valid email address." };
  }

  const supabase = createAnonClient();
  // Plain insert (return=minimal) so no SELECT is needed — the list is
  // admin-read only. A duplicate email is a friendly no-op, not an error.
  const { error } = await supabase
    .from("subscribers")
    .insert({ email: parsed.data.email.toLowerCase() });

  if (error) {
    if (error.code === "23505") return { ok: true as const }; // already subscribed
    console.error("[enki] newsletter subscribe failed", error);
    return { ok: false as const, error: "Could not subscribe you. Try again." };
  }
  return { ok: true as const };
}
