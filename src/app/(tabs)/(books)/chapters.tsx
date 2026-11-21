import React from 'react';
import { Stack } from 'expo-router';
import { useReaderSections } from '../../../ReaderSections';
import { useAppLanguage } from '../../../AppLanguage';
import { palettes } from '../../../readingAppearance';
export default function ChaptersScreen() {
  const {chaptersContent,colorTheme}=useReaderSections();
  const {t}=useAppLanguage();
  const colors=palettes[colorTheme];
  return <><Stack.Screen options={{title:t('Chapters'),headerBackButtonDisplayMode:'minimal',headerTintColor:colors.ink,headerStyle:{backgroundColor:colors.paper},headerShadowVisible:false}}/>{chaptersContent}</>;
}
