import React, { useEffect, useRef } from 'react';
import { useReaderSections } from '../../../ReaderSections';
export default function NativeSheet() {
  const {dictionaryContent, clearDictionary} = useReaderSections();
  const cleanup = useRef(clearDictionary);
  useEffect(() => { const close = cleanup.current; return () => close(); }, []);
  return <>{dictionaryContent}</>;
}
