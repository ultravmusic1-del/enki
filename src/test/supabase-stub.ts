import { vi } from "vitest";

export type StubResult = { data?: unknown; error?: unknown; count?: number };

/**
 * A chainable stand-in for a supabase-js query builder. Every builder method
 * returns the same object, and the object is a thenable that resolves to the
 * configured result — which is exactly how the real lazy builders behave.
 */
export function queryStub(result: StubResult) {
  const stub: Record<string, unknown> = {};
  const methods = [
    "select",
    "insert",
    "update",
    "upsert",
    "delete",
    "eq",
    "in",
    "order",
    "limit",
    "single",
    "maybeSingle",
  ];
  for (const method of methods) {
    stub[method] = vi.fn(() => stub);
  }
  stub.then = (
    onOk: (v: StubResult) => unknown,
    onErr?: (e: unknown) => unknown,
  ) => Promise.resolve(result).then(onOk, onErr);
  return stub as Record<string, ReturnType<typeof vi.fn>> &
    PromiseLike<StubResult>;
}

export type SupabaseStubOptions = {
  /** The signed-in user, or null for a signed-out caller. */
  user?: { id: string } | null;
  /** What the `is_admin` RPC resolves to. */
  isAdmin?: boolean;
  /** An error from the `is_admin` RPC (takes precedence over isAdmin). */
  isAdminError?: unknown;
  /** Result for any `.from(...)` chain. */
  table?: StubResult;
  /** Results for named RPCs other than `is_admin`. */
  rpc?: Record<string, StubResult>;
};

/** Build a Supabase client stub good enough for the server actions under test. */
export function supabaseStub(options: SupabaseStubOptions = {}) {
  const {
    user = { id: "user-1" },
    isAdmin = true,
    isAdminError = null,
    table = { data: [], error: null },
    rpc = {},
  } = options;

  const builder = queryStub(table);

  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user }, error: null })),
    },
    from: vi.fn(() => builder),
    rpc: vi.fn(async (name: string) => {
      if (name === "is_admin") {
        return { data: isAdminError ? null : isAdmin, error: isAdminError };
      }
      return rpc[name] ?? { data: null, error: null };
    }),
  };

  return Object.assign(client, { builder });
}
