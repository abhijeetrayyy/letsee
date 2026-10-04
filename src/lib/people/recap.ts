/** The recap in a sentence a person would say (docs/design/PAGES.md §6). */
export type RecapPerson = { name: string; avatarUrl: string | null; count: number };

export function recapSentence(owner: string, label: string, films: number, series: number, top: RecapPerson | null): string {
  const parts = [films ? `${films} ${films === 1 ? "film" : "films"}` : null, series ? `${series} series` : null].filter(Boolean);
  const what = parts.length ? parts.join(" and ") : "nothing logged";
  const who = top && top.count > 0 ? `, ${top.count} with ${top.name}` : "";
  return `${owner} ${label}: ${what}${who}.`;
}
