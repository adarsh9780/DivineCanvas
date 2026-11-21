/** A drag spanning the control traverses the whole chapter from either end. */
export function chapterScrubPosition(start:number, delta:number, count:number, width:number):number {
  if (count<=1 || width<=0) return 0;
  return Math.max(0,Math.min(count-1,Math.round(start+delta/width*(count-1))));
}
