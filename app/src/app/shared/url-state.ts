/**
 * Page state in the query string, so a view can be linked to. Reads go through URLSearchParams;
 * writes use `history.replaceState`, not the Router, because a router navigation fires
 * NavigationEnd and RouteTransitionDirective would replay the page reveal on every slider move.
 * Empty and null values drop the key, so the default state is the bare URL.
 */
export function readQuery(): URLSearchParams {
  return new URLSearchParams(location.search);
}

export function writeQuery(params: Record<string, string | number | null | undefined>): void {
  const q = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') q.delete(k);
    else q.set(k, String(v));
  }
  // Keep list separators readable: `select=FJ2925,FJ2933`, not `%2C`.
  const s = q.toString().replace(/%2C/g, ',');
  // Absolute path on purpose: with <base href="./"> a relative URL would resolve against the site root.
  history.replaceState(history.state, '', `${location.pathname}${s ? `?${s}` : ''}${location.hash}`);
}
