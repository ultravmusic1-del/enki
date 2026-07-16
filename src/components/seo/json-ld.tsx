/**
 * Renders a schema.org JSON-LD block. Server component — the payload is
 * serialized data (not user input), and `<` is escaped so the JSON can never
 * break out of the script element.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
