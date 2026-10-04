/**
 * Read every row of a query, a page at a time. PostgREST returns at most
 * 1,000 rows per request by default, and some reads here are larger — an
 * account with 9,000 watched episodes lost most of them to that cap. The
 * query must be ordered by something unique, or pages can overlap.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  { pageSize = 1000, max = 50000 }: { pageSize?: number; max?: number } = {},
): Promise<{ rows: T[]; error: unknown }> {
  const rows: T[] = [];
  for (let from = 0; from < max; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) return { rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return { rows, error: null };
}
