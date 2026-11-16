import type { ImageSourcePropType } from 'react-native';
export type BookImage = {id: string; source: ImageSourcePropType; thumbnail: ImageSourcePropType};
// Images are scoped to this book; other books can provide their own collection.
export const gitaImages: BookImage[] = [
  {id:'gita-01', source:require('../assets/books/gita/background-01.jpg'), thumbnail:require('../assets/books/gita/thumbs/background-01.jpg')},
  {id:'gita-02', source:require('../assets/books/gita/background-02.jpg'), thumbnail:require('../assets/books/gita/thumbs/background-02.jpg')},
  {id:'gita-03', source:require('../assets/books/gita/background-03.jpg'), thumbnail:require('../assets/books/gita/thumbs/background-03.jpg')},
  {id:'gita-04', source:require('../assets/books/gita/background-04.jpg'), thumbnail:require('../assets/books/gita/thumbs/background-04.jpg')},
  {id:'gita-05', source:require('../assets/books/gita/background-05.jpg'), thumbnail:require('../assets/books/gita/thumbs/background-05.jpg')},
  {id:'gita-06', source:require('../assets/books/gita/background-06.jpg'), thumbnail:require('../assets/books/gita/thumbs/background-06.jpg')},
  {id:'gita-07', source:require('../assets/books/gita/background-07.jpg'), thumbnail:require('../assets/books/gita/thumbs/background-07.jpg')},
  {id:'gita-08', source:require('../assets/books/gita/background-08.jpg'), thumbnail:require('../assets/books/gita/thumbs/background-08.jpg')},
  {id:'gita-09', source:require('../assets/books/gita/background-09.jpg'), thumbnail:require('../assets/books/gita/thumbs/background-09.jpg')},
  {id:'gita-10', source:require('../assets/books/gita/background-10.jpg'), thumbnail:require('../assets/books/gita/thumbs/background-10.jpg')},
  {id:'gita-11', source:require('../assets/books/gita/background-11.jpg'), thumbnail:require('../assets/books/gita/thumbs/background-11.jpg')},
  {id:'gita-12', source:require('../assets/books/gita/background-12.jpg'), thumbnail:require('../assets/books/gita/thumbs/background-12.jpg')},
  {id:'gita-13', source:require('../assets/books/gita/background-13.jpg'), thumbnail:require('../assets/books/gita/thumbs/background-13.jpg')},
  {id:'gita-14', source:require('../assets/books/gita/background-14.jpg'), thumbnail:require('../assets/books/gita/thumbs/background-14.jpg')}
];

// A stable, seeded shuffle assigns every selected image once before reuse.
export function chapterImage<T>(images: T[], chapter: number, seed: number): T | undefined {
  if (!images.length || chapter < 1) return undefined;
  const shuffled = [...images];
  let state = (seed >>> 0) || 1;
  for (let i = shuffled.length - 1; i > 0; i--) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    const j = (state >>> 0) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled[(chapter - 1) % shuffled.length];
}
