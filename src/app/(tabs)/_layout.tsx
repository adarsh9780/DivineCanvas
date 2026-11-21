import React from 'react';
import { NativeTabs } from 'expo-router/native-tabs';
import ReaderProvider from '../../ReaderApp';
import { useReaderSections } from '../../ReaderSections';
import { useAppLanguage } from '../../AppLanguage';
import { palettes } from '../../readingAppearance';

function SectionTabs() {
  const {appLanguage}=useAppLanguage();
  const {colorTheme,hideTabs}=useReaderSections();
  return <NativeTabs hidden={hideTabs} tintColor={palettes[colorTheme].accent}>
    <NativeTabs.Trigger name="index"><NativeTabs.Trigger.Icon sf="book" md="menu_book"/><NativeTabs.Trigger.Label>{appLanguage==='hi'?'पुस्तकें':'Books'}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="explore"><NativeTabs.Trigger.Icon sf="sparkles" md="explore"/><NativeTabs.Trigger.Label>{appLanguage==='hi'?'अन्वेषण':'Explore'}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="settings"><NativeTabs.Trigger.Icon sf="gearshape" md="settings"/><NativeTabs.Trigger.Label>{appLanguage==='hi'?'सेटिंग':'Settings'}</NativeTabs.Trigger.Label></NativeTabs.Trigger>
  </NativeTabs>;
}
export default function TabLayout() {return <ReaderProvider><SectionTabs/></ReaderProvider>;}
