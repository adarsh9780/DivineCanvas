import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useReaderSections, type SettingsPage } from '../../../ReaderSections';
const pages:SettingsPage[]=['reading','appearance','playback','music','downloads','walkthroughs','dictionary','language','credits','privacy','chapter-images','chapter-select'];
export default function SettingsDetail() {
  const {page}=useLocalSearchParams<{page:string}>();
  return <>{useReaderSections().renderSettings(pages.includes(page as SettingsPage) ? page as SettingsPage : 'menu')}</>;
}
