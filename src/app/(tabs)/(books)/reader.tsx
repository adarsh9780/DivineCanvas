import React, { useCallback } from 'react';
import { Stack, useFocusEffect } from 'expo-router';
import { useReaderSections } from '../../../ReaderSections';
import { palettes } from '../../../readingAppearance';
export default function ReaderScreen() {
  const {renderBookScreen,activateBookScreen,readerHeaderLeft,readerHeaderRight,immersive,colorTheme}=useReaderSections();
  const colors=palettes[colorTheme];
  useFocusEffect(useCallback(() => {activateBookScreen('read');},[activateBookScreen]));
  return <><Stack.Screen options={{headerShown:!immersive,title:'',headerTintColor:colors.ink,headerStyle:{backgroundColor:colors.paper},headerShadowVisible:false,headerBackButtonDisplayMode:'minimal',headerBackVisible:true,headerLeft:()=>readerHeaderLeft,headerRight:()=>readerHeaderRight}}/>{renderBookScreen('read')}</>;
}
