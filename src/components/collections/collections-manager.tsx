"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { Icon } from "@/components/shared/icon";
import { ToolLogo } from "@/components/shared/tool-logo";
import { cn } from "@/lib/utils";

type ToolOption = { slug: string; name: string; logo?: string; accent: string };
type Collection = { id: string; name: string; is_public: boolean };
type Item = { tool_slug: string; note: string | null };

export function CollectionsManager({ tools }: { tools: ToolOption[] }) {
  const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [items, setItems] = useState<Record<string, Item[]>>({});
  const [newName, setNewName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const toolBySlug = new Map(tools.map((t) => [t.slug, t]));

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("collections")
      .select("id, name, is_public")
      .order("created_at", { ascending: true });
    setCollections(data ?? []);
    setLoaded(true);
  }, [user]);

  useEffect(() => {
    // Async fetch: setState resolves after awaits, not synchronously in the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const loadItems = useCallback(async (collectionId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("collection_items")
      .select("tool_slug, note")
      .eq("collection_id", collectionId)
      .order("created_at", { ascending: true });
    setItems((prev) => ({ ...prev, [collectionId]: data ?? [] }));
  }, []);

  const create = async () => {
    const name = newName.trim();
    if (!name || !user) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("collections")
      .insert({ user_id: user.id, name })
      .select("id, name, is_public")
      .single();
    if (error) return toast.error(error.message);
    setCollections((prev) => [...prev, data]);
    setNewName("");
  };

  const remove = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("collections").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setCollections((prev) => prev.filter((c) => c.id !== id));
  };

  const togglePublic = async (c: Collection) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("collections")
      .update({ is_public: !c.is_public })
      .eq("id", c.id);
    if (error) return toast.error(error.message);
    setCollections((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, is_public: !x.is_public } : x)),
    );
  };

  const addItem = async (collectionId: string, slug: string) => {
    if (!slug) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("collection_items")
      .upsert({ collection_id: collectionId, tool_slug: slug });
    if (error) return toast.error(error.message);
    void loadItems(collectionId);
  };

  const removeItem = async (collectionId: string, slug: string) => {
    const supabase = createClient();
    await supabase
      .from("collection_items")
      .delete()
      .eq("collection_id", collectionId)
      .eq("tool_slug", slug);
    void loadItems(collectionId);
  };

  const saveNote = async (collectionId: string, slug: string, note: string) => {
    const supabase = createClient();
    await supabase
      .from("collection_items")
      .update({ note: note.trim() || null })
      .eq("collection_id", collectionId)
      .eq("tool_slug", slug);
    toast.success("Note saved");
  };

  const copyShare = (id: string) => {
    void navigator.clipboard?.writeText(`${window.location.origin}/lists/${id}`);
    toast.success("Share link copied");
  };

  if (!user) {
    return (
      <div className="glass ring-hairline rounded-2xl border border-border p-8 text-center">
        <h2 className="font-display text-xl font-semibold">
          Sign in to build collections
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Group the tools you&apos;re evaluating, add private notes, and share a
          list with a link.
        </p>
        <Link
          href="/login?redirect=/collections"
          className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-teal px-6 text-sm font-semibold text-[#04171a]"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Create */}
      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="New collection name…"
          className="h-10 flex-1 rounded-xl border border-input bg-background/60 px-3.5 text-sm focus:border-teal/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
        <button
          type="button"
          onClick={create}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-teal px-5 text-sm font-semibold text-[#04171a] hover:bg-teal-bright"
        >
          <Icon name="Plus" className="size-4" />
          Create
        </button>
      </div>

      {loaded && collections.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No collections yet — create your first above.
        </p>
      )}

      {collections.map((c) => {
        const cItems = items[c.id];
        const inCollection = new Set((cItems ?? []).map((i) => i.tool_slug));
        return (
          <div
            key={c.id}
            className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 ring-hairline"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-lg font-semibold">{c.name}</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => togglePublic(c)}
                  className={cn(
                    "rounded-full border px-3 py-1 font-mono text-[0.65rem] tracking-wide uppercase transition-colors",
                    c.is_public
                      ? "border-teal/40 bg-teal/10 text-teal"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c.is_public ? "Public" : "Private"}
                </button>
                {c.is_public && (
                  <button
                    type="button"
                    onClick={() => copyShare(c.id)}
                    aria-label="Copy share link"
                    className="rounded-full border border-border p-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <Icon name="ExternalLink" className="size-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  aria-label="Delete collection"
                  className="rounded-full border border-border p-1.5 text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                >
                  <Icon name="X" className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Add a tool */}
            <div className="flex gap-2">
              <select
                defaultValue=""
                onChange={(e) => {
                  addItem(c.id, e.target.value);
                  e.currentTarget.value = "";
                }}
                onFocus={() => cItems === undefined && loadItems(c.id)}
                className="h-9 flex-1 rounded-lg border border-input bg-background/60 px-3 text-sm focus:border-teal/50 focus:outline-none"
              >
                <option value="">Add a tool…</option>
                {tools
                  .filter((t) => !inCollection.has(t.slug))
                  .map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Items */}
            <div className="flex flex-col gap-2">
              {(cItems ?? []).map((item) => {
                const tool = toolBySlug.get(item.tool_slug);
                if (!tool) return null;
                return (
                  <div
                    key={item.tool_slug}
                    className="flex items-start gap-3 rounded-xl border border-border bg-card/50 p-3"
                  >
                    <ToolLogo
                      name={tool.name}
                      accent={tool.accent}
                      logo={tool.logo}
                      size="sm"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Link
                        href={`/tools/${tool.slug}`}
                        className="text-sm font-medium hover:text-teal"
                      >
                        {tool.name}
                      </Link>
                      <input
                        defaultValue={item.note ?? ""}
                        onBlur={(e) => saveNote(c.id, tool.slug, e.target.value)}
                        placeholder="Add a private note…"
                        className="h-8 rounded-lg border border-input bg-background/60 px-2.5 text-xs focus:border-teal/50 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(c.id, tool.slug)}
                      aria-label="Remove from collection"
                      className="rounded-full p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Icon name="X" className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
