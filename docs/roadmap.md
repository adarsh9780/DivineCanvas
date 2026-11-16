# DivineCanvas: product context and roadmap

Last updated: 28 October 2026

## Purpose

DivineCanvas is an offline-first mobile reading app for iPhone and Android. Its purpose is to make reading feel approachable by presenting a book as a sequence of short, focused passages. Readers move forward or backward with a vertical swipe, similar to browsing Instagram Reels. The first book will be the Bhagavad Gita; the foundation should allow other books later.

The first release should be simple, calm, and focused on reading. It should not require an account, payment, an internet connection after installation, or a server. Avoid adding social feeds, sharing, analytics, onboarding, or other features unless requested.

## First-release experience

- **Read:** Show one short passage at a time. Swipe up for the next passage and down for the previous one. Remember the reader's place.
- **Languages:** Present the Gita in Hindi and English with translations. The exact source, its available languages, and how original Sanskrit, transliteration, and translations are displayed remain to be decided when a suitable book is selected. A language toggle is a reasonable starting point.
- **Chapters:** An Instagram-inspired explore screen lists chapters and lets readers jump into one. A way to jump to a particular verse is desirable; full-text search has not been specified.
- **Saved:** Readers can like a passage and optionally attach a private note. Provide a place to revisit saved passages and edit notes.
- **Offline:** Bundle the book and translations with the app; keep reading, chapter navigation, saves, notes, and progress available offline from the first launch.

## Reading model

The long-term idea is a reusable book reader that converts content into a reel-like sequence. Aim for roughly four or five visible lines per card, but preserve natural sentence and verse boundaries when practical. Screen size, language, and font settings change line wrapping, so a hard-coded line count should not cut text arbitrarily. Handle longer passages with a clear continuation; preserve reading order and keep verse references and translations connected.

A book can be prepared ahead of time for the bundled release. Importing and reading a source file at runtime is not required for the first release. When the EPUB is available, inspect its actual structure and decide how to extract chapters, verses, and translations. Do not assume an EPUB automatically identifies or aligns them.

Store stable source references for passages and annotations rather than using the displayed card number as identity. Pagination may change with screen size, language, font size, or content updates. Keep user data separate from bundled book content, and plan migrations so updates do not erase saves and notes.

## Content and rights

The user is looking for a free Bhagavad Gita EPUB. No source or translation has been selected. Free access does not necessarily grant redistribution or commercial rights: verify the source, each translation's license, attribution requirements, and suitability for offline bundling and future paid use before shipping. Check the completeness, verse numbering, translation alignment, and text quality. Do not invent or silently substitute religious text.

Current content is original, explicitly labeled placeholder text, not Bhagavad Gita verses. Replace it only after choosing and reviewing the source.

## Later ideas, not first-release commitments

- Add other bundled books using the same reader foundation.
- Let paying users import their own books. Start by investigating reflowable EPUBs without DRM; PDF support can follow. Complex layouts, scanned PDFs, and DRM-protected files require separate investigation and may not convert reliably.
- Consider accounts, paid features, and syncing across devices later. Pricing, purchase model, entitlements, account design, and rollout have not been decided.
- Local-only notes are tied to the installation and can be lost when app data is cleared or the app is uninstalled. Cross-device recovery requires a future backup or sync design.

Do not implement payments, accounts, book import, cloud infrastructure, OCR, or DRM handling merely because they appear in this roadmap.

## Current implementation

- Expo and React Native with TypeScript provide a shared iOS and Android codebase. Expo Router is configured; see `AGENTS.md` for repository conventions.
- `src/ReaderApp.tsx` contains the current reader and the chapter and saved views. It uses vertically paged sample passages, language selection, and local note editing.
- `src/book.ts` contains three sample passages with stable sample IDs. These are pre-divided; there is no EPUB parser, automatic pagination, or real Gita content yet.
- Expo SQLite stores saved passages and notes, reading position, and selected language on the device. The existing database is named `kgram.db`; preserve or migrate it if renaming it, so existing local data is not discarded.
- `src/app/` contains the Expo Router entry. `README.md` explains setup. Node 24 LTS is the project baseline (`.nvmrc`).
- Type checking, linting, and iOS/Android JavaScript bundle exports have passed. The current app has not yet been validated on physical iOS and Android devices; do not treat a successful bundle as device or offline verification.

## Suggested next steps

1. Obtain and verify an appropriate Gita EPUB and the rights for its original text and Hindi/English translations.
2. Inspect the book's chapters, verse boundaries, language structure, and navigation; agree on the display when the source is known.
3. Create and validate a repeatable conversion into a bundled, structured format, preserving stable source references and existing user data.
4. Implement passage pagination and continuation, chapter/verse navigation, and language presentation; handle different screen sizes and accessible text scaling.
5. Test swipe navigation, offline first launch, chapter jumps, saved notes, updates, and reading-position restoration on real iOS and Android devices before release.

This roadmap records the current intent, not a fixed specification. Confirm product choices with the user when the available book or a later feature exposes a meaningful tradeoff.

## Local prototype update

A user-provided 1972 Bhagavad-gita As It Is EPUB now supplies a local English/Sanskrit preview. The edition contains copyrighted translations and requires rights verification before distribution; the source and generated data are Git-ignored. `scripts/prepare_gita.py` extracts 653 grouped entries from 18 chapters for this particular edition. Hindi, automatic passage pagination, editorial verification and device testing remain outstanding. The older sample-status notes above describe the original foundation, not the current local preview.
