export class SwrFetchError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Shared SWR fetcher for internal /api/* JSON routes. Throws on non-OK so SWR's `error` return populates. */
export async function swrFetcher<T = any>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new SwrFetchError(`Request to ${url} failed with ${res.status}`, res.status);
  }
  return res.json();
}
