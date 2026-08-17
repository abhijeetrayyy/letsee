import RelatedSection from "@components/detail/RelatedSection";
import { getRelated } from "@/utils/relatedData";

/**
 * The related rail, moved off the critical path.
 *
 * Both detail routes awaited `getRelated` in the page body, and it is measured
 * at 2.1–5.4s cold — it walks keywords, people and collections and pays the
 * 120ms TMDB slot on every hop. So the whole page, hero included, waited on a
 * section that lives at the very bottom of it and that most readers never
 * scroll to.
 *
 * Behind a Suspense boundary it costs nothing anybody is looking at.
 */
export default async function RelatedStream(args: Parameters<typeof getRelated>[0]) {
  const items = await getRelated(args);
  if (!items?.length) return null;
  return <RelatedSection items={items} />;
}
