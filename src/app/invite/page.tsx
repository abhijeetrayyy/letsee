import { Suspense } from "react";
import InviteDoor from "@components/doors/InviteDoor";

/**
 * The invited door (docs/design/RETHINK.md §3b): someone sent you here.
 *
 * `/invite?from=ray` is a room invite — "ray wants to watch films with you" —
 * and needs nothing but their public name and face, read in the browser. It is
 * a static page with the person in the query, not `/p/[token]`, because a
 * dynamic segment renders on the server for every view; the token-carrying
 * kinds (a pass, a stub, a list) arrive with migration 108 and will use
 * `?t=`. Noindex, like everything here.
 */
export const metadata = {
  title: "You're invited",
  robots: { index: false, follow: false },
};

export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <InviteDoor />
    </Suspense>
  );
}
