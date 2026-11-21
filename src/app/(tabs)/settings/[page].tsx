import React from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useReaderSections, type SettingsPage } from '../../../ReaderSections';
import { useAppLanguage } from '../../../AppLanguage';
import { palettes } from '../../../readingAppearance';
const pages:SettingsPage[]=['reading','appearance','playback','music','downloads','walkthroughs','dictionary','language','credits','privacy','chapter-images','chapter-select'];
export default function SettingsDetail() {
  const {page}=useLocalSearchParams<{page:string}>();
  const {renderSettings,colorTheme}=useReaderSections();
  const {t,appLanguage}=useAppLanguage();
  const {width}=useWindowDimensions();
  const isWideIPad=Platform.OS==='ios' && Platform.isPad && width>=700;
  const labels:Record<Exclude<SettingsPage,'menu'>,string>={reading:t('Reading customisation'),appearance:t('App appearance'),playback:t('Reading playback'),music:t('Music'),downloads:t('Downloaded resources'),walkthroughs:appLanguage==='hi'?'परिचय':'Walkthroughs',dictionary:t('Dictionary'),language:t('App language'),credits:t('Credits'),privacy:appLanguage==='hi'?'गोपनीयता':'Privacy','chapter-images':appLanguage==='hi'?'अध्याय के चित्र':'Chapter images','chapter-select':appLanguage==='hi'?'अध्याय चुनें':'Choose chapter'};
  const selected=pages.includes(page as SettingsPage) ? page as Exclude<SettingsPage,'menu'> : 'language';
  const colors=palettes[colorTheme];
  return <><Stack.Screen options={{headerShown:!isWideIPad,title:labels[selected],headerBackButtonDisplayMode:'minimal',headerTintColor:colors.ink,headerStyle:{backgroundColor:colors.paper},headerShadowVisible:false}}/>{renderSettings(selected)}</>;
}
