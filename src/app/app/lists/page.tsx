import type { Metadata } from "next";
import { ListsClient } from "./ListsClient";

/**
 * A server shell around the client page, so the self-canonical can live here.
 *
 * The alternative was a canonical on the layout, and that is inherited: the
 * detail routes beneath this one — including their noindex fallbacks, which
 * set none of their own — would have started announcing this index page as
 * their canonical. A page's metadata is inherited by nothing, so this is the
 * placement that cannot leak.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/app/lists" },
};

export default function Page() {
  return <ListsClient />;
}
