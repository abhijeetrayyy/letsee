export type GenreVector = Record<string, number>;

/** Normalized genre-frequency vector from a list of items with a `genres` array. */
export function buildGenreVector(items: { genres?: string[] | null }[]): GenreVector {
  const vec: GenreVector = {};
  for (const item of items) {
    if (Array.isArray(item.genres)) {
      for (const g of item.genres) {
        vec[g] = (vec[g] ?? 0) + 1;
      }
    }
  }
  if (Object.keys(vec).length === 0) return {};
  const mag = Math.sqrt(Object.values(vec).reduce((s, v) => s + v * v, 0));
  for (const key of Object.keys(vec)) {
    vec[key] /= mag;
  }
  return vec;
}

export function cosineSimilarity(a: GenreVector, b: GenreVector): number {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, magA = 0, magB = 0;
  for (const key of allKeys) {
    const va = a[key] ?? 0;
    const vb = b[key] ?? 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export function topGenresFromVector(vec: GenreVector, count: number): string[] {
  return Object.entries(vec)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([g]) => g);
}
