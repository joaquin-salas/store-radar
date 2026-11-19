/**
 * Best-effort request limit per visitor. It lives in the function's memory, so
 * each server instance counts on its own; the AI Gateway budget is the hard cap.
 */
const hits = new Map<string, number[]>();

export function allowRequest(key: string, limit: number, windowMs: number, nowMs: number): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => nowMs - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(nowMs);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear(); // keep memory bounded
  return true;
}
