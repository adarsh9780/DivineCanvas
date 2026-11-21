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
/** Move one available track while leaving undownloaded tracks in their saved slots. */
export function moveAvailableMusic(order: readonly string[], available: readonly string[], fromId:string, toId:string):string[] {
  const visible=order.filter(id => available.includes(id));
  const from=visible.indexOf(fromId), to=visible.indexOf(toId);
  if (from<0 || to<0 || from===to) return [...order];
  visible.splice(to,0,visible.splice(from,1)[0]);
  let i=0;
  return order.map(id => available.includes(id) ? visible[i++] : id);
}
export function musicDropTarget(available:readonly string[], layouts:Record<string,{y:number;height:number}>, id:string, dy:number):string {
  const source=layouts[id]; if (!source) return id;
  const position=source.y+source.height/2+dy;
  let target=id, distance=Math.abs(dy);
  for (const candidate of available) {
    const row=layouts[candidate]; if (!row) continue;
    const candidateDistance=Math.abs(position-(row.y+row.height/2));
    if (candidateDistance<distance) {target=candidate; distance=candidateDistance;}
  }
  return target;
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
