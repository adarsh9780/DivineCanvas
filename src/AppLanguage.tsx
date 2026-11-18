import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { translate, type AppLanguage } from './uiTranslations';

type LanguageContext = {appLanguage:AppLanguage; setAppLanguage:(value:AppLanguage)=>Promise<void>; t:(english:string)=>string};
const Context = createContext<LanguageContext | null>(null);
export function AppLanguageProvider({children}:{children:React.ReactNode}) {
  const [language,setLanguage] = useState<AppLanguage>('en');
  const languageRef = useRef<AppLanguage>('en');
  const [ready,setReady] = useState(false);
  const database = useRef<SQLite.SQLiteDatabase|null>(null);
  const writes = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    let live=true;
    (async () => {
      const db=await SQLite.openDatabaseAsync('kgram.db');
      await db.execAsync('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)');
      const row=await db.getFirstAsync<{value:string}>('SELECT value FROM settings WHERE key = ?', 'app-language');
      if (live) {database.current=db; if (row?.value==='hi') {languageRef.current='hi'; setLanguage('hi');}}
    })().catch(error => console.warn('Could not load app language',error)).finally(() => {if (live) setReady(true);});
    return () => {live=false;};
  },[]);
  const setAppLanguage = useCallback(async (value:AppLanguage) => {
    if (!database.current) {Alert.alert('Unable to save language', 'Please restart the app and try again.'); return;}
    writes.current = writes.current.catch(() => {}).then(async () => {
      await database.current!.runAsync('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)','app-language',value);
      languageRef.current=value; setLanguage(value);
    });
    try {await writes.current;} catch {Alert.alert(value==='hi' ? 'भाषा सहेजी नहीं जा सकी' : 'Unable to save language',value==='hi' ? 'कृपया फिर प्रयास करें।' : 'Please try again.');}
  },[]);
  const t=useCallback((english:string)=>translate(languageRef.current,english),[]);
  const context=useMemo(()=>({appLanguage:language,setAppLanguage,t}),[language,setAppLanguage,t]);
  if (!ready) return null;
  return <Context.Provider value={context}>{children}</Context.Provider>;
}
export function useAppLanguage():LanguageContext {
  const value=useContext(Context);
  if (!value) throw new Error('Missing app language provider');
  return value;
}
