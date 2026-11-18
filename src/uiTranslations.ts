import hi from './data/ui-hi.json';
export type AppLanguage = 'en' | 'hi';
export const translate = (language:AppLanguage, english:string):string => language === 'hi' ? (hi as Record<string,string>)[english] ?? english : english;
