import React, { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useReaderSections } from '../../../ReaderSections';
export default function BooksTab() {
  const {renderBookScreen,activateBookScreen}=useReaderSections();
  useFocusEffect(useCallback(() => {activateBookScreen('books');},[activateBookScreen]));
  return <>{renderBookScreen('books')}</>;
}
