/** Divide measured native lines into complete, lossless text slices. */
export type MeasuredLine = {text:string; y:number; height:number};
export type PassageSlice = {start:number; end:number};
export function measuredPassageSlices(text:string, lines:MeasuredLine[], height:number):PassageSlice[] | null {
  if (!text || !lines.length || height <= 0) return null;
  const starts:number[] = [];
  let cursor=0;
  for (const line of lines) {
    if (!line.text || !text.startsWith(line.text,cursor)) return null;
    starts.push(cursor); cursor += line.text.length;
  }
  if (cursor !== text.length) return null;
  const parts:PassageSlice[]=[];
  let first=0;
  for (let i=1; i<lines.length; i++) {
    if (lines[i].y + lines[i].height - lines[first].y > height) {
      parts.push({start:starts[first],end:starts[i]}); first=i;
    }
  }
  parts.push({start:starts[first],end:text.length});
  return parts;
}
