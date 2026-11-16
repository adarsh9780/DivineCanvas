export type Palette = { ink: string; muted: string; paper: string; accent: string; line: string; white: string; onAccent: string; dark: boolean };
export const backgrounds = ['paper', 'white', 'sage', 'night'] as const;
export type ColorTheme = typeof backgrounds[number];
export type Background = ColorTheme | 'images';
export const backgroundLabels: Record<Background, string> = {paper:'Paper',white:'White',sage:'Sage',night:'Night',images:'Images'};
export const palettes: Record<Exclude<Background, 'images'>, Palette> = {
  paper: {ink:'#302b24',muted:'#71695e',paper:'#f5f1e8',accent:'#9c5535',line:'#ded5c7',white:'#fffdf8',onAccent:'#fffdf8',dark:false},
  white: {ink:'#292d31',muted:'#626a71',paper:'#ffffff',accent:'#925032',line:'#e1e4e6',white:'#f4f5f6',onAccent:'#ffffff',dark:false},
  sage: {ink:'#29382d',muted:'#59695c',paper:'#e9efe5',accent:'#48634b',line:'#cbd7c7',white:'#f5f8f1',onAccent:'#ffffff',dark:false},
  night: {ink:'#eeeae2',muted:'#b8b6ad',paper:'#1b201e',accent:'#e4b08a',line:'#3d4640',white:'#282f2b',onAccent:'#1b201e',dark:true},
};
export const fontSizes = [22,26,32] as const;
export type ReadingFontSize = typeof fontSizes[number];
export function parseAppearance(background?: string, fontSize?: string, colorTheme?: string): {background: Background; fontSize: ReadingFontSize; colorTheme: ColorTheme} {
  return {
    background: background === 'images' || backgrounds.includes(background as typeof backgrounds[number]) ? background as Background : 'images',
    fontSize: fontSizes.includes(Number(fontSize) as ReadingFontSize) ? Number(fontSize) as ReadingFontSize : 26,
    colorTheme: backgrounds.includes(colorTheme as ColorTheme) ? colorTheme as ColorTheme : backgrounds.includes(background as ColorTheme) ? background as ColorTheme : 'paper',
  };
}
