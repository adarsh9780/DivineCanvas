# DivineCanvas

A small offline-first iOS and Android reading app built with Expo and React Native. The preview library downloads the Hansi Gita Bhawan Trust’s Sanskrit, Hindi and English dataset and the Itihasa Sanskrit and English datasets separately. The Trust asks for attribution; confirm permission for full offline redistribution in an app with paid features before public release.

## Run locally

Use a supported Node version (Node 24 LTS is recommended), then run:

```sh
npm install
npx expo start
```

Scan the QR code using a compatible Expo Go version, or press `i` / `a` for an installed iOS simulator / Android emulator. Expo SDK 58 currently requires a compatible development build until Expo Go supports it. See https://docs.expo.dev/get-started/start-developing/.

## Foundation

- The reader presents short passages with vertical paging, chapter navigation, language selection, saved passages and notes.
- SQLite stores saves, notes, reading position and language on the device. Uninstalling the app may remove them.
- `src/book.ts` maps locally prepared content into stable passage IDs. Preserve IDs across updates to retain saves.
- EPUB import, general text pagination, source parsing, accounts and syncing are future work. The extracted verse entries are pre-divided, not automatic 4–5 line pagination.
- Test offline behavior and layout on actual iOS and Android devices before release.

## Local book preview

The Gita package is built from `src/data/gita-trust.local.json`, the [Hansi Gita Bhawan Trust dataset](https://gitabhawan.org.in/gita/research). It contains 700 verses in Sanskrit, Hindi and English. The Trust claims copyright in its translations and allows use with attribution; confirm full offline redistribution and use in an app with paid features before public release. The source is credited in the app. The source data is excluded from Git and app builds. To regenerate the book package, download it from https://gitabhawan.org.in/data/gita-corpus.json into that path.

## iPhone preview build

The `preview` EAS profile produces a standalone internal build, not an Expo Go development build. It requires an Expo account, an Apple Developer Program membership, a unique iOS bundle identifier, and registration of the iPhone. See https://docs.expo.dev/tutorial/eas/internal-distribution-builds/.

EAS excludes source book data and the original EPUB in `books/`; books are downloaded separately. The current book is a personal prototype; confirm redistribution permission before sharing the build. Do not use the EAS preview profile as-is for a public release.

## Chapter progress

Each chapter remembers its last opened passage offline. The chapter list shows where it will resume. Progress is stored by book edition, chapter and stable passage ID; opening a saved passage also updates that chapter. Older installations retain their last overall position, which seeds that chapter on upgrade. Earlier positions in other chapters cannot be recovered retroactively. Run `npm run test:progress` to check database persistence and chapter selection. A fresh native build must be installed to update the standalone iPhone app.

## Reading appearance

The profile-style button opens local reading settings, without an account. Readers can choose Small (22), Default (26), or Large (32) passage text, and Paper, White, Sage, or Night backgrounds. Both settings persist in SQLite across restarts. Palettes adjust the reader, navigation, notes and controls together for contrast. The app name is reserved for a future home screen and is omitted from the current in-app header.

## App and build versions

`expo.version` in `app.json` is the shared, user-facing semantic version for iOS and Android (currently `1.0.0`). Update it deliberately when releasing an app version; keep `package.json` aligned. EAS uses its remote version source and increments Android's integer `versionCode` and iOS's `buildNumber` independently for each preview or production build. The initial local values are `1`. Locally built Xcode or Android Studio binaries do not automatically receive those EAS numbers; synchronize them with `npx eas-cli@latest build:version:sync` when needed.

The `preview` profile produces an installable APK for Android. `production` is configured for store builds, which use an Android App Bundle by default.

## Media attribution

“Krishna Flute Music” by Alex Morgan is included under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). [Source and license information](https://freemusicarchive.org/music/alex-morgan/world-devotional-music/krishna-flute-music/). The bundled reading images were supplied by the project owner; verify their distribution rights before release. The included MIT license covers source code and does not grant rights to third-party books, music, or images.

## Ramayana and Mahabharata preview

The local preview can include the original, ordered JSON from the [Itihasa corpus](https://github.com/rahular/itihasa/tree/gh-pages/res), by Rahul Aralikatte and colleagues, based on Manmatha Nath Dutt's English translations. These two books offer Sanskrit and English, not Hindi. The corpus author notes OCR errors; passage entries may include more than one verse. Chapter names and per-volume entry positions reflect the source and may not match other editions' numbering. Treat this as a preview pending editorial and rights review.

The source branch inspected was `a9e3807cdd20d46a0757f6d94760b92eefd46464`; download the two `res/*.json` files from that commit. The Hugging Face corpus is labeled Apache-2.0, but the linked GitHub `gh-pages/res` files have no explicit license in the branch: confirm that license and the underlying text's rights before distributing or selling. The source data is excluded from Git and app builds; preview book files are provided separately in the GitHub release. To recreate the local assets, download the two ordered source JSON files and run:

```sh
node scripts/prepare-itihasa.cjs /path/to/ramayana.json /path/to/mahabharata.json src/data
python3 scripts/prepare-itihasa-db.py
```

The two approved cover illustrations are bundled under `assets/books/ramayana` and `assets/books/mahabharata`. The 14 Gita reading images are in `assets/books/gita`, with smaller previews in its `thumbs` folder. User-selected background images are stored separately in the app's private documents directory.

## Downloadable book preview

The library downloads each book separately from the `book-data-v1` GitHub release. The app checks the exact SHA-256 and size of each database before opening it; downloaded text is stored on-device and read in seven-passage windows. Book metadata is bundled for navigation; notes and progress remain in the separate local settings database when a download is removed. The `.json` assets are the corresponding source data for inspection. The GitHub files are public and do not enforce a purchase. Book downloads currently support iOS and Android, not the web preview.

Regenerate the packages from the local Gita file and the pinned, ordered Itihasa source JSON with `python3 scripts/prepare-book-downloads.py RAMAYANA.json MAHABHARATA.json OUTPUT_DIR`. Changing a file requires publishing a new version and updating the pinned sizes, hashes and URL in `src/bookDownloads.ts`; never replace a published version in place. Confirm the source rights noted above before a public release.

## Ram Shalaka Prashnavali

The Books heading opens a section selector linking to an offline 15 × 15 Ram Shalaka. The selected row-major cell determines one of nine traditional answer lines using the every-ninth-square pattern. The board preserves individual cell boundaries, including standalone vowel signs. Passages were checked against WirelessAlien/Ramcharitmanas (which credits IIT Kanpur); the board was checked against https://chalisasangrah.in/Prashnavali. Hindi and English explanations are original brief summaries, not translations from the repository. Spelling variants exist between the board and passage source and are preserved rather than silently changed.

Finger movement highlights each cell with haptic ticks, and entering the edge gives a distinct feedback. Lifting outside cancels the selection. Haptics may be unavailable or disabled on a device. An accessible cell selection path is available for screen-reader users. Run `node scripts/check-prashnavali.cjs` to verify the board, nine mappings, boundaries and source spelling variants.


## Interface language and credits

Settings → App language selects English or Hindi for the app interface. This preference is stored locally under `app-language`, independently from the selected reading language. Settings → Credits contains book, Prashnavali, voice, music, dictionary and icon sources and their relevant notices. Original text, English dictionary definitions and legal license texts retain their source languages.
