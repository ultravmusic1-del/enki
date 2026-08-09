import { Badge } from "enki";

const row: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
};

export const Variants = () => (
  <div style={row}>
    <Badge>Editor&apos;s pick</Badge>
    <Badge variant="secondary">Freemium</Badge>
    <Badge variant="outline">Coding &amp; Dev</Badge>
    <Badge variant="ghost">Beta</Badge>
    <Badge variant="destructive">Deprecated</Badge>
  </div>
);

export const InContext = () => (
  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <span style={{ fontWeight: 600 }}>Cursor</span>
    <Badge variant="outline">Coding &amp; Dev</Badge>
    <Badge>Sponsored</Badge>
  </div>
);
