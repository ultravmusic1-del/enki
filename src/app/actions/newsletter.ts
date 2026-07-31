"use server";

import { headers } from "next/headers";
import { createAnonClient } from "@/lib/supabase/anon";
import { newsletterSchema } from "@/lib/schemas";
import { allowWrite } from "@/lib/rate-limit";

/**
 * Record a newsletter subscription. Validated server-side; written with the
 * anonymous client (RLS allows insert only — the list is admin-read). Duplicate
 * emails are ignored so re-subscribing is a friendly no-op rather than an error.
 */
export async function subscribe(email: string, hp?: string) {
  // A filled honeypot means a bot. Report success so it learns nothing.
  if (hp) return { ok: true as const };

  // The honeypot stops naive form-fillers and nothing stops a script, so
  // without this a loop could subscribe arbitrary third-party addresses.
  // Headers are passed explicitly: the limiter reads an ambient request context
  // otherwise, and throws when it is absent.
  if (!(await allowWrite("newsletter", { headers: await headers() }))) {
    return { ok: false as const, error: "Too many attempts. Try again later." };
  }

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
