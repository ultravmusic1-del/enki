"use client";

import { useState } from "react";
import { Icon } from "@/components/shared/icon";
import { MAX_STORY_TOOLS } from "@/lib/news/schemas";
import type { ToolOption } from "@/app/admin/news/types";

export function ToolPicker({
  value,
  onChange,
  tools,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  tools: ToolOption[];
}) {
  const [query, setQuery] = useState("");
  const nameOf = new Map(tools.map((t) => [t.slug, t.name]));
  const full = value.length >= MAX_STORY_TOOLS;
  const q = query.trim().toLowerCase();
  const matches = q
    ? tools
        .filter((t) => !value.includes(t.slug) && (t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q)))
        .slice(0, 6)
    : [];

  const add = (slug: string) => {
    onChange([...value, slug]);
    setQuery("");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((slug) => (
          <span key={slug} className="inline-flex items-center gap-1 rounded-full border border-teal/40 bg-teal/10 py-1 pr-1.5 pl-3 text-xs text-teal">
            {nameOf.get(slug) ?? slug}
            <button
              type="button"
              aria-label={`Remove ${nameOf.get(slug) ?? slug}`}
              onClick={() => onChange(value.filter((s) => s !== slug))}
              className="grid size-6 place-items-center rounded-full hover:bg-teal/20"
            >
              <Icon name="X" className="size-3" />
            </button>
          </span>
        ))}
        {value.length === 0 ? (
          <span className="text-xs text-muted-foreground">No tools. This story will earn nothing.</span>
        ) : null}
      </div>
      <input
        value={query}
        disabled={full}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (matches[0]) add(matches[0].slug);
          }
        }}
        placeholder={full ? `${MAX_STORY_TOOLS} tools is the limit` : "Add a tool"}
        className="h-9 rounded-xl border border-input bg-background/60 px-3 text-sm focus:border-teal/50 focus:ring-2 focus:ring-ring/40 focus:outline-none disabled:opacity-50"
      />
      {matches.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {matches.map((tool) => (
            <li key={tool.slug}>
              <button
                type="button"
                onClick={() => add(tool.slug)}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-teal/40 hover:text-foreground"
              >
                + {tool.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
