# DivineCanvas: product context and roadmap

Updated: 16 November 2026

## Purpose

DivineCanvas is an offline-first reading app for iPhone and Android. It presents sacred books as short passages that readers swipe through vertically. The experience should be calm and easy to read, with a choice of language, text size, background and optional audio.

## Current experience

- The Books view is the entry point and lists locally available books; Bhagavad Gita is currently the only one. Open a book to resume its last passage. Reader controls open chapters, a book menu with saved verses and settings, and return to Books; there is no bottom navigation bar.
- The Gita has 700 Sanskrit verses with Hindi and English translations from Hansi Gita Bhawan Trust. Hindi is the default; the selected language is remembered.
- Readers can navigate chapters, see chapter progress, save passages, add notes and share passage images. SQLite keeps reading positions, notes and preferences on the device. Positions are scoped by book and chapter; migration retains existing Gita progress and notes.
- Readers can customize the appearance, choose chapter backgrounds, play instrumental music, use timed auto-scroll, and optionally download a modular offline voice for continuous read aloud.
- The bundled book works offline. Voice and dictionary assets require a one-time download. The original Gita dataset is excluded from Git while included in internal EAS preview builds.
- A book registry in `src/book.ts` defines each book's stable ID, chapter list and passages; `src/readingProgress.ts` defines book-scoped position keys and legacy migration. `src/ReaderApp.tsx` contains the reader and navigation.

## Content and rights

The Trust says its Hindi and English translations may be built on with attribution. Obtain explicit confirmation for full offline redistribution in an app with paid features before public release. Check the provenance and rights of every future edition and each translation separately. Do not assume that a repository license clears third-party content. Images supplied by the project owner also require a rights check before release.

A Shiv Mahapuran candidate is at https://huggingface.co/datasets/snskrt/Shiv_Mahapuran. Its card describes Sanskrit-only CSV and claims Apache-2.0, but does not identify the precise source edition; its dataset viewer currently reports a schema error. The pinned data file has 24,489 non-empty Sanskrit rows across seven samhitas and 457 distinct chapter keys, with no duplicate samhita/khanda/chapter/verse keys in the inspected file; it uses `adhyaya`, not the card’s `adhyay` field. These structural checks do not establish textual accuracy or rights. Verify provenance, completeness, accuracy and redistribution rights, and secure an authorized Hindi translation before adding it to the library. Do not invent or silently substitute religious text.

## Future direction

The Gita is intended to remain free. Other books may be sold as individual one-time purchases. The user is considering paid features such as simplified translations, importing personal EPUBs and customizable images for sharing. Payments, accounts, syncing and importing books are not implemented. Verify scope and permissions before implementing them.

Stable book and passage IDs must survive formatting and pagination changes. Preserve user data across updates, verify the book's language availability, and test playback, navigation, offline reading, progress and accessibility on real iOS and Android devices before release.
