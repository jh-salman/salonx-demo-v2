/** RAMP master queue list. */
export function rampMasterPath() {
  return "/ramp";
}

/** Per-queue build / preview deep link. */
export function rampQueuePath(queueId) {
  return `/ramp/${encodeURIComponent(String(queueId))}`;
}

/** Public generated-artifact share link. */
export function rampPublicPath(queueId) {
  return `/ramp/public/${encodeURIComponent(String(queueId))}`;
}

/** True when post id is persisted on demo-api (not local-only). */
export function isRampServerPostId(queueId) {
  const id = String(queueId || "");
  return Boolean(id) && !id.startsWith("ramp-post-") && !id.startsWith("ramp-q-");
}

/** Absolute public URL when `window` is available. */
export function rampPublicUrl(queueId) {
  const path = rampPublicPath(queueId);
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}
