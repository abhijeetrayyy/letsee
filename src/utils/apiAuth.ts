import { createClient } from "@/utils/supabase/server";

/**
 * The signed-in user's id, or null.
 *
 * Uses getClaims() rather than getUser(). getUser() asks Supabase's auth server
 * to validate the token on *every* call, and this app fires a dozen or more API
 * requests per page across 75 routes that need the caller's identity. That was
 * a dozen auth round trips per page view — slow, needless load on a free-tier
 * project, and the source of the random sign-outs: when the access token had
 * expired, those parallel requests each tried to redeem the same refresh token,
 * Supabase rotated it for whichever arrived first, and the losers saw an
 * already-used token and reported "not signed in".
 *
 * This project signs tokens with ES256 and publishes a JWKS, so getClaims
 * verifies the signature locally against the cached public key — no network
 * call, no race, and the same cryptographic guarantee. Expiry is still checked.
 *
 * The trade: getUser() would notice a user deleted or banned partway through a
 * token's life, whereas a locally verified token stays valid until it expires
 * (one hour). Refreshing still goes through the auth server, so a revoked user
 * cannot renew — worst case they keep a working token for the remainder of the
 * hour. For this app that is the right trade, and it is what Supabase
 * recommends for exactly this reason.
 */
export async function getAuthUserId(): Promise<string | null> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase.auth.getClaims();
    if (!error && data?.claims?.sub) return data.claims.sub;
  } catch {
    // Fall through — a malformed token or an unreachable JWKS shouldn't take
    // the request down, it should just be treated as unauthenticated below.
  }

  // Symmetric-key projects, or anything getClaims couldn't settle: ask the
  // server. Correctness first; this path just costs a round trip.
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}
