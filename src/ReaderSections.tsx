import React, { createContext, useContext } from 'react';
import type { ColorTheme } from './readingAppearance';

export type SettingsPage = 'menu' | 'reading' | 'appearance' | 'playback' | 'music' | 'downloads' | 'walkthroughs' | 'dictionary' | 'language' | 'credits' | 'privacy' | 'chapter-images' | 'chapter-select';
type ReaderSections = {booksContent:React.ReactNode; renderSettings:(page:SettingsPage)=>React.ReactNode; colorTheme:ColorTheme; hideTabs:boolean};
export const ReaderSectionsContext = createContext<ReaderSections | null>(null);
export function useReaderSections():ReaderSections {
  const value=useContext(ReaderSectionsContext);
  if (!value) throw new Error('Missing reader sections provider');
  return value;
}
