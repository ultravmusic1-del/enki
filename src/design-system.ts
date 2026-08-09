/**
 * Design-system entry — the public surface synced to claude.ai/design.
 *
 * Enki is an application, not a component library, so it ships no dist/.
 * This module is the explicit export surface the design-sync converter
 * bundles: the shadcn/Radix primitives under src/components/ui, which are
 * self-contained (no Supabase, auth context, or Next routing) and therefore
 * render standalone. Feature components live outside this entry on purpose —
 * they depend on app providers and data, and would render broken in a
 * design tool.
 *
 * Not imported by the app. Adding a primitive here publishes it.
 */
export * from "./components/ui/accordion";
export * from "./components/ui/avatar";
export * from "./components/ui/badge";
export * from "./components/ui/button";
export * from "./components/ui/card";
export * from "./components/ui/checkbox";
export * from "./components/ui/command";
export * from "./components/ui/dialog";
export * from "./components/ui/dropdown-menu";
export * from "./components/ui/input-group";
export * from "./components/ui/input";
export * from "./components/ui/label";
export * from "./components/ui/popover";
export * from "./components/ui/scroll-area";
export * from "./components/ui/select";
export * from "./components/ui/separator";
export * from "./components/ui/sheet";
export * from "./components/ui/skeleton";
export * from "./components/ui/slider";
export * from "./components/ui/sonner";
export * from "./components/ui/tabs";
export * from "./components/ui/textarea";
export * from "./components/ui/tooltip";
export { DesignSystemRoot } from "./lib/design-system-root";
