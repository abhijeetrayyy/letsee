import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MediaCard from "@components/cards/MediaCard";
import PersonHero from "@components/person/PersonHero";
import PersonWork from "@components/person/PersonWork";
import RecurringRoles from "@components/person/RecurringRoles";
import AsThemselves from "@components/person/AsThemselves";
import PersonPortraits from "@components/person/PersonPortraits";
import LifeSection from "@components/person/LifeSection";
import PersonExtras from "./PersonExtras";
import { getPerson } from "@/utils/person/fetch";
import { buildCredits, recurringRoles } from "@/utils/person/model";
import { definingWork, careerLine } from "@/utils/person/rank";
import { personLife } from "@/utils/person/dates";
import JsonLd from "@components/seo/JsonLd";
import { personLd, breadcrumbLd } from "@/utils/structuredData";
import { personPath } from "@/utils/urls";

const TMDB_IMAGE = "https://image.tmdb.org/t/p";

/** Matches the movie/TV routes. The old `split("-")[0]` was a second convention. */
function numericId(raw: string): string | null {
  const m = String(raw).match(/^\d+/);
  return m ? m[0] : null;
}

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const n = numericId(id);
  if (!n) return { title: "Person" };
  // `getPerson` is React.cache'd, so this shares the page's single request
  // rather than paying a second throttle slot and a second parse.
  const p = await getPerson(n);
  if (!p?.name) return { title: "Person" };

  const bio = typeof p.biography === "string" ? p.biography.trim() : "";
  const description = bio ? bio.slice(0, 160) + (bio.length > 160 ? "…" : "") : `Profile for ${p.name}`;
  const image = p.profile_path ? `${TMDB_IMAGE}/w500${p.profile_path}` : undefined;

  return {
    title: `${p.name}`,
    description,
    // Three URLs served identical content and none declared a canonical. It
    // now names the slugged form, so an index consolidates on the URL that
    // carries the name rather than the bare id.
    alternates: { canonical: personPath(n, p.name) },
    openGraph: {
      type: "profile",
      title: `${p.name}`,
      description,
      url: personPath(n, p.name),
      ...(image && { images: [{ url: image, width: 500, height: 750, alt: p.name }] }),
    },
    twitter: { card: "summary_large_image", title: p.name, description },
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-bold text-white">{title}</h2>
      {children}
    </section>
  );
}

export default async function PersonPage({ params }: PageProps) {
  const { id } = await params;
  const n = numericId(id);
  if (!n) return notFound();

  const person = await getPerson(n);
  // An explicit data check, not a string match on the fetch error — the old
  // route tested `message.includes("404")`, so "Person full: 500 Internal
  // Server Error" reached the user as body text.
  if (!person?.name) return notFound();

  const credits = buildCredits(person.combined_credits?.cast ?? [], person.combined_credits?.crew ?? []);
  const life = personLife(person);
  const kfd: string | null = person.known_for_department ?? null;
  const birthYear = life.born ? Number(life.born.iso.slice(0, 4)) : null;

  const defining = definingWork(credits, kfd ?? undefined, 8);
  const roles = recurringRoles(credits, person.name);
  const profiles: { file_path: string }[] = person.images?.profiles ?? [];

  const posterWall = credits
    .filter((c) => c.bucket === "performance" && c.posterPath)
    .sort((a, b) => b.voteCount - a.voteCount)
    .slice(0, 16)
    .map((c) => c.posterPath as string);

  // Seeds for the streamed segment. Selection is free — every field it ranks
  // on is already in the payload above.
  const seeds = definingWork(credits, kfd ?? undefined, 14).filter((c) => c.bucket === "performance");

  return (
    <>
      <JsonLd
        data={[
          personLd(person),
          breadcrumbLd([
            { name: "People", path: "/app/person" },
            { name: person.name, path: personPath(person.id, person.name) },
          ]),
        ]}
      />
    <div className="min-h-screen bg-surface-950">
      <div className="mx-auto max-w-[1400px] space-y-12 px-4 py-8 sm:px-6 lg:px-8">
        <PersonHero
          name={person.name}
          profilePath={person.profile_path ?? null}
          roleLine={kfd}
          careerLine={careerLine(credits, birthYear)}
          life={life}
          externalIds={{ ...(person.external_ids ?? {}), homepage: person.homepage ?? null }}
          posterWall={posterWall}
        />

        {/* The only cards on the page with actions in a grid — eight, not the
            346 context subscribers a full filmography of MediaCards would be. */}
        {defining.length >= 4 && (
          <Section title="Known for">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {defining.map((c, i) => (
                <MediaCard
                  key={c.key}
                  id={c.id}
                  title={c.title}
                  mediaType={c.mediaType}
                  posterPath={c.posterPath}
                  genres={[]}
                  showActions
                  rank={i + 1}
                  releaseDate={c.date || null}
                  rating={c.voteAverage || null}
                  voteCount={c.voteCount || null}
                />
              ))}
            </div>
          </Section>
        )}

        <Section title="The work">
          <PersonWork credits={credits} knownForDepartment={kfd} />
        </Section>

        {roles.length > 0 && (
          <Section title="Recurring roles">
            <RecurringRoles roles={roles} />
          </Section>
        )}

        {/* Streamed: the only fan-out on the page, so nothing above waits on it. */}
        <Suspense fallback={null}>
          <PersonExtras
            personId={Number(n)}
            seeds={seeds}
            showOnScreen={(kfd ?? "Acting") === "Acting"}
          />
        </Suspense>

        {profiles.length >= 4 && (
          <Section title={`Portraits (${profiles.length})`}>
            <PersonPortraits name={person.name} profiles={profiles} />
          </Section>
        )}

        <AsThemselves credits={credits} />

        {(person.biography || person.also_known_as?.length) && (
          <Section title="Life">
            <LifeSection biography={person.biography} alsoKnownAs={person.also_known_as} />
          </Section>
        )}
      </div>
    </div>
    </>
  );
}
