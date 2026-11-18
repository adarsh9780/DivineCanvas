# DivineCanvas: product context and roadmap

Updated: 17 November 2026

## Purpose

DivineCanvas is an offline-first reading app for iPhone and Android. It presents sacred books as short passages that readers swipe through vertically. The experience should be calm and easy to read, with a choice of language, text size, background and optional audio.

## Current experience

- The Books view is the entry point and lists locally available books; Bhagavad Gita, Ramayana and Mahabharata are included as local previews. Open a book to resume its last passage. Reader controls open chapters, a book menu with saved verses and settings, and return to Books; there is no bottom navigation bar.
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

## Monetization and offline access — ideas for discussion

The user wants to earn revenue without requiring a DivineCanvas account. The Bhagavad Gita should remain free and available offline. Other books were previously proposed as separate one-time purchases. Paid features may include simplified explanations/translations, importing personal EPUBs, and customizable images for sharing. These are product ideas, not implemented or finalized.

Options to evaluate include one-time book purchases with a free chapter preview, a one-time premium feature bundle, a voluntary one-time tip, and limited advertising in non-reading areas. Ads are an additional possible revenue source, not a reason to make all books free or require ads for Gita access. Avoid interrupting verses, narration or immersive reading with ads. Offline users cannot fetch new ads, so decide deliberately what the free offline experience includes; do not remove content readers already purchased or promise ads will always be available. If trying rewarded ads or temporary chapter access, ensure rewards are optional, disclose expiry, account for no-fill/offline cases, and check current Apple, Google Play and ad network policies first.

Apple and Google Play accounts may be needed to pay for and restore in-app purchases, but these are separate from creating an app account. Paid books and features should be restorable via the appropriate store account and remain available offline after a successful purchase and download, including an explicit offline-access policy for later verification, reinstalls and refunds. App Store and Play Store purchases do not automatically transfer between platforms. Store purchases, entitlements, trusted verification, refunds and any optional account/sync are not implemented. Confirm store rules, commission, tax, pricing and content rights before launch. Local-only entitlement checks and files are not tamper-proof; do not promise perfect protection or no-backend purchase security.

References (check current rules at implementation): https://developer.apple.com/app-store/review/guidelines/ and https://support.google.com/googleplay/android-developer/answer/10281818 .

## Future AI integration — optional and provider-independent

Potential future AI features include simplified, verse-aware explanations and translations. Keep the AI interface modular so on-device models, app-funded APIs and user-provided provider access can be evaluated separately. Preserve the original text, identify AI-generated explanations clearly, review quality and religious accuracy, and distinguish offline on-device features from online services. Do not add AI, payments or accounts solely based on this roadmap.

OpenAI's Sign in with ChatGPT can allow eligible users to consent to using their plan allowance in supported applications. Its documentation describes open-source/local integrations; paid or remotely hosted apps should use the commercial interest form and confirm eligibility, including for iOS/Android. Standard OpenAI API billing is separate. Signing in for AI must be optional; the core reader should not require a DivineCanvas account. Users without an eligible plan or consent need a clear alternative if AI is offered. Claude subscriptions and the Gemini API have separate access/billing arrangements; do not assume consumer plans grant third-party app access. Recheck all provider terms, availability, security and pricing when designing the feature.

References: https://developers.openai.com/siwc/token-sharing-open-source and https://openai.com/form/sign-in-with-chatgpt-interest/ .

## Itihasa preview — November 2026

The ordered Itihasa source at https://github.com/rahular/itihasa/tree/gh-pages/res was inspected at commit `a9e3807cdd20d46a0757f6d94760b92eefd46464` for the Ramayana and Mahabharata. The corpus is Sanskrit and English only; do not label English as Hindi. Ordered JSON has 642 and 2,110 chapter entries, with 19,371 and 73,659 aligned passage pairs respectively. Entries may contain multiple verses; numbering/structure and OCR require editorial review. The linked GitHub branch has no explicit license; the author's Hugging Face version is marked Apache-2.0, but application to these exact raw files and underlying works must be confirmed before redistribution or sale. Data is locally prepared and ignored by Git, included in EAS internal previews, and attributed to the corpus authors and M. N. Dutt. Approved generated book covers are bundled in their book asset directories.


## Separate book downloads — November 2026

The preview library offers per-book downloads from the public GitHub `book-data-v1` release. Each book has its own verified SQLite package and publicly downloadable source JSON. Downloaded books work offline; passage text is fetched in a seven-passage window, while chapter metadata remains bundled. Removing a download keeps local notes and reading progress. The initial version uses public URLs and has no purchases or access control. The Gita, Ramayana and Mahabharata source rights still require confirmation for public app distribution. EPUB import and payments remain future work.


## Ram Shalaka Prashnavali

Offline devotional section accessible from the Books section selector. The traditional 225 cells map to nine answer lines by row-major index modulo 9. Passages are from WirelessAlien/Ramcharitmanas, sourced from IIT Kanpur; the board was checked against Chalisa Sangrah. English and Hindi explanations are original summaries and still need editorial review. Source permission for redistribution remains to be independently confirmed. Haptics use cell and edge feedback on iOS/Android; validate real hardware and screen-reader behavior before publication.


## Interface language and credits

Settings → App language selects English or Hindi for the app interface. This preference is stored locally under `app-language`, independently from the selected reading language. Settings → Credits contains book, Prashnavali, voice, music, dictionary and icon sources and their relevant notices. Original text, English dictionary definitions and legal license texts retain their source languages.
