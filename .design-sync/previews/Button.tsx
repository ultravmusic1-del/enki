import { Button } from "enki";

const row: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

export const Variants = () => (
  <div style={row}>
    <Button>Browse the directory</Button>
    <Button variant="secondary">Compare tools</Button>
    <Button variant="outline">Save for later</Button>
    <Button variant="ghost">Dismiss</Button>
    <Button variant="destructive">Delete account</Button>
    <Button variant="link">View pricing</Button>
  </div>
);

export const Sizes = () => (
  <div style={row}>
    <Button size="xs">Extra small</Button>
    <Button size="sm">Small</Button>
    <Button size="default">Default</Button>
    <Button size="lg">Large</Button>
  </div>
);

export const Disabled = () => (
  <div style={row}>
    <Button disabled>Submitting…</Button>
    <Button variant="outline" disabled>
      Unavailable
    </Button>
  </div>
);
