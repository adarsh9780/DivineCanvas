/** Indices are zero-based and the board is row-major. */
export function locateCell(x:number,y:number,size:number):number|null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || size<=0 || x<0 || y<0 || x>=size || y>=size) return null;
  return Math.floor(y*15/size)*15+Math.floor(x*15/size);
}
export function isEdgeCell(index:number):boolean {
  if (!Number.isInteger(index) || index<0 || index>=225) return false;
  const row=Math.floor(index/15),col=index%15;
  return row===0 || row===14 || col===0 || col===14;
}
export function resultForCell(index:number):number {
  if (!Number.isInteger(index) || index<0 || index>=225) throw new RangeError('Invalid Shalaka square');
  return index%9;
}
