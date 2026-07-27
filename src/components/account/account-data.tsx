"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/shared/icon";

/**
 * GDPR Art. 15 (access) and Art. 17 (erasure), plus the CCPA equivalents.
 *
 * Export reads through RLS with the caller's own session, so it can only ever
 * return that user's rows. Deletion goes through the delete_own_account RPC,
 * which takes no arguments -- the user id comes from the JWT, so one account
 * can never delete another.
 */
export function AccountData({ email }: { email: string }) {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const onExport = async () => {
    setExporting(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const [profile, reviews, saved, collections, items] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("reviews").select("*").eq("user_id", user.id),
        supabase.from("saved_tools").select("*").eq("user_id", user.id),
        supabase.from("collections").select("*").eq("user_id", user.id),
        supabase.from("collection_items").select("*"),
      ]);

      const payload = {
        exportedAt: new Date().toISOString(),
        account: { id: user.id, email: user.email, createdAt: user.created_at },
        profile: profile.data ?? null,
        reviews: reviews.data ?? [],
        savedTools: saved.data ?? [],
        collections: collections.data ?? [],
        collectionItems: items.data ?? [],
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "enki-my-data.json";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Your data has been downloaded");
    } catch (error) {
      console.error("[enki] data export failed", error);
      toast.error("Could not export your data. Try again.");
    } finally {
      setExporting(false);
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("delete_own_account");
      if (error) throw error;
      await supabase.auth.signOut();
      toast.success("Your account and data have been deleted");
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("[enki] account deletion failed", error);
      toast.error("Could not delete your account. Try again.");
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="ring-hairline flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-xl font-semibold">Export your data</h2>
        <p className="text-sm text-pretty text-muted-foreground">
          Download everything Enki holds about <strong>{email}</strong> as a
          JSON file: your profile, reviews, saved tools, and collections.
        </p>
        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          className="inline-flex h-10 w-fit items-center gap-2 rounded-full border border-border px-5 text-sm transition-colors hover:border-teal/40 hover:text-foreground disabled:opacity-60"
        >
          <Icon name="Download" className="size-4" />
          {exporting ? "Preparing…" : "Download my data"}
        </button>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="font-display text-xl font-semibold">
          Delete your account
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">
          This permanently removes your account, profile, reviews, saved tools,
          and collections. It cannot be undone, and we cannot recover anything
          afterwards. Export your data first if you want a copy.
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
            Type DELETE to confirm
          </span>
          <input
            type="text"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="DELETE"
            className="w-full max-w-xs rounded-xl border border-input bg-background/60 px-3.5 py-2.5 text-sm transition-colors focus:border-destructive/50 focus:ring-2 focus:ring-destructive/30 focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={onDelete}
          disabled={confirm !== "DELETE" || deleting}
          className="inline-flex h-10 w-fit items-center gap-2 rounded-full bg-destructive px-5 text-sm font-semibold text-destructive-foreground transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        >
          <Icon name="Trash2" className="size-4" />
          {deleting ? "Deleting…" : "Delete my account"}
        </button>
      </section>
    </div>
  );
}
