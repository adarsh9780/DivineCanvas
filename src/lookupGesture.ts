export type Tap = {time: number; x: number; y: number; passageId: string};
export function isDoubleTap(previous: Tap | null, next: Tap): boolean {
  return !!previous && previous.passageId === next.passageId && next.time - previous.time >= 0 && next.time - previous.time <= 350 && Math.hypot(next.x - previous.x, next.y - previous.y) <= 28;
}
export function selectedLookupWord(text: string, start: number, end: number): string | null {
  if (start === end) return null;
  const selected = text.slice(start, end).trim().replace(/^[^\p{L}\p{M}]+|[^\p{L}\p{M}]+$/gu, '');
  return /^[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*$/u.test(selected) ? selected : null;
}

export type TextSegment = {text:string; start:number; end:number; word:boolean};
/** Offsets use JavaScript UTF-16 indexing, matching String.slice. Whitespace and punctuation are retained. */
export function segmentPassage(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const pattern = /[\p{L}\p{N}][\p{L}\p{M}\p{N}\u200c\u200d]*(?:['’\-][\p{L}\p{N}][\p{L}\p{M}\p{N}\u200c\u200d]*)*/gu;
  let previous = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    if (start > previous) segments.push({text:text.slice(previous, start),start:previous,end:start,word:false});
    const end = start + match[0].length;
    segments.push({text:match[0],start,end,word:true});
    previous = end;
  }
  if (previous < text.length) segments.push({text:text.slice(previous),start:previous,end:text.length,word:false});
  return segments;
}
export function selectionRange(anchorStart:number, anchorEnd:number, wordStart:number, wordEnd:number) {
  return {start:Math.min(anchorStart, wordStart),end:Math.max(anchorEnd, wordEnd)};
}
