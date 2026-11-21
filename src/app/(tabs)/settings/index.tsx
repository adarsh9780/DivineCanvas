import React from 'react';
import { useReaderSections } from '../../../ReaderSections';
export default function SettingsHome() {return <>{useReaderSections().renderSettings('menu')}</>;}
