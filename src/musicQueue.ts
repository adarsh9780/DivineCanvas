/** Preserve a saved order while removing invalid or duplicate IDs and adding new tracks. */
export function normalizeMusicOrder(value: unknown, ids: readonly string[]): string[] {
  const valid = new Set(ids);
  const result: string[] = [];
  if (Array.isArray(value)) for (const id of value) {
    if (typeof id === 'string' && valid.has(id) && !result.includes(id)) result.push(id);
  }
  for (const id of ids) if (!result.includes(id)) result.push(id);
  return result;
}
export function moveMusic(order: readonly string[], id: string, other: string): string[] {
  const result = [...order];
  const a = result.indexOf(id), b = result.indexOf(other);
  if (a >= 0 && b >= 0) [result[a],result[b]] = [result[b],result[a]];
  return result;
}
/** Sequential mode loops in saved order; shuffle never repeats a track consecutively. */
export function nextMusic(available: readonly string[], current: string, shuffle: boolean, random = Math.random()): string | undefined {
  if (!available.length) return undefined;
  if (available.length === 1) return available[0];
  if (shuffle) {
    const choices = available.filter(id => id !== current);
    return choices[Math.min(choices.length - 1, Math.max(0, Math.floor(random * choices.length)))];
  }
  const index = available.indexOf(current);
  return available[(index + 1) % available.length];
}
