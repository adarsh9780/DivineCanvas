import React, { createContext, useContext } from 'react';
import type { ColorTheme } from './readingAppearance';

export type SettingsPage = 'menu' | 'reading' | 'appearance' | 'playback' | 'music' | 'downloads' | 'walkthroughs' | 'dictionary' | 'language' | 'credits' | 'privacy' | 'chapter-images' | 'chapter-select';
type ReaderSections = {renderBookScreen:(view:'books'|'read'|'saved'|'chapters')=>React.ReactNode; activateBookScreen:(view:'books'|'read'|'saved'|'chapters')=>void; readerHeaderLeft:React.ReactNode; readerHeaderRight:React.ReactNode; immersive:boolean; chaptersContent:React.ReactNode; renderSettings:(page:SettingsPage)=>React.ReactNode; colorTheme:ColorTheme; hideTabs:boolean; bookInfoContent:React.ReactNode; dictionaryContent:React.ReactNode; clearBookInfo:()=>void; clearDictionary:()=>void; noteEditor:{id:string; initial:string; save:(note:string)=>Promise<boolean>; close:()=>void}|null};
export const ReaderSectionsContext = createContext<ReaderSections | null>(null);
export function useReaderSections():ReaderSections {
  const value=useContext(ReaderSectionsContext);
  if (!value) throw new Error('Missing reader sections provider');
  return value;
}
