import { Fragment } from "react";
import { parseArticleBody, splitFounderSection, type Block, type Inline } from "@/lib/news/article-body";

function Inlines({ inlines }: { inlines: Inline[] }) {
  return (
    <>
      {inlines.map((part, i) => {
        if (part.type === "bold") return <strong key={i} className="font-semibold text-foreground">{part.text}</strong>;
        if (part.type === "link") {
          return (
            <a key={i} href={part.href} target="_blank" rel="noopener noreferrer" className="text-teal underline-offset-2 hover:underline">
              {part.text}
            </a>
          );
        }
        return <Fragment key={i}>{part.text}</Fragment>;
      })}
    </>
  );
}

function Blocks({ blocks, headingId }: { blocks: Block[]; headingId?: string }) {
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          return (
            <h2 key={i} id={i === 0 ? headingId : undefined} className="font-display text-2xl font-semibold text-foreground">
              {block.text}
            </h2>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={i} className="flex list-disc flex-col gap-2 pl-5 marker:text-teal">
              {block.items.map((item, j) => (
                <li key={j} className="leading-relaxed text-pretty">
                  <Inlines inlines={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="leading-relaxed text-pretty">
            <Inlines inlines={block.inlines} />
          </p>
        );
      })}
    </>
  );
}

/** A story body in Enki's restricted Markdown. Renders data, never HTML. */
export function ArticleBody({ body }: { body: string }) {
  const { main, founders } = splitFounderSection(parseArticleBody(body));
  return (
    <div className="flex flex-col gap-5 text-base text-foreground/90">
      <Blocks blocks={main} />
      {founders ? (
        <section aria-labelledby="founders-heading" className="flex flex-col gap-4 border-l-2 border-teal/60 pl-5">
          <Blocks blocks={founders} headingId="founders-heading" />
        </section>
      ) : null}
    </div>
  );
}
