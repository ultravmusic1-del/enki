import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side admin gate. Defence in depth: RLS is the real authority (all
 * admin data is protected by policies), this just keeps non-admins out of the
 * UI and gives them a sensible destination.
 *
 * Returns the admin's user id; never returns for non-admins.
 */
export async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/admin");

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/");

  return user.id;
}
