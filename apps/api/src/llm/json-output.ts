/**
 * Reads JSON out of a text reply the way the Legacy `generateJSON` did
 * (ADR-023 §2): the first fenced block (```json or ```) if there is one,
 * otherwise the whole reply. Returns `{ json }`, or `undefined` when the
 * reply isn't JSON. Structured outputs replace this in #146.
 */
export function extractJson(text: string): { json: unknown } | undefined {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim();
  const candidate = fenced || text.trim();
  try {
    return { json: JSON.parse(candidate) };
  } catch {
    return undefined;
  }
}
