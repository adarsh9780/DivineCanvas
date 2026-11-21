import React, { useEffect, useRef } from 'react';
import { useReaderSections } from '../../../ReaderSections';
export default function NativeSheet() {
  const {bookInfoContent, clearBookInfo} = useReaderSections();
  const cleanup = useRef(clearBookInfo);
  useEffect(() => { const close = cleanup.current; return () => close(); }, []);
  return <>{bookInfoContent}</>;
}
