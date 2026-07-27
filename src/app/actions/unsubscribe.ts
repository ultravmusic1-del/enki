"use server";

import { z } from "zod";
import { createAnonClient } from "@/lib/supabase/anon";

const schema = z.object({ email: z.email().max(254) });

/**
 * Remove an address from the newsletter list.
 *
 * anon cannot update `subscribers` directly (the table is insert-only for
 * anon), so this goes through the `unsubscribe_email` SECURITY DEFINER RPC.
 *
 * The response never reveals whether the address was on the list -- otherwise
 * this becomes an oracle for testing which emails are subscribed.
 *
 * Known limitation: identification is by email alone, so someone could
 * unsubscribe an address that is not theirs. That is standard for a pre-send
 * unsubscribe and strictly better than offering no mechanism at all. When
 * email sending is wired up, the link should carry a signed token instead.
 */
export async function unsubscribe(email: string) {
  const parsed = schema.safeParse({ email });
  if (!parsed.success) {
    return { ok: false as const, error: "Enter a valid email address." };
  }

  const supabase = createAnonClient();
  const { error } = await supabase.rpc("unsubscribe_email", {
    target_email: parsed.data.email,
  });

  if (error) {
    console.error("[enki] unsubscribe failed", error);
    return { ok: false as const, error: "Could not update that. Try again." };
  }

  return { ok: true as const };
}
