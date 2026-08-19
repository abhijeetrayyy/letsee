"use client";

import { useEffect, useState } from "react";

/**
 * False on the server and on the first client render, true afterwards.
 *
 * This is the guard for anything that cannot agree across the two: a portal
 * that needs `document`, or a value derived from the reader's clock. Rendering
 * it on the server produces HTML the client then contradicts, and React calls
 * that a hydration error.
 *
 * It existed five times in this codebase as an inline `const [mounted,
 * setMounted] = useState(false); useEffect(() => setMounted(true), [])`, each
 * with its own version of the explanation. One copy is easier to trust.
 *
 * The disable is the point of having this file. `set-state-in-effect` is right
 * that setting state in an effect usually means the state was not needed — but
 * "has the first render happened yet" is a fact that only an effect can know,
 * and there is no derivation that answers it. Confining the exception to one
 * place is better than repeating it, and better than turning the rule off.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- see above: mount is not derivable
  useEffect(() => setMounted(true), []);
  return mounted;
}
