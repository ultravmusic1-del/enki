import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "enki";

export const ToolCard = () => (
  <Card style={{ maxWidth: 420 }}>
    <CardHeader>
      <CardTitle>Cursor</CardTitle>
      <CardDescription>
        An AI-first code editor built on VS Code, with repo-wide context and
        multi-file edits.
      </CardDescription>
      <CardAction>
        <Badge variant="outline">Coding &amp; Dev</Badge>
      </CardAction>
    </CardHeader>
    <CardContent>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
        Pair-programming that keeps up. Strong on large refactors, weaker on
        very long-running agentic tasks.
      </p>
    </CardContent>
    <CardFooter style={{ display: "flex", gap: 12 }}>
      <Button size="sm">Visit site</Button>
      <Button size="sm" variant="ghost">
        Save
      </Button>
    </CardFooter>
  </Card>
);

export const Minimal = () => (
  <Card style={{ maxWidth: 420 }}>
    <CardHeader>
      <CardTitle>Human-vetted</CardTitle>
      <CardDescription>
        Every tool is used in real workflows by our editors, not judged from a
        landing page.
      </CardDescription>
    </CardHeader>
  </Card>
);
