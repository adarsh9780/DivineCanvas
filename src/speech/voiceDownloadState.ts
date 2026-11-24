export type VoiceDownloadResult = 'success' | 'cancelled' | 'offline' | 'failed';
export type VoiceDownloadState =
  | {kind:'notDownloaded';bytes:number}
  | {kind:'downloading';progress:number}
  | {kind:'downloaded'}
  | {kind:'failed';bytes:number};
export function voiceDownloadState(installed:boolean, downloading:boolean, progress:number|null, failed:boolean, bytes:number):VoiceDownloadState {
  if(downloading)return {kind:'downloading',progress:Math.max(0,Math.min(1,progress ?? 0))};
  if(installed)return {kind:'downloaded'};
  return failed?{kind:'failed',bytes}:{kind:'notDownloaded',bytes};
}
export function networkOffline(state:{type?:string;isConnected?:boolean;isInternetReachable?:boolean}):boolean {
  if(state.type==='NONE')return true;
  if(!state.type || state.type==='UNKNOWN')return false;
  return state.isConnected===false || state.isInternetReachable===false;
}
export function needsCellularConfirmation(state:{type?:string},bytes:number):boolean {return state.type==='CELLULAR' && bytes>50000000;}
