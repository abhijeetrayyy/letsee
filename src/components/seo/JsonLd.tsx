/**
 * A schema.org graph, rendered into the page.
 *
 * Server component with no client cost: this is a script tag with a string in
 * it, and it has to be in the HTML a crawler is *served* rather than added
 * after hydration — plenty of crawlers never run the JavaScript that would add
 * it later.
 *
 * `<` is escaped because a film title containing `</script>` would otherwise
 * close this tag and spill the rest of the graph into the document as markup.
 * Titles are strings from an external API; treating them as trusted here is how
 * an injection gets in.
 */
export default function JsonLd({
  data,
}: {
  data: Record<string, unknown> | Record<string, unknown>[];
}) {
  const payload = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      // Serialised here from typed objects — never caller-supplied markup.
      dangerouslySetInnerHTML={{ __html: payload }}
    />
  );
}
