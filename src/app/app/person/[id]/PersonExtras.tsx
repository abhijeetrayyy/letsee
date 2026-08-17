import Collaborators from "@components/person/Collaborators";
import VideoShelf from "@components/detail/VideoShelf";
import { getTitleGraph, inWaves, type TitleGraph } from "@/utils/person/fetch";
import { collaborators } from "@/utils/person/collaborators";
import type { Credit } from "@/utils/person/model";

/**
 * Everything that needs a second round of network, behind one Suspense
 * boundary.
 *
 * Collaborators and trailers share a single fan-out because they want the same
 * fourteen titles — `/movie/{id}?append_to_response=credits,videos` costs +8KB
 * over `/credits` alone and zero extra requests. Splitting them measured
 * 20 calls / 46.3s against 10 calls / 21.4s for the combined form.
 */
export default async function PersonExtras({
  personId,
  seeds,
  showOnScreen,
}: {
  personId: number;
  seeds: Credit[];
  showOnScreen: boolean;
}) {
  if (seeds.length === 0) return null;

  const graphs = (
    await inWaves(seeds, 6, (c) => getTitleGraph(c.mediaType, c.id).catch(() => null))
  ).filter(Boolean) as TitleGraph[];

  if (graphs.length === 0) return null;

  const nameOf = (g: TitleGraph) =>
    seeds.find((s) => s.id === g.id && s.mediaType === g.mediaType)?.title ?? "";

  const { onScreen, behind } = collaborators(graphs, personId, nameOf);

  /**
   * One video per title, not a pool of videos.
   *
   * VideoShelf's default grouping is by TMDB `type`, which on a person page
   * would scatter each film across five buckets and bury the person entirely —
   * six Nolan titles returned 101 videos. One card per title, named for the
   * title, is the shape that reads.
   */
  const videos = graphs
    .filter((g) => g.video)
    .map((g) => ({
      key: g.video!.key,
      name: `${nameOf(g)} — ${g.video!.name}`,
      site: "YouTube",
      type: "Trailer",
      official: g.video!.official,
    }));

  return (
    <>
      <Collaborators onScreen={onScreen} behind={behind} showOnScreen={showOnScreen} />
      {videos.length >= 3 && (
        <section>
          <h2 className="mb-4 text-xl font-bold text-white">Trailers from their work</h2>
          <VideoShelf videos={videos} />
        </section>
      )}
    </>
  );
}
