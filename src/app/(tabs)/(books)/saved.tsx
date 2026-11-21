import React, { useCallback } from 'react';
import { Stack, useFocusEffect } from 'expo-router';
import { useReaderSections } from '../../../ReaderSections';
import { useAppLanguage } from '../../../AppLanguage';
import { palettes } from '../../../readingAppearance';
export default function SavedScreen() {
  const {renderBookScreen,activateBookScreen,colorTheme}=useReaderSections();
  const {t}=useAppLanguage(); const colors=palettes[colorTheme];
  useFocusEffect(useCallback(() => {activateBookScreen('saved');},[activateBookScreen]));
  return <><Stack.Screen options={{headerShown:true,title:t('Saved passages'),headerTintColor:colors.ink,headerStyle:{backgroundColor:colors.paper},headerShadowVisible:false,headerBackButtonDisplayMode:'minimal'}}/>{renderBookScreen('saved')}</>;
}
