import React from 'react';
import { useReaderSections } from '../../ReaderSections';
export default function BooksTab() {return <>{useReaderSections().booksContent}</>;}
