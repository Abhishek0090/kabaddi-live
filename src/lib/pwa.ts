/** Page cache prefix used by public/sw.js. Keep the two in step. */
export const PAGE_CACHE_PREFIX = "pages-";

/** Removes cached pages so a shared device doesn't keep an admin's control panel. */
export async function clearPageCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.startsWith(PAGE_CACHE_PREFIX)).map((k) => caches.delete(k)));
}
